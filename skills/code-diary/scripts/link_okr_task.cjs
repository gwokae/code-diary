#!/usr/bin/env node

/**
 * Append an unchecked task line under a KR's "Linked tasks" checklist.
 * Called when a new task is created with an `okrs:` mapping.
 *
 * Usage:
 *   node link_okr_task.cjs --okr-id 2026H2-KR2 --tracking-id LTEF-7361 \
 *     --project mobility --summary "Time format support"
 */

const { linkTask } = require('./okr_lib.cjs');

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
  const { okr_id: krId, tracking_id: trackingId, project, summary } = args;

  if (!krId || !trackingId || !project || !summary) {
    console.error(
      'Usage: node link_okr_task.cjs --okr-id <ID> --tracking-id <ID> --project <name> --summary <text>',
    );
    process.exit(1);
  }

  try {
    const filePath = linkTask({ krId, trackingId, project, summary });
    console.log(`Linked ${trackingId} under ${krId} in ${filePath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
