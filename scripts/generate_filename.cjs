#!/usr/bin/env node

/**
 * Generate kebab-cased filename from summary
 * Usage: node generate_filename.cjs [--tracking-id ID] <summary>
 *
 * Examples:
 *   node generate_filename.cjs "Dashboard Automations Triggers"
 *   // Output: 20260128_dashboard-automations-triggers
 *
 *   node generate_filename.cjs --tracking-id PROJ-123 "Dashboard Automations Triggers"
 *   // Output: PROJ-123_dashboard-automations-triggers
 */

function toKebabCase(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

function generateFilename(summary, trackingId = null) {
  const kebabSummary = toKebabCase(summary);

  // Limit summary length to reasonable branch name size (max 50 chars for summary part)
  const truncatedSummary = kebabSummary.slice(0, 50).replace(/-$/, '');

  if (trackingId) {
    return `${trackingId}_${truncatedSummary}`;
  } else {
    // Generate date-based ID: YYYYMMDD
    const now = new Date();
    const dateId = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `${dateId}_${truncatedSummary}`;
  }
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);

  let trackingId = null;
  let summary = '';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tracking-id' && i + 1 < args.length) {
      trackingId = args[i + 1];
      i++; // Skip next arg
    } else {
      summary = args.slice(i).join(' ');
      break;
    }
  }

  if (!summary) {
    console.error(
      'Usage: node generate_filename.cjs [--tracking-id ID] <summary>',
    );
    process.exit(1);
  }

  const filename = generateFilename(summary, trackingId);
  console.log(filename);
}

module.exports = { generateFilename, toKebabCase };
