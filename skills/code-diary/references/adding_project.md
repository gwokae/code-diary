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

**Output:**

- Creates `<worklogsPath>/<project>/project.json`
- Creates `<worklogsPath>/<project>/tasks/{new,working,archived}/`
- Creates `<worklogsPath>/logs/` (if not exists)
- Displays generated configuration

**Note:** If project already exists, script will error. Edit `project.json` manually to update configuration.

## Script reference: `init_project.cjs`

- Usage: `node init_project.cjs <project-name> [options]` — see Options above
- Creates project directory structure and configuration file

See [project_config.md](./project_config.md) for the full `project.json` schema.
