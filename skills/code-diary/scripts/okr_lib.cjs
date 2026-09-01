#!/usr/bin/env node

/**
 * Shared parsing/mutation helpers for OKR period files.
 *
 * An OKR file (`<worklogsPath>/okrs/<period>.md`) holds a fixed
 * Objective -> KR -> Metric hierarchy for one period (e.g. `2026-h2.md`).
 * Each KR heading carries a stable `<!-- okr-id: ... -->` anchor and owns a
 * "**Linked tasks:**" checklist that task add/archive hooks mutate in place,
 * so progress can be read straight off the OKR file without cross-referencing
 * task files.
 */

const fs = require('fs');
const path = require('path');
const { getWorklogsPath } = require('./config.cjs');

const OKR_HEADING_RE = /^###\s+KR(\d+):\s*(.+?)\s*<!--\s*okr-id:\s*(\S+)\s*-->\s*$/;
const OBJECTIVE_HEADING_RE = /^##\s+O(\d+):\s*(.+)$/;
const METRIC_RE = /^\*\*Metric:\*\*\s*(.+)$/;
const LINKED_TASKS_RE = /^\*\*Linked tasks:\*\*\s*$/;
const TASK_LINE_RE = /^- \[( |x)\]\s+(\S+)\s+\(([^)]*)\)\s+—\s+(.*)$/;
const PLACEHOLDER_LINE = '(none yet)';

function getOkrsDir() {
  return path.join(getWorklogsPath(), 'okrs');
}

function listOkrFiles() {
  const dir = getOkrsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => path.join(dir, f));
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf-8').split('\n');
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Locate a KR's heading + Linked-tasks checklist block within a file's lines.
 * Returns null if the okr-id isn't in this file.
 */
function findKrBlock(lines, krId) {
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(OKR_HEADING_RE);
    if (m && m[3] === krId) {
      headingIndex = i;
      break;
    }
  }
  if (headingIndex === -1) return null;

  let linkedTasksIndex = -1;
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    if (/^###?\s/.test(lines[i]) && i !== headingIndex) break; // next heading, no block found
    if (LINKED_TASKS_RE.test(lines[i])) {
      linkedTasksIndex = i;
      break;
    }
  }
  if (linkedTasksIndex === -1) {
    throw new Error(
      `KR ${krId} has no "**Linked tasks:**" block — the OKR template requires one per KR`,
    );
  }

  // First non-blank line after the header is the block's content start.
  let blockStart = linkedTasksIndex + 1;
  while (blockStart < lines.length && lines[blockStart].trim() === '') {
    blockStart += 1;
  }

  let blockEnd = blockStart; // exclusive end (first line NOT part of the block)
  const isPlaceholder = lines[blockStart] && lines[blockStart].trim() === PLACEHOLDER_LINE;
  if (isPlaceholder) {
    blockEnd = blockStart + 1;
  } else {
    while (blockEnd < lines.length && TASK_LINE_RE.test(lines[blockEnd])) {
      blockEnd += 1;
    }
  }

  return { headingIndex, linkedTasksIndex, blockStart, blockEnd, isPlaceholder };
}

function findFileForKr(krId) {
  for (const filePath of listOkrFiles()) {
    const lines = readLines(filePath);
    if (findKrBlock(lines, krId)) return filePath;
  }
  return null;
}

function formatTaskLine({ trackingId, project, summary, done, date }) {
  const box = done ? 'x' : ' ';
  const meta = done && date ? `${project}, done ${date}` : project;
  return `- [${box}] ${trackingId} (${meta}) — ${summary}`;
}

/**
 * Append an unchecked (or checked, for backfills) task line under a KR.
 * Throws if the KR id doesn't exist in any OKR file.
 */
function linkTask({ krId, trackingId, project, summary, done = false, date = null }) {
  const filePath = findFileForKr(krId);
  if (!filePath) {
    throw new Error(`No OKR file contains KR id "${krId}"`);
  }
  const lines = readLines(filePath);
  const block = findKrBlock(lines, krId);
  const newLine = formatTaskLine({ trackingId, project, summary, done, date });

  if (block.isPlaceholder) {
    lines.splice(block.blockStart, 1, newLine);
  } else {
    lines.splice(block.blockEnd, 0, newLine);
  }
  writeLines(filePath, lines);
  return filePath;
}

