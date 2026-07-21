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

**Example:**

```bash
cd ~/workspace/my-project
# All code-diary commands now use "my-project" project configuration
```

If project detection fails, available projects are listed for manual selection.

## Configuration

Code-diary uses a global configuration file to customize paths and settings.

### Global Configuration

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

## Project Setup

Each project requires a configuration file at `<worklogsPath>/<project-name>/project.json`:

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

### 2. Adding New Tasks

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
   - Create task file from `assets/task_template.md` in `<worklogsPath>/<project>/tasks/new/`
   - Fill frontmatter:
     - `tracking_id`: From input or auto-generated (YYYYMMDD format)
     - `summary`: Task summary
     - `status`: "new"
     - `branch`: Generated from filename using project's `featureBranchRule`
     - `created`: Current ISO datetime with timezone
     - `project`: Auto-detected project name
4. Format files with `scripts/format_worklog.cjs`
5. Refresh the current week's "This week:" banner by running Workflow 6 (`compose weekly`) — the banner is derived from `new/` + `working/`, so adding a task means the next `compose weekly` will pick it up automatically. Do not edit the worklog directly from this workflow.

**Output:** Confirm tasks created with filenames and locations.

### 3. Switching Tasks

**Input:** Tracking ID (with or without prefix) or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs`
   - If not found, ask to create new task
   - If multiple matches, prompt user to select

3. Before switching (if current task exists):
   - Check for uncommitted changes or untracked files with `git status --short`
   - **IMPORTANT**: If uncommitted changes or untracked files are found:
     - **MUST warn the user** about uncommitted changes before proceeding
     - List the modified/untracked files
     - Ask user to choose: commit changes, stash changes, or cancel
     - **Never automatically stash** without explicit user confirmation
   - Prompt for work log entry before switching (optional)

4. Move task file to `working/` status if not already there

5. Update task frontmatter status to "working"

6. Git workflow:
   - Ensure working directory is clean
   - Check if branch exists:
     - If exists: Switch to branch
     - If not exists (creating a new branch):
       - **`git fetch` first** — never branch from a stale local ref.
       - **Branch from `origin/<mainBranch>` (99% of the time
         `origin/develop`), NOT the local `develop` and NOT the currently
         checked-out branch.** Create with an explicit base, e.g.
         `git fetch && git checkout -b <new-branch> origin/develop`.
       - **If the base would be anything other than `origin/<mainBranch>`**
         (e.g. stacking on another feature branch), **STOP and prompt the
         user** to confirm the base before creating. Branching off a stale or
         unmerged feature branch is the #1 cause of avoidable merge conflicts.

7. Format task file with `scripts/format_worklog.cjs`

**Output:** `Task <filename> switched to <branch-name>`

**Rework branches:**
If reopening/reworking a task on a different branch:

- Format: `<tracking-id>_<rework-summary>_<rework-count>`
- Increment rework count for each iteration
- **Still branch from `origin/develop`, not the old feature branch.** See the
  squash-merge caveat below — the previous round's code is almost always
  already in `develop`, so basing the rework on `origin/develop` avoids
  re-introducing duplicate commits and the conflicts they cause.

**Squash-merge caveat — "unmerged-looking" feature branches:**
This project **squashes and rebases** feature branches on merge in GitHub.
Consequences the workflow MUST account for:

- `git branch --merged develop` will **not** list a feature branch that was
  squash-merged — its individual commits never land verbatim on `develop`. A
  branch showing as "not merged" does **NOT** mean its work is missing; the
  code is almost always already in `develop` under a single squashed commit.
- **Do not** decide "the prior work is unmerged, so I must branch off the old
  feature branch to keep it." That reasoning is what causes duplicate commits
  and large conflicts. Instead, `git fetch` and branch from `origin/develop`;
  verify the prior work is present by checking `develop`'s content/history
  (e.g. `git log origin/develop --grep <TICKET>` or inspecting the files), not
  by `git branch --merged`.
- Only preserve/rebuild prior commits when you have **confirmed the code is
  genuinely absent** from `origin/develop`.

### 4. Logging Daily Work

**Input:**

- Date (optional, defaults to today via `date` command)
- Work description (or auto-generate from git commits)

**Process:**

**Option 1: Auto-generate from git commits (recommended)**

Use `scripts/log_commits.cjs` to extract commit data for interactive summarization:

```bash
# Auto-detect JIRA IDs from commit messages
node scripts/log_commits.cjs --since "2 days ago"

# Search all branches for your commits
node scripts/log_commits.cjs --since "2 days ago" --all-branches

