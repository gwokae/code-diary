# Weekly Summary

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

## Script reference: `get_week_info.cjs`

- Usage: `node get_week_info.cjs [date]`
- Output: JSON object with week info
