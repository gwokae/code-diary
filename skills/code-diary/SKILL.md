---
name: code-diary
description: Developer task management and work logging system. Use when setting up projects, managing development tasks (add, switch, archive), tracking work progress, logging daily work with git commits, or generating weekly summaries. Integrates with JIRA/GitHub issue trackers and git workflows. Triggers include "setup project", "add project", "initialize project", "add task", "switch to task", "start task", "log work", "log daily work", "weekly summary", "archive task".
---

# Code Diary

Manages developer tasks and daily work logs with automatic git workflow integration.

## Overview

Code-diary helps developers:

- Track tasks with JIRA/GitHub integration
- Switch between tasks with automatic branch management
- Log daily work based on git commits
- Generate weekly summaries
- Organize work by project

## Automatic Project Detection

Code-diary automatically detects the current project from the working directory using `scripts/get_current_project.cjs`.

**Detection strategies (in order):**

1. **Directory name**: Matches current directory name (e.g., `/workspace/my-project` → project "my-project")
2. **Git remote URL**: Extracts project name from git remote (e.g., `git@github.com:user/my-project.git` → project "my-project")
3. **Manual fallback**: Lists available projects if detection fails

**Usage:**

- Run code-diary commands from within your project directory
- Project is automatically identified and configured
- No need to specify project name in commands

If project detection fails, available projects are listed for manual selection.

## Shared Scripts

Every workflow below follows the same bookends, so the individual workflow references don't repeat them:

- **Start:** detect the current project with `scripts/get_current_project.cjs`
- **End:** format the touched worklog/task file with `scripts/format_worklog.cjs`

## Configuration

Code-diary uses a global config file (`~/.claude/skills/code-diary/config.json`, managed via `scripts/config.cjs`) for the worklogs path, and a per-project `project.json` for issue-tracker and git settings. See [references/project_config.md](./references/project_config.md) for the full schema and `config.cjs` usage.

## Directory Structure

Code-diary uses a hybrid structure:

- **Tasks**: Project-specific (organized by project)
- **Worklogs**: Global (unified across all projects)

```
<worklogsPath>/              # Configurable base path (default: ~/.claude/worklogs)
├── logs/                    # Global worklog files (cross-project)
│   ├── 2026-01.md
│   └── 2026-02.md
└── <project-name>/
    ├── project.json
    └── tasks/
        ├── new/             # Tasks not yet started
        ├── working/         # Tasks in progress
        └── archived/        # Completed tasks
```

The base path (`<worklogsPath>`) is configurable in `~/.claude/skills/code-diary/config.json`.

This allows unified daily logging across all projects while keeping tasks organized by project.

## Core Workflows

### 1. Adding New Project

**When to use:** Setting up code-diary for a new project or repository.

Read [references/adding_project.md](./references/adding_project.md) before executing.

### 2. Adding New Tasks

**When to use:** Recording new work items, with or without a tracking ID.

Read [references/adding_tasks.md](./references/adding_tasks.md) before executing.

### 3. Switching Tasks

**When to use:** Moving to a different task, including reopening/reworking a previously archived one. Includes mandatory git branching rules (squash-merge caveat) — read the reference even if the steps seem familiar.

Read [references/switching_tasks.md](./references/switching_tasks.md) before executing.

### 4. Logging Daily Work

**When to use:** Recording work done today (or another date), usually generated from git commits. Includes a known issue with `log_work.cjs`'s duplicate detection — read the reference before choosing an approach.

Read [references/logging_work.md](./references/logging_work.md) before executing.

### 5. Archiving Tasks

**When to use:** Marking a task complete or abandoned.

Read [references/archiving_tasks.md](./references/archiving_tasks.md) before executing.

### 6. Weekly Summary

**When to use:** Run on `compose weekly` to add or refresh the "Last Week:" / "This week:" banner at the top of the current week's section.

Read [references/weekly_summary.md](./references/weekly_summary.md) before executing.

## Best Practices

1. **Always format after editing**: Run `format_worklog.cjs` after any manual edits, or let your editor auto-format using `.prettierrc.js` in the skill root
2. **Keep summaries concise**: Task summaries should fit comfortably in branch names (~50 chars)
3. **Log work daily**: Regular logging makes weekly summaries more accurate
4. **Clean git history**: Ensure working directory is clean before switching tasks
5. **Use descriptive commits**: Better commit messages generate better work logs

## Formatting

Code-diary uses Prettier for consistent markdown formatting. The configuration is stored in `.prettierrc.js` at the skill root, which means:

- Your editor can automatically detect and apply formatting
- The `format_worklog.cjs` script uses the same configuration
- Consistent formatting across manual edits and automated updates

**Editor setup:** Most editors with Prettier support will automatically detect `.prettierrc.js` and format markdown files on save.