# Force specific task (for commits without JIRA IDs)
node scripts/log_commits.cjs \
  --since "2 days ago" \
  --tracking-id PROJ-123 \
  --summary "Dashboard Automations"
```

**Auto-detection features:**
- Extracts JIRA IDs from commit messages (e.g., "UNIFIC-10519: feat: add controls")
- Falls back to branch name extraction if commit message doesn't contain JIRA ID
- Groups commits by JIRA ID and date automatically
- Looks up task summaries from existing task files
- Warns about commits without JIRA IDs
- Supports `--all-branches` to search across all branches
- Always filters by current author to avoid including other people's commits
- Excludes merge commits (`--no-merges` flag automatically applied)

**Output:**
The script outputs structured data to temp files in `/tmp/code-diary/`:
- `<taskId>_<date>_<timestamp>_metadata.json`: Commit metadata (hashes, messages, dates)
- `<taskId>_<date>_<timestamp>_diff.txt`: Combined diff for all commits

**Interactive workflow:**
1. User runs `log_commits.cjs` from CLI
2. Script outputs temp file paths in JSON format
3. Claude reads the temp files and generates a cohesive paragraph summary
4. Claude **manually adds the entry using Edit tool** (see "Known Issue" below for why)
5. Claude runs `format_worklog.cjs` to format the file
6. Claude cleans up temp files with `rm -rf /tmp/code-diary`

**Summary format:**
Generate a concise technical paragraph (2-4 sentences) that describes:
- WHAT was changed and WHY
- Implementation approach and key technical decisions
- Written in present tense, third person

**Example summary:**
"This change adds an Edit action to each item in the InterfaceSelector dropdown by introducing an additionalInfo section that is only visible in the popover content. The Edit link navigates to the PAD Designer page for the corresponding panel and is implemented using Link from react-router-dom. Click handling is explicitly prevented from propagating so that selecting Edit does not trigger the dropdown's normal selection behavior or state changes, and custom styling ensures the additional info does not affect the visual active/hover state of the list item."

**IMPORTANT: Known Issue with log_work.cjs**

The `log_work.cjs` script has aggressive duplicate detection (lines 256-285) that can silently skip adding entries when it detects similar content. This is particularly problematic for "log contribution" workflows where:
- Multiple work items for the same task ID on the same day
- Similar work descriptions that trigger false-positive duplicate detection
- Updating entries that already exist in the worklog

**Recommended approach for "log contribution":**
1. Use `log_commits.cjs` to extract commit metadata and diffs
2. Read the temp files and generate the summary
3. **Manually add the entry using the Edit tool** instead of calling `log_work.cjs`
4. Use Edit to insert the new entry in the correct location (under the proper date header)
5. Run `format_worklog.cjs` to format the file
6. Clean up temp files with `rm -rf /tmp/code-diary`

This manual approach provides:
- Full control over what gets added
- No silent filtering or skipping of entries
- Ability to verify the entry was actually added
- More reliable for complex logging scenarios

**When to still use log_work.cjs:**
- Simple, one-off logging of clearly unique work items
- Automated scripts where duplicate detection is desired
- When you're confident the entry is new and won't be filtered

**Option 2: Manual logging with log_work.cjs**

Use `scripts/log_work.cjs` to add work entries manually:

```bash
node scripts/log_work.cjs \
  --date 2026-02-03 \
  --tracking-id PROJ-123 \
  --summary "Dashboard Automations" \
  --work "Implemented sensor time range selector" \
  --work "Added validation for date ranges"
```

Both scripts automatically:
- Ensure h2 week header exists (ordered desc by week number)
- Ensure h3 daily header exists with format `### YYYY/MM/DD`
- Maintain date ordering (newest first, descending)
- Create task entries with format `- <tracking-id>: <summary>`
- Add work items as second-level list items
- Format output with `scripts/format_worklog.cjs`

The week's "Last Week:" / "This week:" banner sections are managed by Workflow 6 (`compose weekly`), not by these per-day scripts. Run `compose weekly` whenever the active task list changes or you want to refresh the recap.

**Worklog structure:**

```markdown
---
month: 2026-01
---

# January 2026

## Week 5

### 2026/01/30

- PROJ-123: Dashboard Automations
  - Implemented sensor time range selector
  - Added validation for date ranges
  - Fixed timezone handling bug

### 2026/01/28

- PROJ-124: Air Quality Sensor
  - Defined TypeScript interfaces
  - Added unit tests
```

**Note:** Per-day logging scripts only manage the `### YYYY/MM/DD` daily entries. The "Last Week:" / "This week:" banner under `## Week N` is maintained separately by Workflow 6 (`compose weekly`).

