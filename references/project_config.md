# Project Configuration

Project configurations define the settings for each project being tracked in code-diary. Configurations are stored in `<worklogsPath>/<project-name>/project.json` where `<worklogsPath>` is configurable in `~/.claude/code-diary/config.json` (default: `~/.claude/worklogs`).

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

## Directory Structure

Code-diary uses a hybrid structure:
- **Tasks**: Project-specific (each project has its own tasks)
- **Worklogs**: Global (shared across all projects for unified daily logging)

```
<worklogsPath>/              # Configurable base path (default: ~/.claude/worklogs)
├── logs/                    # Global worklog files (cross-project)
│   ├── 2026-01.md
│   ├── 2026-02.md
│   └── ...
└── <project-name>/
    ├── project.json         # Project configuration
    └── tasks/
        ├── new/             # New tasks not yet started
        ├── working/         # Tasks currently in progress
        └── archived/        # Completed or abandoned tasks
```

The base path (`<worklogsPath>`) is configured in `~/.claude/code-diary/config.json`.

This structure allows:
- Task management per project (organized by project context)
- Unified worklog across all projects (single daily log showing work from all projects)
- Flexible storage location for worklogs and projects
