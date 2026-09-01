# Archiving Tasks

**Input:** Tracking ID or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs` (see [switching_tasks.md](./switching_tasks.md) for usage)
3. Move task file from current status to `archived/`
4. Update task frontmatter status to "archived"
5. If the task's frontmatter has a non-empty `okrs:` list, run `scripts/complete_okr_task.cjs --okr-id <id> --tracking-id <TRACKING_ID> --date <today>` for each id (see [okr_tracking.md](./okr_tracking.md)) — this checks off that KR's linked-task line so progress stays readable straight from the OKR file.
6. Format task file with `scripts/format_worklog.cjs`
7. Refresh the current week's "This week:" banner by running Workflow 6 (`compose weekly`) — archiving removes the task from `working/`/`new/`, so the banner would otherwise still show it as active.

**Output:** Confirm task archived with filename.