/**
 * Mark an existing linked-task line complete. If the tracking id was never
 * linked at creation time (task predates being mapped to this KR), append a
 * fresh checked line instead of failing — the goal is the OKR file always
 * ending up an accurate, self-contained progress record.
 */
function completeTask({ krId, trackingId, project, summary, date }) {
  const filePath = findFileForKr(krId);
  if (!filePath) {
    throw new Error(`No OKR file contains KR id "${krId}"`);
  }
  const lines = readLines(filePath);
  const block = findKrBlock(lines, krId);

  for (let i = block.blockStart; i < block.blockEnd; i += 1) {
    const m = lines[i].match(TASK_LINE_RE);
    if (m && m[2] === trackingId) {
      const [, , , meta, existingSummary] = m;
      const proj = meta.split(',')[0].trim();
      lines[i] = formatTaskLine({
        trackingId,
        project: proj,
        summary: existingSummary,
        done: true,
        date,
      });
      writeLines(filePath, lines);
      return { filePath, appended: false };
    }
  }

  // Not previously linked — append a new checked line (backfill case).
  if (!project || !summary) {
    throw new Error(
      `KR ${krId} has no existing line for ${trackingId}, and no project/summary was given to backfill one`,
    );
  }
  const newBlock = findKrBlock(lines, krId); // recompute in case nothing changed above
  const newLine = formatTaskLine({ trackingId, project, summary, done: true, date });
  if (newBlock.isPlaceholder) {
    lines.splice(newBlock.blockStart, 1, newLine);
  } else {
    lines.splice(newBlock.blockEnd, 0, newLine);
  }
  writeLines(filePath, lines);
  return { filePath, appended: true };
}

function getProgress(krId) {
  const filePath = findFileForKr(krId);
  if (!filePath) {
    throw new Error(`No OKR file contains KR id "${krId}"`);
  }
  const lines = readLines(filePath);
  const block = findKrBlock(lines, krId);

  if (block.isPlaceholder) {
    return { krId, checked: 0, total: 0, pct: null, tasks: [] };
  }

  const tasks = [];
  for (let i = block.blockStart; i < block.blockEnd; i += 1) {
    const m = lines[i].match(TASK_LINE_RE);
    if (m) {
      tasks.push({ trackingId: m[2], meta: m[3], summary: m[4], done: m[1] === 'x' });
    }
  }
  const checked = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total === 0 ? null : Math.round((checked / total) * 1000) / 10;
  return { krId, checked, total, pct, tasks };
}

/**
 * List every KR across every OKR file, with its Objective text and metric,
 * for surfacing "which KR does this task map to?" choices.
 */
function listKrs() {
  const results = [];
  for (const filePath of listOkrFiles()) {
    const lines = readLines(filePath);
    let currentObjective = null;
    for (let i = 0; i < lines.length; i += 1) {
      const oMatch = lines[i].match(OBJECTIVE_HEADING_RE);
      if (oMatch) {
        currentObjective = oMatch[2].trim();
        continue;
      }
      const krMatch = lines[i].match(OKR_HEADING_RE);
      if (krMatch) {
        let metric = null;
        for (let j = i + 1; j < lines.length && !/^###?\s/.test(lines[j]); j += 1) {
          const metricMatch = lines[j].match(METRIC_RE);
          if (metricMatch) {
            metric = metricMatch[1].trim();
            break;
          }
        }
        results.push({
          id: krMatch[3],
          title: krMatch[2].trim(),
          objective: currentObjective,
          metric,
          file: path.basename(filePath),
        });
      }
    }
  }
  return results;
}

module.exports = {
  getOkrsDir,
  listOkrFiles,
  findKrBlock,
  findFileForKr,
  linkTask,
  completeTask,
  getProgress,
  listKrs,
};
