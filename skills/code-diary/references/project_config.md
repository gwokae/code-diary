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

### `repository` (object, required unless using `repositories`)

Git repository settings.

- **`mainBranch`** (string): Name of the main branch (e.g., `"main"`, `"master"`, `"develop"`)
- **`featureBranchRule`** (string): Template for feature branch names
  - Use `{filename}` placeholder for the generated task filename
  - Examples:
    - `"feat/{filename}"` → `feat/PROJ-123_dashboard-automations`
    - `"feature/{filename}"` → `feature/PROJ-123_dashboard-automations`
    - `"{filename}"` → `PROJ-123_dashboard-automations`

### `repositories` (array, optional)

Alternative to `repository`, for a project that spans multiple repos sharing one Jira/issue-tracker config. Mutually exclusive with `repository` — a project has one or the other, never both.

Each entry:

```json
{
  "name": "umr-local",
  "path": "/Users/you/workspace/umr-local",
  "mainBranch": "main",
  "featureBranchRule": "feat/{filename}"
}
```

- **`name`**: stable identifier, used as a fallback match (directory basename or git remote) and as the `repo` key in a multi-repo task's `branches:` frontmatter list.
- **`path`**: absolute, this-machine path to the repo. Primary match for detection; also where to `cd` when acting on this repo.
- **`mainBranch`** / **`featureBranchRule`**: same meaning as the singular `repository` fields, but scoped to this one repo.

### `activeRepository` (in `get_current_project.cjs` output, not in `project.json`)

Every successful `get_current_project.cjs` result includes a normalized `activeRepository: { name, path, mainBranch, featureBranchRule }`, resolved from whichever repo matches the cwd you passed in. For a project using `repository` (legacy) or matched via a `repositories[]` entry, this is always populated. If a `repositories[]`-based project is instead matched by its own top-level name or git-remote (an unusual setup — the project's own registered name coinciding with a directory that isn't actually one of its repos), `activeRepository` is `null` rather than back-resolved. Read `activeRepository.mainBranch` (not `config.repository.mainBranch`) when you need "the main branch for the repo I'm currently in." Multi-repo results also include the full `repositories` array.

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
