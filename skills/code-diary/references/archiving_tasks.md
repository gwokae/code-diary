# Archiving Tasks

**Input:** Tracking ID or task summary keywords

**Process:**

1. Detect current project using `scripts/get_current_project.cjs`
2. Find task using `scripts/find_task.cjs` (see [switching_tasks.md](./switching_tasks.md) for usage)
3. Move task file from current status to `archived/`
4. Update task frontmatter status to "archived"
5. Format task file with `scripts/format_worklog.cjs`
6. Refresh the current week's "This week:" banner by running Workflow 6 (`compose weekly`) — archiving removes the task from `working/`/`new/`, so the banner would otherwise still show it as active.

**Output:** Confirm task archived with filename.
