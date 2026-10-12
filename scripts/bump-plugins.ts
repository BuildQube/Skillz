export type BumpLevel = "major" | "minor" | "patch";

export function bumpSemver(version: string, level: BumpLevel): string {
  const parts = version.split(".").map((p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Invalid semver component "${p}" in version "${version}"`);
    }
    return n;
  });
  if (parts.length !== 3) {
    throw new Error(`Expected MAJOR.MINOR.PATCH, got "${version}"`);
  }
  const [maj, min, pat] = parts;
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

const LEVEL_RANK: Record<BumpLevel, number> = { patch: 0, minor: 1, major: 2 };

export function parseBumpLabels(labels: string[]): Map<string, BumpLevel> {
  const out = new Map<string, BumpLevel>();
  for (const label of labels) {
    const idx = label.lastIndexOf(":");
    if (idx === -1) continue;
    const name = label.slice(0, idx);
    const level = label.slice(idx + 1);
    if (level !== "major" && level !== "minor" && level !== "patch") continue;
    const existing = out.get(name);
    if (!existing || LEVEL_RANK[level] > LEVEL_RANK[existing]) {
      out.set(name, level);
    }
  }
  return out;
}

export type PluginEntry = {
  name: string;
  source: string;
  version: string;
};

export function detectChangedPlugins(
  changedFiles: string[],
  plugins: PluginEntry[]
): Set<string> {
  const changed = new Set<string>();
  for (const plugin of plugins) {
    const prefix = plugin.source.replace(/^\.\//, "").replace(/\/$/, "") + "/";
    for (const file of changedFiles) {
      if (file.startsWith(prefix)) {
        changed.add(plugin.name);
        break;
      }
    }
  }
  return changed;
}

export type Marketplace = {
  name: string;
  plugins: PluginEntry[];
  [key: string]: unknown;
};

export type BumpReason = "default" | "label" | "label-without-changes";

export type BumpEntry = {
  pluginName: string;
  source: string;
  currentVersion: string;
  newVersion: string;
  level: BumpLevel;
  reason: BumpReason;
};

export type BumpPlanInput = {
  changedFiles: string[];
  labels: string[];
  marketplace: Marketplace;
};

export function makeBumpPlan(input: BumpPlanInput): BumpEntry[] {
  const { changedFiles, labels, marketplace } = input;
  const labelMap = parseBumpLabels(labels);
  const changedPlugins = detectChangedPlugins(changedFiles, marketplace.plugins);

  const plan: BumpEntry[] = [];
  for (const plugin of marketplace.plugins) {
    const labelLevel = labelMap.get(plugin.name);
    const filesChanged = changedPlugins.has(plugin.name);

    let level: BumpLevel | null = null;
    let reason: BumpReason | null = null;

    if (filesChanged && labelLevel) {
      level = labelLevel;
      reason = "label";
    } else if (filesChanged && !labelLevel) {
      level = "patch";
      reason = "default";
    } else if (!filesChanged && labelLevel) {
      level = labelLevel;
      reason = "label-without-changes";
    }

    if (level === null || reason === null) continue;

    plan.push({
      pluginName: plugin.name,
      source: plugin.source,
      currentVersion: plugin.version,
      newVersion: bumpSemver(plugin.version, level),
      level,
      reason,
    });
  }
  return plan;
}

export type RunInput = {
  changedFiles: string[];
  labels: string[];
  marketplace: Marketplace;
  format: "json" | "markdown";
};

export function runBumpPlugins(input: RunInput): string {
  const plan = makeBumpPlan({
    changedFiles: input.changedFiles,
    labels: input.labels,
    marketplace: input.marketplace,
  });
  return input.format === "json" ? formatPlanJson(plan) : formatPlanMarkdown(plan);
}

const STICKY_MARKER = "<!-- plugin-version-bot -->";

export function formatPlanJson(plan: BumpEntry[]): string {
  return JSON.stringify(plan);
}

export function formatPlanMarkdown(plan: BumpEntry[]): string {
  if (plan.length === 0) {
    return [
      STICKY_MARKER,
      "### 📦 Version bump preview",
      "",
      "No plugin files changed in this PR — no version bumps will occur on merge.",
    ].join("\n");
  }

  const reasonLabel = (e: BumpEntry): string => {
    if (e.reason === "default") return "default (no label)";
    if (e.reason === "label") return `label \`${e.pluginName}:${e.level}\``;
    return `⚠️ label \`${e.pluginName}:${e.level}\``;
  };

  const rows = plan.map((e) =>
    `| ${e.pluginName} | ${e.currentVersion} | **${e.newVersion}** | ${e.level} | ${reasonLabel(e)} |`
  );

  const tags = plan.map((e) => `\`${e.pluginName}@${e.newVersion}\``).join(", ");

  const warnings = plan
    .filter((e) => e.reason === "label-without-changes")
    .map(
      (e) =>
        `> ⚠️ \`${e.pluginName}\`: Label present but no plugin files touched — bump will still apply.`
    );

  const lines = [
    STICKY_MARKER,
    "### 📦 Version bump preview",
    "",
    "If this PR merges to `main`, the following will happen:",
    "",
    "| Plugin | Current | → New | Level | Reason |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `Tags to be created: ${tags}`,
    `GitHub releases: ${plan.length}`,
  ];

  if (warnings.length > 0) {
    lines.push("");
    lines.push(...warnings);
  }

  lines.push("");
  lines.push("_Add label `<plugin-name>:major|minor|patch` to override._");

  return lines.join("\n");
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  let labelsArg = "";
  let format: "json" | "markdown" = "json";
  let marketplacePath = ".claude-plugin/marketplace.json";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--labels") labelsArg = args[++i] ?? "";
    else if (a === "--format") format = (args[++i] ?? "json") as "json" | "markdown";
    else if (a === "--marketplace") marketplacePath = args[++i] ?? marketplacePath;
  }

  const stdinText = await Bun.stdin.text();
  const changedFiles = stdinText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const labels = labelsArg
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const marketplace = (await Bun.file(marketplacePath).json()) as Marketplace;

  const out = runBumpPlugins({ changedFiles, labels, marketplace, format });
  console.log(out);
}
