#!/usr/bin/env node

/**
 * Mark a linked task complete under a KR (checks the box, stamps the date).
 * If the task was never linked at creation time, appends a new checked line
 * instead of failing — --project and --summary are required as a fallback
 * for that backfill case.
 *
 * Called when a task with an `okrs:` mapping is archived.
 *
 * Usage:
 *   node complete_okr_task.cjs --okr-id 2026H2-KR2 --tracking-id LTEF-7288 \
 *     --date 2026-08-25 [--project mobility --summary "Vendor InfoTooltip into umr"]
 */

const { completeTask } = require('./okr_lib.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '').replace(/-/g, '_');
    args[key] = argv[i + 1];
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const { okr_id: krId, tracking_id: trackingId, date, project, summary } = args;

  if (!krId || !trackingId || !date) {
    console.error(
      'Usage: node complete_okr_task.cjs --okr-id <ID> --tracking-id <ID> --date <YYYY-MM-DD> [--project <name> --summary <text>]',
    );
    process.exit(1);
  }

  try {
    const { filePath, appended } = completeTask({ krId, trackingId, project, summary, date });
    console.log(
      `${appended ? 'Appended new completed entry for' : 'Marked complete:'} ${trackingId} under ${krId} in ${filePath}`,
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
