# Adding New Tasks

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

## Script reference: `parse_task_input.cjs`

- Usage: `node parse_task_input.cjs <input-text>`
- Output: JSON array of tasks

## Script reference: `generate_filename.cjs`

- Usage: `node generate_filename.cjs [--tracking-id ID] <summary>`
- Generates kebab-cased filenames
