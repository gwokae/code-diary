# Switching Tasks

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

## Script reference: `find_task.cjs`

- Usage: `node find_task.cjs <tasks-path> <search-term>`
- Output: JSON array of matching tasks
- Note: Use project's `tasksPath` from `get_current_project.cjs`
