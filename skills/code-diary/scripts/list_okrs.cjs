#!/usr/bin/env node

/**
 * List every KR across all OKR period files, with Objective text and metric.
 * Used when adding a task to offer "which KR(s) does this map to?" choices.
 *
 * Usage: node list_okrs.cjs
 */

const { listKrs } = require('./okr_lib.cjs');

if (require.main === module) {
  const krs = listKrs();
  if (krs.length === 0) {
    console.log('No OKR files found');
  } else {
    console.log(JSON.stringify(krs, null, 2));
  }
}
