import { join } from "path";
import type { BumpEntry } from "./bump-plugins.ts";

export type UpdatePluginJsonInput = {
  cwd: string;
  source: string;
  newVersion: string;
};

export async function updatePluginJson(input: UpdatePluginJsonInput): Promise<void> {
  const sourceClean = input.source.replace(/^\.\//, "").replace(/\/$/, "");
  const path = join(input.cwd, sourceClean, ".claude-plugin", "plugin.json");
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`plugin.json not found at ${path}`);
  }
  const data = (await file.json()) as Record<string, unknown>;
  data.version = input.newVersion;
  await Bun.write(path, JSON.stringify(data, null, 2) + "\n");
}

export type MarketplaceUpdate = {
  pluginName: string;
  newVersion: string;
};

export type UpdateMarketplaceInput = {
  cwd: string;
  updates: MarketplaceUpdate[];
};

export async function updateMarketplace(input: UpdateMarketplaceInput): Promise<void> {
  const path = join(input.cwd, ".claude-plugin", "marketplace.json");
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`marketplace.json not found at ${path}`);
  }
  const data = (await file.json()) as { plugins: Array<{ name: string; version: string }> };
  for (const update of input.updates) {
    const entry = data.plugins.find((p) => p.name === update.pluginName);
    if (!entry) {
      throw new Error(`Plugin "${update.pluginName}" not found in marketplace.json`);
    }
    entry.version = update.newVersion;
  }
  await Bun.write(path, JSON.stringify(data, null, 2) + "\n");
}

export type RunApplyBumpInput = {
  cwd: string;
  plan: BumpEntry[];
};

export async function runApplyBump(input: RunApplyBumpInput): Promise<void> {
  if (input.plan.length === 0) return;

  await updateMarketplace({
    cwd: input.cwd,
    updates: input.plan.map((e) => ({
      pluginName: e.pluginName,
      newVersion: e.newVersion,
    })),
  });

  for (const entry of input.plan) {
    await updatePluginJson({
      cwd: input.cwd,
      source: entry.source,
      newVersion: entry.newVersion,
    });
  }
}

if (import.meta.main) {
  const stdinText = await Bun.stdin.text();
  const plan: BumpEntry[] = stdinText.trim() ? (JSON.parse(stdinText) as BumpEntry[]) : [];
  await runApplyBump({ cwd: process.cwd(), plan });

  for (const entry of plan) {
    console.log(`${entry.pluginName}@${entry.newVersion}`);
  }
}
