# OKR Tracking

**When to use:** Creating a new period's OKRs, mapping a task to a KR (during Workflow 2, Adding New Tasks), recording a completed KR contribution (during Workflow 5, Archiving Tasks), or checking progress toward a KR.

**Why this exists:** OKRs are reported on periodically, and the fastest way to answer "what's our progress on KR2?" is to read one file rather than re-scanning every task across every project. So each KR's own file section carries a live checklist of the tasks mapped to it — task-adding appends an unchecked line, task-archiving checks it off with a date. Progress is always derivable from the OKR file alone.

## Storage

OKRs are **global**, not per-project — an Objective/KR typically spans more than one repo (or isn't tied to a repo at all, e.g. "establish a feedback loop process"). They live at:

```
<worklogsPath>/
└── okrs/
    ├── 2026-h2.md
    └── 2027-h1.md
```

One file per period. Periods accumulate — never edit a past period's Objectives/KRs/Metrics after the fact (only its "Linked tasks" checklists change, via linking/completing). Naming: `<year>-h<half>.md`, lowercase, matching the `logs/YYYY-MM.md` convention already used for worklogs.

## File shape

```markdown
---
period: 2026-H2
start: 2026-07-01
end: 2026-12-31
---

# 2026-H2 OKRs

## O1: Secure Mobility's future by making it ready to converge into the Fabric system.

### KR2: Deprecate ui-commons in the UMR portal. <!-- okr-id: 2026H2-KR2 -->

**Metric:** Zero ui-commons dependencies remaining in the UMR portal.

**Linked tasks:**

- [ ] LTEF-7289 (mobility) — Vendor Layouts module into umr
- [x] LTEF-7288 (mobility, done 2026-08-25) — Vendor InfoTooltip into umr
```

Notes on the shape:

- The `<!-- okr-id: ... -->` comment on each `### KR` heading is the stable identifier scripts key off — format is `<PERIOD-NO-DASH>-KR<N>` (e.g. `2026H2-KR2`), keeping the same KR number the org already uses so people can cross-reference by ear.
- KR numbers are **not** renumbered per-Objective — carry over whatever numbering the source OKR doc already uses (e.g. Objective 1 owning KR2, Objective 2 owning KR3/KR4 is normal, not a gap to "fix").
- Every KR must have a `**Linked tasks:**` block, even if empty (use the literal placeholder line `(none yet)`) — the scripts require it to exist to know where to insert.
- A KR with zero linked tasks yet is not a problem to flag; not every KR maps to code-diary-tracked work (e.g. a KR about a team process might only ever get one linked task, or none if it's tracked entirely outside this system).

## Creating a new period

When starting a new half (e.g. the user gives you a 2027-H1 OKR list), create `<worklogsPath>/okrs/2027-h1.md` from `assets/okr_template.md`, filling in every Objective → KR → Metric the user gives you. Don't wait for a task to exist first — the file should hold the full expected KR set for the period even before any task links to it.

## Linking a task to a KR (Workflow 2 hook)

A task maps to **zero to many** KRs — most tasks won't have any, and that's the normal case; only ask/annotate when the task obviously advances one of the current period's stated Metrics. After creating the task file per `adding_tasks.md`:

1. Run `scripts/list_okrs.cjs` to see the current KRs (id, objective, title, metric).
2. If the task clearly maps to one or more, set the task's frontmatter `okrs: [<id>, ...]` (empty list `[]` if none — this field is always present, mirroring how `branches` is always present).
3. For each id in `okrs:`, run:
   ```bash
   node scripts/link_okr_task.cjs --okr-id <id> --tracking-id <TRACKING_ID> --project <project> --summary "<cleaned summary, brackets stripped>"
   ```
   This appends an unchecked line to that KR's checklist.

Don't force a mapping that isn't there — a task file with `okrs: []` is the expected default, not a gap to fill in.

## Completing a KR contribution (Workflow 5 hook)

After moving the task to `archived/` per `archiving_tasks.md`:

1. Read the task's frontmatter `okrs:` list.
2. For each id, run:
   ```bash
   node scripts/complete_okr_task.cjs --okr-id <id> --tracking-id <TRACKING_ID> --date <archive-date>
   ```
   This finds the existing unchecked line and checks it off with the date.
3. If the task predates being mapped to any KR (no `okrs:` field, or the id has no existing line — a backfill scenario), pass `--project`/`--summary` too; the script appends a new already-checked line instead of erroring.

## Checking progress

```bash
node scripts/okr_progress.cjs <okr-id>
```

Returns `{ checked, total, pct, tasks }` read straight from that KR's checklist — no need to open task files. For a report across a whole Objective, call it once per KR id (`list_okrs.cjs` gives you the ids) and combine.
