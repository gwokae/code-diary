const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  normalizeWorklogSections,
  parseWorklog,
  serializeWorklog,
  validateWorklogSections,
} = require('./log_work.cjs');

const OUT_OF_ORDER_WORKLOG = `# 2026/08 Contribution log

## Week 32

### 2026/08/07

- LTEF-32: Older work
  - Preserves older work.

## Week 34

Last Week:

- LTEF-31: Previous work

This week:

- LTEF-34: Current work

### 2026/08/17

- LTEF-17: Sunday work
  - Preserves Sunday work.

### 2026/08/20

- LTEF-20: Thursday work
  - Preserves Thursday work.

### 2026/08/19

- LTEF-19: Wednesday work
  - Preserves Wednesday work.

## Week 33

### 2026/08/14

- LTEF-33: Middle work
  - Preserves middle work.
`;

test('normalizes existing week and day sections in descending order', () => {
  const normalized = normalizeWorklogSections?.(
    parseWorklog(OUT_OF_ORDER_WORKLOG),
  );
  const weeks = normalized?.filter((section) => section.type === 'week');

  assert.deepEqual(
    weeks?.map((week) => week.weekNumber),
    [34, 33, 32],
  );
  assert.deepEqual(
    weeks?.[0].days.map((day) => day.date),
    ['2026/08/20', '2026/08/19', '2026/08/17'],
  );
});

test('reports ordering errors before normalization and none afterward', () => {
  const parsed = parseWorklog(OUT_OF_ORDER_WORKLOG);
  const before = validateWorklogSections?.(parsed, {
    expectedMonth: '2026-08',
  });
  const after = validateWorklogSections?.(normalizeWorklogSections?.(parsed), {
    expectedMonth: '2026-08',
  });

  assert.equal(
    before?.some((error) => error.code === 'WEEK_ORDER'),
    true,
  );
  assert.equal(
    before?.some((error) => error.code === 'DAY_ORDER'),
    true,
  );
  assert.deepEqual(after, []);
});

test('serialization preserves weekly summaries and task content', () => {
  const normalized = normalizeWorklogSections?.(
    parseWorklog(OUT_OF_ORDER_WORKLOG),
  );
  const output = serializeWorklog?.(normalized);

  assert.match(output, /Last Week:\n\n- LTEF-31: Previous work/);
  assert.match(output, /This week:\n\n- LTEF-34: Current work/);
  assert.match(output, /- LTEF-20: Thursday work/);
  assert.ok(output.indexOf('## Week 34') < output.indexOf('## Week 33'));
  assert.ok(output.indexOf('## Week 33') < output.indexOf('## Week 32'));
});

test('validate_worklog --fix repairs a file and --check accepts it', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-diary-test-'));
  const file = path.join(directory, '2026-08.md');
  const script = path.join(__dirname, 'validate_worklog.cjs');
  fs.writeFileSync(file, OUT_OF_ORDER_WORKLOG);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const fix = spawnSync(process.execPath, [script, '--fix', file], {
    encoding: 'utf8',
  });
  assert.equal(fix.status, 0, fix.stderr);

  const check = spawnSync(process.execPath, [script, file], {
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stderr);

  const repaired = fs.readFileSync(file, 'utf8');
  assert.ok(repaired.indexOf('## Week 34') < repaired.indexOf('## Week 33'));
  assert.ok(repaired.indexOf('## Week 33') < repaired.indexOf('## Week 32'));
});

test('validate_worklog --fix leaves files with unfixable errors unchanged', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-diary-test-'));
  const file = path.join(directory, '2026-08.md');
  const script = path.join(__dirname, 'validate_worklog.cjs');
  const invalidWorklog = `${OUT_OF_ORDER_WORKLOG}\n## Week 34\n\n### 2026/07/31\n`;
  fs.writeFileSync(file, invalidWorklog);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const fix = spawnSync(process.execPath, [script, '--fix', file], {
    encoding: 'utf8',
  });

  assert.notEqual(fix.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), invalidWorklog);
});
