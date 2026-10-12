import { test, expect, describe } from "bun:test";
import { bumpSemver, parseBumpLabels, detectChangedPlugins, makeBumpPlan, formatPlanMarkdown, formatPlanJson, runBumpPlugins, type PluginEntry, type Marketplace, type BumpEntry } from "./bump-plugins.ts";

describe("bumpSemver", () => {
  test("patch increments the patch component", () => {
    expect(bumpSemver("0.1.1", "patch")).toBe("0.1.2");
  });
  test("minor increments minor and zeros patch", () => {
    expect(bumpSemver("0.1.1", "minor")).toBe("0.2.0");
  });
  test("major increments major and zeros minor and patch", () => {
    expect(bumpSemver("1.2.3", "major")).toBe("2.0.0");
  });
  test("rejects non-numeric components", () => {
    expect(() => bumpSemver("1.2.x", "patch")).toThrow();
  });
});

describe("parseBumpLabels", () => {
  test("extracts plugin:level pairs", () => {
    const result = parseBumpLabels(["plugin-a:patch", "plugin-b:minor"]);
    expect(result).toEqual(new Map([
      ["plugin-a", "patch"],
      ["plugin-b", "minor"],
    ]));
  });
  test("ignores non-bump labels", () => {
    const result = parseBumpLabels(["bug", "documentation", "plugin-a:major"]);
    expect(result).toEqual(new Map([["plugin-a", "major"]]));
  });
  test("ignores invalid levels", () => {
    const result = parseBumpLabels(["plugin-a:huge", "plugin-a:patch"]);
    expect(result).toEqual(new Map([["plugin-a", "patch"]]));
  });
  test("highest level wins on conflict (major > minor > patch)", () => {
    const result = parseBumpLabels(["plugin-a:patch", "plugin-a:major"]);
    expect(result).toEqual(new Map([["plugin-a", "major"]]));
  });
  test("returns empty map for empty input", () => {
    expect(parseBumpLabels([])).toEqual(new Map());
  });
});

const samplePlugins: PluginEntry[] = [
  { name: "plugin-a", source: "./plugins/plugin-a", version: "0.1.1" },
  { name: "plugin-b", source: "./plugins/plugin-b", version: "0.1.2" },
];

describe("detectChangedPlugins", () => {
  test("detects plugins by file path prefix", () => {
    const changed = detectChangedPlugins(
      ["plugins/plugin-a/agents/foo.md", "README.md"],
      samplePlugins
    );
    expect(changed).toEqual(new Set(["plugin-a"]));
  });
  test("detects multiple plugins changed", () => {
    const changed = detectChangedPlugins(
      ["plugins/plugin-a/x.md", "plugins/plugin-b/y.md"],
      samplePlugins
    );
    expect(changed).toEqual(new Set(["plugin-a", "plugin-b"]));
  });
  test("returns empty set when no plugin files changed", () => {
    const changed = detectChangedPlugins(
      ["README.md", ".github/workflows/foo.yml"],
      samplePlugins
    );
    expect(changed).toEqual(new Set());
  });
  test("normalizes leading ./ in source path", () => {
    const changed = detectChangedPlugins(
      ["plugins/plugin-a/foo.md"],
      [{ name: "plugin-a", source: "./plugins/plugin-a", version: "0.1.1" }]
    );
    expect(changed).toEqual(new Set(["plugin-a"]));
  });
  test("does not match plugin source as a prefix of unrelated dir", () => {
    const changed = detectChangedPlugins(
      ["plugins/plugin-a-experimental/foo.md"],
      samplePlugins
    );
    expect(changed).toEqual(new Set());
  });
});

const sampleMarketplace: Marketplace = {
  name: "skillz",
  plugins: [
    { name: "plugin-a", source: "./plugins/plugin-a", version: "0.1.1" },
    { name: "plugin-b", source: "./plugins/plugin-b", version: "0.1.2" },
  ],
};

