# Adding a New Project

**When to use:** Setting up code-diary for a new project or repository.

**Process:**

1. Navigate to the project directory (optional, for auto-detection)
2. Run `scripts/init_project.cjs` with project name and options

**Options:**

- **Auto-detect** (recommended): `--auto-detect`
  - Detects main branch from git (main/master/develop)
  - Detects issue tracker type from git remote URL

- **Manual configuration**:
  - `--issue-tracker-type <type>`: jira, github, or linear
  - `--issue-tracker-url <url>`: Base URL for issue tracker
  - `--issue-tracker-prefix <prefix>`: Project prefix (e.g., PROJ, ABC)
  - `--main-branch <branch>`: Main branch name
  - `--feature-branch-rule <rule>`: Branch naming template

- **Multi-repo project** (a project spanning several repos, e.g. one Jira project touching 4 repos):
  - One-shot: `--repositories '<json-array>'`, each entry `{name, path, mainBranch, featureBranchRule?}`
  - Incremental: `--add-repository <name> --path <path> --main-branch <branch> [--feature-branch-rule <rule>]` — appends to an *existing* project. The first `--add-repository` call on a project that still has the old singular `repository` field discards it and starts a fresh `repositories[]` — there's no automatic migration of the old field's values, since a placeholder single-repo guess usually doesn't match any of the real repos.

**Examples:**

Auto-detect settings from current directory:

```bash
cd ~/workspace/my-project
node scripts/init_project.cjs my-project --auto-detect
```

Manual configuration:

```bash
node scripts/init_project.cjs my-project \
  --issue-tracker-type jira \
  --issue-tracker-url https://example.atlassian.net \
  --issue-tracker-prefix PROJ \
  --main-branch develop \
  --feature-branch-rule "feat/{filename}"
```

Multi-repo, incremental:

```bash
node scripts/init_project.cjs mobility --issue-tracker-type jira --issue-tracker-url https://example.atlassian.net --issue-tracker-prefix PROJ
node scripts/init_project.cjs mobility --add-repository umr       --path ~/workspace/umr       --main-branch develop
node scripts/init_project.cjs mobility --add-repository ui-commons --path ~/workspace/ui-commons --main-branch main
```

**Output:**

- Creates `<worklogsPath>/<project>/project.json`
- Creates `<worklogsPath>/<project>/tasks/{new,working,archived}/`
- Creates `<worklogsPath>/logs/` (if not exists)
- Displays generated configuration
- `--add-repository` only updates the existing `project.json` (appending to `repositories[]`) and displays the result — it creates no new directories.

**Note:** Plain `init_project.cjs <name> ...` (without `--add-repository`) errors if the project already exists. Use `--add-repository` to add a repo to an existing multi-repo project (see above). For anything else, edit `project.json` manually.

## Script reference: `init_project.cjs`

- Usage: `node init_project.cjs <project-name> [options]` — see Options above
- Creates project directory structure and configuration file

See [project_config.md](./project_config.md) for the full `project.json` schema.
