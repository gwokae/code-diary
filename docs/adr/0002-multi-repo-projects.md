# Support projects that span multiple repositories

`project.json` currently assumes one project maps to exactly one repository: `get_current_project.cjs` detects the current project by matching cwd's directory name (or git remote name) against a project's own `name`, and `repository.mainBranch`/`featureBranchRule` is a single object. This breaks down for a project like `mobility`, which spans four repos (`mobility-portal`, `umr`, `umr-local`, `ui-commons`) sharing one Jira prefix (`LTEF`) but split 2/2 on `main` vs `develop` as their default branch — a single `mainBranch` field is wrong for whichever repos don't match it, and none of the four folder names is literally `mobility`, so the project was undetectable from any of them.

We add an optional `repositories[]` array to `project.json`, mutually exclusive with the existing singular `repository`. Each entry is `{ name, path, mainBranch, featureBranchRule }`:
- `path` (absolute, this-machine) is the primary match for detection (resolved cwd vs. entry path) and lets scripts/the agent `cd` straight to a repo without the user navigating there first — the reverse lookup the old name-only design couldn't do.
- `name` is the stable, machine-independent identifier — used as a fallback match (basename/git-remote, same two-strategy cascade the top-level project detection already uses) if `path` is missing or stale, and as the key in task frontmatter's per-repo branch list.

`get_current_project.cjs` gets one new detection strategy — inserted before the final "not found" fallback, after the existing two (exact `name` match by dirname, then by git remote) — that scans every project's `repositories[]` for a `path`/`name` match. Every result, legacy or multi-repo, is normalized to include `activeRepository: { name, path, mainBranch, featureBranchRule }`, so `switching_tasks.md` and other consumers read one consistent field regardless of schema version. Multi-repo results also include the full `repositories[]` list, so a task needing a second branch in another repo of the same project doesn't require a second file read.

Task frontmatter's `branch:` (singular string) becomes `branches: [{ repo, branch }]` for multi-repo projects only — most tasks in `mobility` still touch just one of the four repos, so this is usually a one-element list, not a forced fan-out. Legacy single-repo projects (`connect`, `review`, any future single-repo project) keep the singular `branch:` field untouched; no migration of existing task files.

## Considered Options

- **Separate `project.json` per repo** (`mobility-portal`, `umr`, `umr-local`, `ui-commons` each standalone, linked only by sharing the `LTEF` prefix): needs zero script changes — directory-name detection already works per repo. Rejected because a ticket touching two repos would need duplicate task files, one per project, which is the exact duplication this change exists to avoid.
- **Workspace-grouping file** (a separate `workspaces.json` aggregating several existing single-repo projects for cross-project queries): avoids touching `project.json`'s schema or detection at all. Rejected — same task-duplication problem as above, plus it introduces a second grouping concept to maintain alongside `project.json`.
- **Extend `project.json` with `repositories[]` (chosen)**: one project, one task pool, one Jira config; per-repo git settings resolved from whichever repo cwd/path currently points at.

## Consequences

- `init_project.cjs` gains `--repositories '<json>'` (one-shot creation) and `--add-repository <name> --path <path> --main-branch <branch> [--feature-branch-rule <rule>]` (incremental, appends to an existing project's `repositories[]`).
- The `mobility` project was created earlier with a placeholder singular `repository` (guessed from `mobility-portal`, since that's the repo the initiating command happened to run from). Adopting `repositories[]` discards that placeholder outright rather than auto-migrating it — the four real entries are added fresh via `--add-repository`.
- Detection strategy order matters: the two existing exact-`name` strategies run before the new `repositories[]` scan, so a single-repo project literally named e.g. `umr` would still resolve via the fast, unambiguous path — the multi-repo scan only kicks in when neither exact match succeeds.
- `switching_tasks.md` branches on "does this project have `repositories[]`?" to decide whether to read/write the singular `branch:` field or the `branches:` list, and to resolve the git base branch from `activeRepository.mainBranch` instead of `config.repository.mainBranch`.
