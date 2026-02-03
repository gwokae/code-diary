#!/usr/bin/env node

/**
 * Auto-generate work log entries from git commits
 *
 * Usage: node log_commits.cjs [options]
 *
 * Options:
 *   --since <date>        Start date for commits (default: yesterday)
 *   --until <date>        End date for commits (default: today)
 *   --tracking-id <ID>    Tracking ID to use (required)
 *   --summary <text>      Task summary (required)
 *   --cwd <path>          Git repository path (default: current directory)
 *
 * Examples:
 *   # Log today's commits
 *   node log_commits.cjs \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations"
 *
 *   # Log commits from specific date range
 *   node log_commits.cjs \
 *     --since 2026-02-01 \
 *     --until 2026-02-03 \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations"
 *
 *   # Log yesterday and today
 *   node log_commits.cjs \
 *     --since "2 days ago" \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations"
 */

const { execSync } = require('child_process');
const { logWork } = require('./log_work.cjs');

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    since: null,
    until: null,
    trackingId: null,
    summary: null,
    cwd: process.cwd(),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--since' && i + 1 < argv.length) {
      args.since = argv[++i];
    } else if (arg === '--until' && i + 1 < argv.length) {
      args.until = argv[++i];
    } else if (arg === '--tracking-id' && i + 1 < argv.length) {
      args.trackingId = argv[++i];
    } else if (arg === '--summary' && i + 1 < argv.length) {
      args.summary = argv[++i];
    } else if (arg === '--cwd' && i + 1 < argv.length) {
      args.cwd = argv[++i];
    }
  }

  return args;
}

/**
 * Get commits from git log grouped by date
 */
function getCommitsByDate(options) {
  const { since, until, cwd } = options;

  // Default: yesterday to today
  const sinceDate = since || 'yesterday';
  const untilDate = until || 'now';

  try {
    // Get commits with date and message
    const gitLog = execSync(
      `git log --since="${sinceDate}" --until="${untilDate}" --pretty=format:"%ad|%s" --date=short`,
      {
        cwd,
        encoding: 'utf-8',
      },
    ).trim();

    if (!gitLog) {
      return {};
    }

    // Group commits by date
    const commitsByDate = {};
    const lines = gitLog.split('\n');

    for (const line of lines) {
      const [date, message] = line.split('|');
      if (!commitsByDate[date]) {
        commitsByDate[date] = [];
      }
      commitsByDate[date].push(message);
    }

    return commitsByDate;
  } catch (error) {
    throw new Error(`Failed to get git commits: ${error.message}`);
  }
}

/**
 * Summarize commit messages into work items
 */
function summarizeCommits(commits) {
  const workItems = [];

  for (const message of commits) {
    // Remove common prefixes
    let cleaned = message
      .replace(/^(feat|fix|chore|docs|style|refactor|test|perf):\s*/i, '')
      .trim();

    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    workItems.push(cleaned);
  }

  return workItems;
}

/**
 * Log commits as work entries
 */
function logCommits(options) {
  const { trackingId, summary, cwd } = options;

  // Validate required fields
  if (!trackingId || !summary) {
    throw new Error(
      'Missing required fields: --tracking-id and --summary are required',
    );
  }

  // Get commits grouped by date
  const commitsByDate = getCommitsByDate(options);

  if (Object.keys(commitsByDate).length === 0) {
    return {
      success: true,
      message: 'No commits found in the specified date range',
      dates: [],
    };
  }

  const results = [];

  // Process each date
  for (const [date, commits] of Object.entries(commitsByDate)) {
    const workItems = summarizeCommits(commits);

    try {
      const result = logWork({
        date,
        trackingId,
        summary,
        workItems,
      });

      results.push({
        date,
        commitCount: commits.length,
        workItems: workItems.length,
      });
    } catch (error) {
      results.push({
        date,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: `Logged commits for ${results.length} date(s)`,
    dates: results,
    trackingId,
    summary,
  };
}

// Main
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = logCommits(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          success: false,
          error: error.message,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

module.exports = { logCommits, getCommitsByDate, summarizeCommits };