describe("makeBumpPlan", () => {
  test("default patch bump for changed plugin with no label", () => {
    const plan = makeBumpPlan({
      changedFiles: ["plugins/plugin-a/agents/foo.md"],
      labels: [],
      marketplace: sampleMarketplace,
    });
    expect(plan).toEqual([
      {
        pluginName: "plugin-a",
        source: "./plugins/plugin-a",
        currentVersion: "0.1.1",
        newVersion: "0.1.2",
        level: "patch",
        reason: "default",
      },
    ]);
  });
  test("label overrides default level", () => {
    const plan = makeBumpPlan({
      changedFiles: ["plugins/plugin-a/x.md"],
      labels: ["plugin-a:minor"],
      marketplace: sampleMarketplace,
    });
    expect(plan[0]).toMatchObject({
      pluginName: "plugin-a",
      newVersion: "0.2.0",
      level: "minor",
      reason: "label",
    });
  });
  test("label without changes still produces a bump with reason label-without-changes", () => {
    const plan = makeBumpPlan({
      changedFiles: ["README.md"],
      labels: ["plugin-a:major"],
      marketplace: sampleMarketplace,
    });
    expect(plan).toEqual([
      {
        pluginName: "plugin-a",
        source: "./plugins/plugin-a",
        currentVersion: "0.1.1",
        newVersion: "1.0.0",
        level: "major",
        reason: "label-without-changes",
      },
    ]);
  });
  test("no changes and no labels produces empty plan", () => {
    const plan = makeBumpPlan({
      changedFiles: ["README.md"],
      labels: [],
      marketplace: sampleMarketplace,
    });
    expect(plan).toEqual([]);
  });
  test("multiple plugins handled independently", () => {
    const plan = makeBumpPlan({
      changedFiles: ["plugins/plugin-a/x.md", "plugins/plugin-b/y.md"],
      labels: ["plugin-b:major"],
      marketplace: sampleMarketplace,
    });
    expect(plan).toHaveLength(2);
    expect(plan.find((e) => e.pluginName === "plugin-a")?.reason).toBe("default");
    expect(plan.find((e) => e.pluginName === "plugin-a")?.newVersion).toBe("0.1.2");
    expect(plan.find((e) => e.pluginName === "plugin-b")?.reason).toBe("label");
    expect(plan.find((e) => e.pluginName === "plugin-b")?.newVersion).toBe("1.0.0");
  });
  test("label for plugin not in marketplace is ignored", () => {
    const plan = makeBumpPlan({
      changedFiles: [],
      labels: ["nonexistent-plugin:major"],
      marketplace: sampleMarketplace,
    });
    expect(plan).toEqual([]);
  });
});

const samplePlan: BumpEntry[] = [
  {
    pluginName: "plugin-a",
    source: "./plugins/plugin-a",
    currentVersion: "0.1.1",
    newVersion: "0.1.2",
    level: "patch",
    reason: "default",
  },
  {
    pluginName: "plugin-b",
    source: "./plugins/plugin-b",
    currentVersion: "0.1.2",
    newVersion: "0.2.0",
    level: "minor",
    reason: "label",
  },
];

describe("formatPlanMarkdown", () => {
  test("includes sticky comment marker", () => {
    expect(formatPlanMarkdown(samplePlan)).toContain("<!-- plugin-version-bot -->");
  });
  test("renders each plugin row", () => {
    const md = formatPlanMarkdown(samplePlan);
    expect(md).toContain("plugin-a");
    expect(md).toContain("0.1.1");
    expect(md).toContain("**0.1.2**");
    expect(md).toContain("plugin-b");
    expect(md).toContain("**0.2.0**");
  });
  test("empty plan renders 'no bumps' message", () => {
    const md = formatPlanMarkdown([]);
    expect(md).toContain("<!-- plugin-version-bot -->");
    expect(md).toContain("No plugin files changed");
  });
  test("label-without-changes row gets warning note", () => {
    const md = formatPlanMarkdown([
      {
        pluginName: "plugin-a",
        source: "./plugins/plugin-a",
        currentVersion: "0.1.1",
        newVersion: "1.0.0",
        level: "major",
        reason: "label-without-changes",
      },
    ]);
    expect(md).toContain("⚠️");
    expect(md).toContain("Label present but no plugin files touched");
  });
});

describe("formatPlanJson", () => {
  test("returns valid JSON array", () => {
    const json = formatPlanJson(samplePlan);
    expect(JSON.parse(json)).toEqual(samplePlan);
  });
  test("empty plan is empty array", () => {
    expect(JSON.parse(formatPlanJson([]))).toEqual([]);
  });
});

describe("runBumpPlugins", () => {
  test("returns markdown when format=markdown", () => {
    const result = runBumpPlugins({
      changedFiles: ["plugins/plugin-a/x.md"],
      labels: [],
      marketplace: sampleMarketplace,
      format: "markdown",
    });
    expect(result).toContain("<!-- plugin-version-bot -->");
    expect(result).toContain("plugin-a");
  });
  test("returns json when format=json", () => {
    const result = runBumpPlugins({
      changedFiles: ["plugins/plugin-a/x.md"],
      labels: [],
      marketplace: sampleMarketplace,
      format: "json",
    });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].pluginName).toBe("plugin-a");
  });
});
