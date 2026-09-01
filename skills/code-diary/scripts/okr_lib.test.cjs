const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  linkTask,
  completeTask,
  getProgress,
  listKrs,
} = require('./okr_lib.cjs');

const SAMPLE_OKR = `---
period: 2026-H2
start: 2026-07-01
end: 2026-12-31
---

# 2026-H2 OKRs

## O1: Secure Mobility's future by making it ready to converge into the Fabric system.

### KR2: Deprecate ui-commons in the UMR portal. <!-- okr-id: 2026H2-KR2 -->

**Metric:** Zero ui-commons dependencies remaining in the UMR portal.

**Linked tasks:**

(none yet)

## O2: Ensure the product matches the latest guidelines.

### KR3: UI consistency with other product lines. <!-- okr-id: 2026H2-KR3 -->

**Metric:** UI consistency checks all match.

**Linked tasks:**

(none yet)
`;

function withTempWorklogs(t, initialFiles) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-diary-okr-test-'));
  const okrsDir = path.join(directory, 'okrs');
  fs.mkdirSync(okrsDir, { recursive: true });
  for (const [name, content] of Object.entries(initialFiles)) {
    fs.writeFileSync(path.join(okrsDir, name), content);
  }
  const previousEnv = process.env.CODE_DIARY_PATH;
  process.env.CODE_DIARY_PATH = directory;
  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    if (previousEnv === undefined) delete process.env.CODE_DIARY_PATH;
    else process.env.CODE_DIARY_PATH = previousEnv;
  });
  return { directory, okrFile: (name) => path.join(okrsDir, name) };
}

test('listKrs extracts id, objective, title, and metric across multiple KRs/objectives', (t) => {
  const { okrFile } = withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  const krs = listKrs();
  assert.equal(krs.length, 2);
  assert.deepEqual(krs[0], {
    id: '2026H2-KR2',
    title: 'Deprecate ui-commons in the UMR portal.',
    objective: "Secure Mobility's future by making it ready to converge into the Fabric system.",
    metric: 'Zero ui-commons dependencies remaining in the UMR portal.',
    file: '2026-h2.md',
  });
  assert.equal(krs[1].objective, 'Ensure the product matches the latest guidelines.');
  void okrFile;
});

test('linkTask replaces the "(none yet)" placeholder with the first task', (t) => {
  const { okrFile } = withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  linkTask({
    krId: '2026H2-KR2',
    trackingId: 'LTEF-7289',
    project: 'mobility',
    summary: 'Vendor Layouts module into umr',
  });
  const content = fs.readFileSync(okrFile('2026-h2.md'), 'utf8');
  assert.match(content, /- \[ \] LTEF-7289 \(mobility\) — Vendor Layouts module into umr/);
  assert.doesNotMatch(content, /\(none yet\)\n\n### KR2/s);
});

test('linkTask appends after existing tasks without disturbing them', (t) => {
  const { okrFile } = withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  linkTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7289', project: 'mobility', summary: 'First' });
  linkTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7290', project: 'mobility', summary: 'Second' });
  const content = fs.readFileSync(okrFile('2026-h2.md'), 'utf8');
  const firstIndex = content.indexOf('LTEF-7289');
  const secondIndex = content.indexOf('LTEF-7290');
  assert.ok(firstIndex > -1 && secondIndex > firstIndex);
  // KR3's own placeholder must be untouched
  assert.match(content, /### KR3:[\s\S]*\(none yet\)/);
});

test('completeTask checks off an existing line and stamps the date', (t) => {
  const { okrFile } = withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  linkTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7288', project: 'mobility', summary: 'Vendor InfoTooltip into umr' });
  const { appended } = completeTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7288', date: '2026-08-25' });
  assert.equal(appended, false);
  const content = fs.readFileSync(okrFile('2026-h2.md'), 'utf8');
  assert.match(content, /- \[x\] LTEF-7288 \(mobility, done 2026-08-25\) — Vendor InfoTooltip into umr/);
});

test('completeTask backfills a new checked line when the task was never linked', (t) => {
  const { okrFile } = withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  const { appended } = completeTask({
    krId: '2026H2-KR2',
    trackingId: 'LTEF-7272',
    project: 'mobility',
    summary: 'Inventory ui-commons usage',
    date: '2026-09-01',
  });
  assert.equal(appended, true);
  const content = fs.readFileSync(okrFile('2026-h2.md'), 'utf8');
  assert.match(content, /- \[x\] LTEF-7272 \(mobility, done 2026-09-01\) — Inventory ui-commons usage/);
});

test('completeTask throws when backfilling without project/summary', (t) => {
  withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  assert.throws(() => completeTask({ krId: '2026H2-KR2', trackingId: 'LTEF-9999', date: '2026-09-01' }));
});

test('getProgress reports 0/0 for an empty (placeholder) KR and counts correctly once populated', (t) => {
  withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  const empty = getProgress('2026H2-KR2');
  assert.deepEqual(empty, { krId: '2026H2-KR2', checked: 0, total: 0, pct: null, tasks: [] });

  linkTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7289', project: 'mobility', summary: 'A' });
  linkTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7290', project: 'mobility', summary: 'B' });
  completeTask({ krId: '2026H2-KR2', trackingId: 'LTEF-7289', date: '2026-09-01' });

  const progress = getProgress('2026H2-KR2');
  assert.equal(progress.checked, 1);
  assert.equal(progress.total, 2);
  assert.equal(progress.pct, 50);
});

test('linkTask throws a clear error for an unknown okr id', (t) => {
  withTempWorklogs(t, { '2026-h2.md': SAMPLE_OKR });
  assert.throws(
    () => linkTask({ krId: '2026H2-KR99', trackingId: 'LTEF-1', project: 'mobility', summary: 'x' }),
    /No OKR file contains KR id "2026H2-KR99"/,
  );
});
