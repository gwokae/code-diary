#!/usr/bin/env node

/**
 * Report progress for one KR (checked/total + %), read straight off the
 * OKR file's own checklist — no cross-referencing task files needed.
 *
 * Usage: node okr_progress.cjs <okr-id>
 */

const { getProgress } = require('./okr_lib.cjs');

if (require.main === module) {
  const krId = process.argv[2];
  if (!krId) {
    console.error('Usage: node okr_progress.cjs <okr-id>');
    process.exit(1);
  }

  try {
    const progress = getProgress(krId);
    console.log(JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
