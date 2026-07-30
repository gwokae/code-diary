# Split code-diary SKILL.md into per-workflow reference files

`skills/code-diary/SKILL.md` had grown to 575 lines, over skill-creator's ~500-line guideline for a SKILL.md body — which stays in context on every trigger of the skill, regardless of which workflow is actually being run. We split each of the 6 core workflows into its own `references/<workflow>.md` file, leaving `SKILL.md` as a thin index (trigger description + pointer per workflow). Content was relocated, not cut: the git squash-merge branching rules and the `log_work.cjs` duplicate-detection caveat, both written after real incidents, are preserved verbatim in their respective reference files.

## Considered Options

- **One combined `references/workflows.md`**: simpler file layout, but triggering any single workflow would still load all 6 workflows' full detail — doesn't reduce the actual context cost of running one workflow.
- **Grouped by theme** (e.g. `git-workflow.md`, `logging.md`): workflows don't map cleanly to shared themes, and it would still bundle unrelated detail together on a single trigger.
- **One file per workflow (chosen)**: each workflow's trigger loads only its own file. The two scripts used by literally every workflow (`get_current_project.cjs`, `format_worklog.cjs`) are documented once in `SKILL.md` itself instead of repeated across all 6 files.

## Consequences

`SKILL.md`'s workflow entries intentionally carry no step summary, only a trigger description and a "read this reference before executing" pointer — this avoids a second, easily-stale copy of the process steps. Editing a workflow's reference file needs no corresponding update in `SKILL.md`.
