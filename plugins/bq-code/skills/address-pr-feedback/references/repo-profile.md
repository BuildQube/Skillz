# Building the repo profile

Before editing, work out four things for the current repo. Spend a minute here, not ten — read, don't run anything yet.

1. **Check commands** — what to run, and which files trigger each.
2. **Commit style** — conventional prefix or plain subjects; PR-title rules.
3. **Committed artifacts** — lockfiles, generated code, changesets that must ride along.
4. **Gotchas** — hooks that rewrite files, slow/emulated CI jobs, house rules reviewers cite.

## Source 1: `.claude/pr-feedback.md` (authoritative if present)

A repo can pin its profile in `.claude/pr-feedback.md`. If it exists, read it and treat it as the answer — use discovery below only to fill gaps it doesn't cover. Template:

```markdown
# PR feedback profile

## Checks
| Files touched | Commands |
|---|---|
| anything | `bun run lint`, `bun run check-types` |
| `apps/**`, `packages/**` | `bun run test` |
| `crates/**`, `**/Cargo.toml` | `bun run test:rust` |

## Commits
Conventional commits (`fix(scope): …`); PR titles are linted.

## Always commit
`bun.lock`, `Cargo.lock`, regenerated `packages/bindings/src/index.ts`.

## Gotchas
- The pre-commit hook runs `cargo clippy --fix` — re-verify after committing.
- CI's `e2e` job is sharded 8 ways; read one failing shard's log, not all eight.
- Reviewers citing "shadcn-first" want an extended shadcn primitive, not a bespoke component.
```

When you finish a run and learned something a future run would need (a non-obvious check, a hook surprise), suggest adding it to this file in your report. Don't create or edit it unasked.

## Source 2: discovery

### Check commands

In order of trust:

1. **CI workflows** — `.github/workflows/*.yml`. The `run:` steps of jobs triggered on `pull_request` are what will judge the PR; run the same commands locally. Note `paths:` filters — they tell you which files trigger which job.
2. **Task runners** — `package.json` `scripts` (and the package manager from the lockfile: `bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm), `turbo.json`, `Makefile`, `justfile`, `Taskfile.yml`, `Cargo.toml` (`cargo fmt --check`, `cargo clippy`, `cargo test`), `pyproject.toml` (ruff/pytest/mypy), `go.mod` (`go vet`, `go test ./...`).
3. **Agent docs** — `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`. These often name the canonical commands and the rules reviewers enforce. If they disagree with the actual config files (e.g. a formatter setting), the config file wins.

Build a small matrix: cheap always-on gates (lint, format check, typecheck) + per-area tests/builds keyed by path. In a monorepo, scope to affected packages (`turbo --filter`, `pnpm --filter`, `cargo test -p`) rather than running the world.

Watch for tasks that test stale artifacts — e.g. a `test` script that doesn't depend on `build` when the code under test is compiled (native bindings, codegen). If the diff touches the compiled side, build first.

### Commit style

```bash
git log --format=%s -n 20 origin/<base>
```

Mostly `type(scope): …` → conventional commits; otherwise match the plain style. A PR-title lint workflow (e.g. `amannn/action-semantic-pull-request`) means the title matters too.

### Committed artifacts

- Lockfiles — always commit drift alongside the change.
- Generated files tracked in git (look for "generated" headers, or codegen scripts whose outputs are not gitignored) — regenerate and commit when their inputs change, then run the formatter on them if the repo formats them.
- Changesets — a `.changeset/` directory means user-facing changes need one (`changeset`/`pnpm change`); check with `changeset status`.

### Hooks

`.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, `lint-staged` config. If a hook runs formatters, `--fix` linters, or codegen, committing will rewrite files — plan to re-verify after the commit.

### CI shape

Skim the workflows for matrices, sharding, emulated targets, and required vs optional jobs. That tells you which job reports last (so stays `pending` longest) and whether one root cause will light up many jobs at once.
