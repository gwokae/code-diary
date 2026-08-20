# Logging Daily Work

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
5. Claude runs `validate_worklog.cjs --fix`, `format_worklog.cjs`, then `validate_worklog.cjs` without `--fix`
6. Claude verifies the entry landed and cleans up temp files with `rm -rf /tmp/code-diary`

**Summary format:**
Generate a concise technical paragraph (2-4 sentences) that describes:

- WHAT was changed and WHY
- Implementation approach and key technical decisions
- Written in present tense, third person

**Example summary:**
"This change adds an Edit action to each item in the InterfaceSelector dropdown by introducing an additionalInfo section that is only visible in the popover content. The Edit link navigates to the PAD Designer page for the corresponding panel and is implemented using Link from react-router-dom. Click handling is explicitly prevented from propagating so that selecting Edit does not trigger the dropdown's normal selection behavior or state changes, and custom styling ensures the additional info does not affect the visual active/hover state of the list item."

**IMPORTANT: Known Issue with log_work.cjs**

The `log_work.cjs` script has aggressive duplicate detection (lines 256-285) that can silently skip adding entries when it detects similar content — especially multiple work items for the same task ID on the same day, or similar-sounding descriptions. This is why the Interactive workflow above has Claude add the entry with the Edit tool directly rather than calling `log_work.cjs`: it gives full control over what gets added, no silent filtering, and lets Claude verify the entry actually landed.

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
- Repair existing week and date ordering on every write (newest first, descending)
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

## Script reference: `log_commits.cjs`

- Usage: `node log_commits.cjs [--since <date>] [--until <date>] [--all-branches] [--tracking-id <ID>] [--summary <text>] [--cwd <path>]`
- Auto-detects JIRA IDs from commit messages and branch names
- Groups commits by task and date
- Outputs metadata and diffs to `/tmp/code-diary/` for Claude to read and summarize
- Always filters by current author to avoid including other people's commits
- Looks up task summaries from existing task files
- Supports `--all-branches` to search all branches (current author only)
- Prevents duplicate logging when run multiple times
- Optional `--tracking-id` and `--summary` to force specific task for all commits

## Script reference: `log_work.cjs`

- Usage: `node log_work.cjs --tracking-id <ID> --summary <text> --work <item> [--date <YYYY-MM-DD>]`
- Automatically handles date formatting (YYYY/MM/DD) and ordering (descending)
- Creates properly structured worklog entries with correct week/day headers
- Formats output with prettier

## Script reference: `validate_worklog.cjs`

- Check: `node validate_worklog.cjs <worklog-file>`
- Repair and check: `node validate_worklog.cjs --fix <worklog-file>`
- Enforces unique, descending week headers; unique, descending day headers; and month/week membership
- Run with `--fix` before formatting and without it afterward so structural errors fail visibly
