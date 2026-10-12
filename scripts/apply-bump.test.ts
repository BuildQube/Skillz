import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { updatePluginJson, updateMarketplace, runApplyBump } from "./apply-bump.ts";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "apply-bump-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("updatePluginJson", () => {
  test("updates version field, preserves other fields, keeps trailing newline", async () => {
    const pluginDir = join(workdir, "plugins", "plugin-a", ".claude-plugin");
    await mkdir(pluginDir, { recursive: true });
    const original = `{
  "name": "plugin-a",
  "version": "0.1.1",
  "description": "test",
  "author": { "name": "BuildQube" }
}
`;
    await writeFile(join(pluginDir, "plugin.json"), original);

    await updatePluginJson({
      cwd: workdir,
      source: "./plugins/plugin-a",
      newVersion: "0.1.2",
    });

    const after = await readFile(join(pluginDir, "plugin.json"), "utf8");
    const parsed = JSON.parse(after);
    expect(parsed.version).toBe("0.1.2");
    expect(parsed.name).toBe("plugin-a");
    expect(parsed.description).toBe("test");
    expect(parsed.author.name).toBe("BuildQube");
    expect(after.endsWith("\n")).toBe(true);
  });
  test("throws if plugin.json does not exist", async () => {
    await expect(
      updatePluginJson({ cwd: workdir, source: "./missing", newVersion: "0.0.1" })
    ).rejects.toThrow();
  });
});

describe("updateMarketplace", () => {
  test("updates version of named plugin only", async () => {
    const cpDir = join(workdir, ".claude-plugin");
    await mkdir(cpDir, { recursive: true });
    const original = `{
  "name": "skillz",
  "plugins": [
    { "name": "plugin-a", "source": "./plugins/plugin-a", "version": "0.1.1" },
    { "name": "plugin-b", "source": "./plugins/plugin-b", "version": "0.1.2" }
  ]
}
`;
    await writeFile(join(cpDir, "marketplace.json"), original);

    await updateMarketplace({
      cwd: workdir,
      updates: [{ pluginName: "plugin-a", newVersion: "0.1.2" }],
    });

    const parsed = JSON.parse(await readFile(join(cpDir, "marketplace.json"), "utf8"));
    expect(parsed.plugins[0].version).toBe("0.1.2");
    expect(parsed.plugins[1].version).toBe("0.1.2"); // unchanged
    expect(parsed.plugins[0].name).toBe("plugin-a");
  });
  test("updates multiple plugins in one call", async () => {
    const cpDir = join(workdir, ".claude-plugin");
    await mkdir(cpDir, { recursive: true });
    await writeFile(
      join(cpDir, "marketplace.json"),
      JSON.stringify({
        name: "m",
        plugins: [
          { name: "a", source: "./a", version: "0.1.0" },
          { name: "b", source: "./b", version: "0.1.0" },
        ],
      }) + "\n"
    );

    await updateMarketplace({
      cwd: workdir,
      updates: [
        { pluginName: "a", newVersion: "0.2.0" },
        { pluginName: "b", newVersion: "1.0.0" },
      ],
    });

    const parsed = JSON.parse(await readFile(join(cpDir, "marketplace.json"), "utf8"));
    expect(parsed.plugins.find((p: any) => p.name === "a").version).toBe("0.2.0");
    expect(parsed.plugins.find((p: any) => p.name === "b").version).toBe("1.0.0");
  });
  test("throws when plugin name not found", async () => {
    const cpDir = join(workdir, ".claude-plugin");
    await mkdir(cpDir, { recursive: true });
    await writeFile(
      join(cpDir, "marketplace.json"),
      JSON.stringify({ name: "m", plugins: [] }) + "\n"
    );
    await expect(
      updateMarketplace({
        cwd: workdir,
        updates: [{ pluginName: "missing", newVersion: "0.1.0" }],
      })
    ).rejects.toThrow();
  });
});

describe("runApplyBump", () => {
  test("applies a multi-plugin plan to plugin.json and marketplace.json", async () => {
    // Set up fixture
    const cpDir = join(workdir, ".claude-plugin");
    await mkdir(cpDir, { recursive: true });
    await mkdir(join(workdir, "plugins", "plugin-a", ".claude-plugin"), { recursive: true });
    await mkdir(join(workdir, "plugins", "plugin-b", ".claude-plugin"), { recursive: true });
    await writeFile(
      join(cpDir, "marketplace.json"),
      JSON.stringify({
        name: "m",
        plugins: [
          { name: "plugin-a", source: "./plugins/plugin-a", version: "0.1.1" },
          { name: "plugin-b", source: "./plugins/plugin-b", version: "0.1.2" },
        ],
      }) + "\n"
    );
    await writeFile(
      join(workdir, "plugins", "plugin-a", ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "plugin-a", version: "0.1.1" }) + "\n"
    );
    await writeFile(
      join(workdir, "plugins", "plugin-b", ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "plugin-b", version: "0.1.2" }) + "\n"
    );

    const plan = [
      {
        pluginName: "plugin-a",
        source: "./plugins/plugin-a",
        currentVersion: "0.1.1",
        newVersion: "0.1.2",
        level: "patch" as const,
        reason: "default" as const,
      },
      {
        pluginName: "plugin-b",
        source: "./plugins/plugin-b",
        currentVersion: "0.1.2",
        newVersion: "0.2.0",
        level: "minor" as const,
        reason: "label" as const,
      },
    ];

    await runApplyBump({ cwd: workdir, plan });

    const market = JSON.parse(await readFile(join(cpDir, "marketplace.json"), "utf8"));
    expect(market.plugins[0].version).toBe("0.1.2");
    expect(market.plugins[1].version).toBe("0.2.0");

    const dev = JSON.parse(
      await readFile(join(workdir, "plugins", "plugin-a", ".claude-plugin", "plugin.json"), "utf8")
    );
    expect(dev.version).toBe("0.1.2");

    const beta = JSON.parse(
      await readFile(join(workdir, "plugins", "plugin-b", ".claude-plugin", "plugin.json"), "utf8")
    );
    expect(beta.version).toBe("0.2.0");
  });
  test("empty plan is a no-op", async () => {
    await expect(runApplyBump({ cwd: workdir, plan: [] })).resolves.toBeUndefined();
  });
});
