#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  normalizeWorklogSections,
  parseWorklog,
  serializeWorklog,
  validateWorklogSections,
  writeFileAtomically,
} = require('./log_work.cjs');

function parseArgs(argv) {
  const fix = argv.includes('--fix');
  const filePath = argv.find((arg) => arg !== '--fix');

  if (!filePath) {
    throw new Error('Usage: node validate_worklog.cjs [--fix] <worklog-file>');
  }

  return { filePath: path.resolve(filePath), fix };
}

function getExpectedMonth(filePath) {
  const match = path.basename(filePath).match(/^(\d{4}-\d{2})\.md$/);
  return match?.[1];
}

function validateFile(filePath, options = {}) {
  const { fix = false } = options;
  const content = fs.readFileSync(filePath, 'utf-8');
  let sections = parseWorklog(content);

  if (fix) {
    sections = normalizeWorklogSections(sections);
  }

  const errors = validateWorklogSections(sections, {
    expectedMonth: getExpectedMonth(filePath),
  });

  if (fix && errors.length === 0) {
    writeFileAtomically(filePath, serializeWorklog(sections));
  }

  return { errors, fixed: fix && errors.length === 0 };
}

if (require.main === module) {
  try {
    const { filePath, fix } = parseArgs(process.argv.slice(2));
    const result = validateFile(filePath, { fix });

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.error(`${error.code}: ${error.message}`);
      }
      process.exit(1);
    }

    console.log(`${fix ? 'Fixed and validated' : 'Validated'}: ${filePath}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { getExpectedMonth, parseArgs, validateFile };
