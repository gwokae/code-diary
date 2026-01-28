#!/usr/bin/env node

/**
 * Format worklog markdown files using prettier
 * Usage: node format_worklog.cjs <file-path>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function formatWorklog(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    const prettierConfig = path.join(__dirname, '../assets/.prettierrc.js');

    // Run prettier on the file
    execSync(`npx prettier --write --config "${prettierConfig}" "${filePath}"`, {
      stdio: 'inherit',
    });

    console.log(`✅ Formatted: ${filePath}`);
  } catch (error) {
    console.error(`Error formatting file: ${error.message}`);
    process.exit(1);
  }
}

// Main
if (require.main === module) {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node format_worklog.cjs <file-path>');
    process.exit(1);
  }

  formatWorklog(path.resolve(filePath));
}

module.exports = { formatWorklog };
