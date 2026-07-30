# Project Configuration

Project configurations define the settings for each project being tracked in code-diary. Configurations are stored in `<worklogsPath>/<project-name>/project.json` where `<worklogsPath>` is configurable in `~/.claude/skills/code-diary/config.json` (default: `~/.claude/worklogs`).

## Configuration Schema

```json
{
  "name": "project-name",
  "issueTracker": {
    "type": "jira|github|linear",
    "baseUrl": "https://jira.example.com",
    "projectPrefix": "PROJ"
  },
  "repository": {
    "mainBranch": "main",
    "featureBranchRule": "feat/{filename}"
  }
}
```

## Fields

### `name` (string, required)

Project identifier used in worklog paths and task metadata.

Example: `"my-project"`, `"dashboard"`, `"api-service"`

### `issueTracker` (object, optional)

Issue tracking system configuration.

- **`type`** (string): Type of issue tracker - `"jira"`, `"github"`, or `"linear"`
- **`baseUrl`** (string): Base URL for the issue tracker
- **`projectPrefix`** (string): Project prefix for issues (e.g., "PROJ" for PROJ-123)

### `repository` (object, required)

Git repository settings.

- **`mainBranch`** (string): Name of the main branch (e.g., `"main"`, `"master"`, `"develop"`)
- **`featureBranchRule`** (string): Template for feature branch names
  - Use `{filename}` placeholder for the generated task filename
  - Examples:
    - `"feat/{filename}"` → `feat/PROJ-123_dashboard-automations`
    - `"feature/{filename}"` → `feature/PROJ-123_dashboard-automations`
    - `"{filename}"` → `PROJ-123_dashboard-automations`

## Example Configuration

```json
{
  "name": "my-project",
  "issueTracker": {
    "type": "jira",
    "baseUrl": "https://example.atlassian.net",
    "projectPrefix": "PROJ"
  },
  "repository": {
    "mainBranch": "develop",
    "featureBranchRule": "feat/{filename}"
  }
}
```

## Global Configuration (`config.cjs`)

Code-diary also uses a global configuration file to customize paths and settings.

Location: `~/.claude/skills/code-diary/config.json`

**Auto-creation:** If the config file doesn't exist, it will be automatically created with defaults when any code-diary script is run.

**Configuration options:**

```json
{
  "worklogsPath": "~/.claude/worklogs"
}
```

- **`worklogsPath`**: Base directory for all worklogs and project configurations (default: `~/.claude/worklogs`)

**Managing configuration:**

```bash
# Show current configuration
node scripts/config.cjs show

# Get specific value
node scripts/config.cjs get worklogsPath

# Set custom worklogs path
node scripts/config.cjs set worklogsPath ~/my-worklogs

# Show config file path
node scripts/config.cjs path

# Initialize config manually (auto-created on first use)
node scripts/config.cjs init
```

For the overall directory layout (tasks vs. worklogs), see "Directory Structure" in `SKILL.md`.
