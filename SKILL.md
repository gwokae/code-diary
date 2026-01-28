---
name: code-diary
description: Developer task management and work logging system. Use when managing development tasks (add, switch, archive), tracking work progress, logging daily work with git commits, or generating weekly summaries. Integrates with JIRA/GitHub issue trackers and git workflows. Triggers include "add task", "switch to task", "start task", "log work", "log daily work", "weekly summary", "archive task".
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

**Example:**
```bash
cd ~/workspace/my-project
# All code-diary commands now use "my-project" project configuration
```

If project detection fails, available projects are listed for manual selection.

## Project Setup

Each project requires a configuration file at `~/.claude/worklogs/<project-name>/project.json`:

```json
{
  "name": "project-name",
  "issueTracker": {
    "type": "jira",
    "baseUrl": "https://example.atlassian.net",
    "projectPrefix": "PROJ"
  },
  "repository": {
    "mainBranch": "main",
    "featureBranchRule": "feat/{filename}"
  }
}
```

For detailed configuration options, see `references/project_config.md`.

## Directory Structure

Code-diary uses a hybrid structure:
- **Tasks**: Project-specific (organized by project)
- **Worklogs**: Global (unified across all projects)

```
~/.claude/worklogs/
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

This allows unified daily logging across all projects while keeping tasks organized by project.

## Core Workflows

### 1. Adding New Tasks

**Input formats:**

Multi-line with tracking ID:
```
PROJ-123
Dashboard Automations Triggers - Sensors
```

One-liner with tracking ID:
```
PROJ-123 Dashboard Automations Triggers - Sensors
```

Without tracking ID (auto-generates date-based ID):
```
Dashboard Automations Triggers - Sensors
```

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Parse input using `scripts/parse_task_input.cjs`
3. For each task:
   - Generate filename using `scripts/generate_filename.cjs`
   - Create task file from `assets/task_template.md` in `~/.claude/worklogs/<project>/tasks/new/`
   - Fill frontmatter:
     - `tracking_id`: From input or auto-generated (YYYYMMDD format)
     - `summary`: Task summary
     - `status`: "new"
     - `branch`: Generated from filename using project's `featureBranchRule`
     - `created`: Current ISO datetime with timezone
     - `project`: Auto-detected project name
   - Add task to current week's "This Week" section in worklog
4. Format files with `scripts/format_worklog.cjs`

**Output:** Confirm tasks created with filenames and locations.

### 2. Switching Tasks

**Input:** Tracking ID (with or without prefix) or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs`
   - If not found, ask to create new task
   - If multiple matches, prompt user to select

3. Before switching (if current task exists):
   - Check for uncommitted changes or untracked files
   - If found, ask whether to stash changes
   - Prompt for work log entry before switching (optional)

4. Move task file to `working/` status if not already there

5. Update task frontmatter status to "working"

6. Git workflow:
   - Ensure working directory is clean
   - Check if branch exists:
     - If exists: Switch to branch
     - If not exists:
       - Switch to main branch
       - Pull latest changes
       - Create new branch from main

7. Format task file with `scripts/format_worklog.cjs`

**Output:** `Task <filename> switched to <branch-name>`

**Rework branches:**
If reopening/reworking a task on a different branch:
- Format: `<tracking-id>_<rework-summary>_<rework-count>`
- Increment rework count for each iteration

### 3. Logging Daily Work

**Input:**
- Date (optional, defaults to today via `date` command)
- Work description (or auto-generate from git commits)

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Determine date using `scripts/get_week_info.cjs`

3. Find or create monthly worklog file:
   - Path: `~/.claude/worklogs/logs/<YYYY-MM>.md` (global worklog)
   - If new, create from `assets/worklog_template.md`
   - Use `get_week_info.cjs` to populate headers

4. Ensure h2 week header exists (ordered desc by week number)

5. Ensure h3 daily header exists under correct week (ordered desc by date)

6. Ensure task entry exists in first-level list:
   - Format: `- <tracking-id>: <summary>`

7. Add work content as second-level list items under task entry

8. To auto-generate work content from commits:
   - Read recent git commits
   - Parse commit messages and diffs
   - Generate concise, meaningful bullet points

9. Format worklog with `scripts/format_worklog.cjs`

**Worklog structure:**
```markdown
---
month: 2026-01
---

# January 2026

## Week 5

Last Week:
- PROJ-123: Dashboard Automations
- PROJ-124: Air Quality Sensor

This Week:
- PROJ-125: UC-Presence Support

### Wed, Jan 28, 2026

- PROJ-123: Dashboard Automations
  - Implemented sensor time range selector
  - Added validation for date ranges
  - Fixed timezone handling bug
- PROJ-124: Air Quality Sensor
  - Defined TypeScript interfaces
  - Added unit tests
```

### 4. Archiving Tasks

**Input:** Tracking ID or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs`
3. Move task file from current status to `archived/`
4. Update task frontmatter status to "archived"
5. Format task file with `scripts/format_worklog.cjs`

**Output:** Confirm task archived with filename.

### 5. Weekly Summary

**Input:** Date (optional, defaults to today)

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Determine date and week using `scripts/get_week_info.cjs`

3. Find monthly worklog file for the date

4. Locate the week header

5. Compose "Last Week" section:
   - Collect all daily work entries from previous 7 days
   - Extract unique tracking IDs and summaries
   - Format: `- <tracking-id>: <summary>`
   - Remove duplicates

6. Keep existing "This Week" section (populated when adding tasks)

7. Format worklog with `scripts/format_worklog.cjs`

**Output:** Display weekly summary content.

## Helper Scripts

All scripts are in `scripts/` directory:

- **`get_current_project.cjs`**: Detect current project from working directory
  - Usage: `node get_current_project.cjs [working-directory]`
  - Output: JSON object with project config and paths
  - Strategies: directory name → git remote → list available projects

- **`format_worklog.cjs`**: Format markdown files with prettier
  - Usage: `node format_worklog.cjs <file-path>`

- **`generate_filename.cjs`**: Generate kebab-cased filenames
  - Usage: `node generate_filename.cjs [--tracking-id ID] <summary>`

- **`parse_task_input.cjs`**: Parse task input formats
  - Usage: `node parse_task_input.cjs <input-text>`
  - Output: JSON array of tasks

- **`find_task.cjs`**: Search for task files
  - Usage: `node find_task.cjs <tasks-path> <search-term>`
  - Output: JSON array of matching tasks
  - Note: Use project's `tasksPath` from `get_current_project.cjs`

- **`get_week_info.cjs`**: Get week numbers and date ranges
  - Usage: `node get_week_info.cjs [date]`
  - Output: JSON object with week info

## Best Practices

1. **Always format after editing**: Run `format_worklog.cjs` after any manual edits
2. **Keep summaries concise**: Task summaries should fit comfortably in branch names (~50 chars)
3. **Log work daily**: Regular logging makes weekly summaries more accurate
4. **Clean git history**: Ensure working directory is clean before switching tasks
5. **Use descriptive commits**: Better commit messages generate better work logs