**Note:** Daily headers use `YYYY/MM/DD` format and are ordered newest to oldest (descending).

### 5. Archiving Tasks

**Input:** Tracking ID or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs`
3. Move task file from current status to `archived/`
4. Update task frontmatter status to "archived"
5. Format task file with `scripts/format_worklog.cjs`

**Output:** Confirm task archived with filename.

### 6. Weekly Summary

**When to use:** Run on `compose weekly` to add or refresh the recap + plan banner at the top of the current week's section.

**Input:** Date (optional, defaults to today)

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Determine date and week using `scripts/get_week_info.cjs`
3. Find monthly worklog file for the date
4. Locate the week header
5. **Compose "Last Week:" section** (recap of recent work — what was DONE):
   - Look back 7 days from the given date
   - Collect daily work entries from those 7 days (across week boundaries)
   - For each tracking ID found, take its cleaned summary
   - Strip bracket prefixes from summaries (e.g. `[FE]`, `[BE]`, `[QA]`, `[FE-review]`) — they add noise in a summary list
   - Format: `- <tracking-id>: <cleaned-summary>`
   - Remove duplicates, preserve first-seen order
6. **Compose "This week:" section** (forward-looking — what's PLANNED or in progress):
   - List every task file currently in `<worklogsPath>/<project>/tasks/working/` and `<worklogsPath>/<project>/tasks/new/`
   - Read each file's frontmatter `tracking_id` and `summary`
   - Strip bracket prefixes from the summary
   - Format: `- <tracking-id>: <cleaned-summary>`
   - Sort by tracking ID for stable ordering
   - **Always emit this section.** If `working/` + `new/` are both empty, emit `This week:` with an empty bullet list so the empty backlog is visible rather than hidden by omission.
   - Exclude `archived/` tasks — those belong in "Last Week:" recap via their daily entries, not the active plan.
7. Insert both sections immediately after the `## Week N` header, before the first `### YYYY/MM/DD` entry. If the sections already exist, replace them in-place (do not duplicate).
8. Format worklog with `scripts/format_worklog.cjs`

**Output template:**

```markdown
## Week 22

Last Week:

- TICKET-123: Cleaned summary
- TICKET-124: Another summary

This week:

- TICKET-125: Active task summary
- TICKET-126: Another active task

### 2026/05/27

- ...
```

**Why both sections are mandatory:**

- "Last Week" tells the reader what shipped recently — useful for retros and standups.
- "This week" tells the reader what's on the plate now — derived from the filesystem (`new/` + `working/`) so it stays accurate without manual maintenance.
- Together they give a 1-glance answer to "what's the state of this week" at the top of the section, without scrolling through every daily entry.

**Output:** Display weekly summary content.

## Helper Scripts

All scripts are in `scripts/` directory:

- **`config.cjs`**: Manage global configuration
  - Usage: `node config.cjs <command> [args]`
  - Commands: `show`, `get <key>`, `set <key> <value>`, `path`, `init`
  - Auto-creates config on first use
  - Configurable: `worklogsPath`

- **`init_project.cjs`**: Initialize a new project configuration
  - Usage: `node init_project.cjs <project-name> [options]`
  - Options: `--auto-detect`, `--issue-tracker-type`, `--issue-tracker-url`, `--issue-tracker-prefix`, `--main-branch`, `--feature-branch-rule`
  - Creates project directory structure and configuration file

- **`get_current_project.cjs`**: Detect current project from working directory
  - Usage: `node get_current_project.cjs [working-directory]`
  - Output: JSON object with project config and paths
  - Strategies: directory name → git remote → list available projects

- **`log_work.cjs`**: Add work entries to daily worklog
  - Usage: `node log_work.cjs --tracking-id <ID> --summary <text> --work <item> [--date <YYYY-MM-DD>]`
  - Automatically handles date formatting (YYYY/MM/DD) and ordering (descending)
  - Creates properly structured worklog entries with correct week/day headers
  - Formats output with prettier

- **`log_commits.cjs`**: Extract commit data for interactive summarization
  - Usage: `node log_commits.cjs [--since <date>] [--until <date>] [--all-branches] [--tracking-id <ID>] [--summary <text>] [--cwd <path>]`
  - Auto-detects JIRA IDs from commit messages and branch names
  - Groups commits by task and date
  - Outputs metadata and diffs to `/tmp/code-diary/` for Claude to read and summarize
  - Always filters by current author to avoid including other people's commits
  - Looks up task summaries from existing task files
  - Supports `--all-branches` to search all branches (current author only)
  - Prevents duplicate logging when run multiple times
  - Optional `--tracking-id` and `--summary` to force specific task for all commits

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
