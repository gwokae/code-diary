#!/usr/bin/env node

/**
 * Auto-generate work log entries from git commits with JIRA ID detection
 *
 * Usage: node log_commits.cjs [options]
 *
 * Options:
 *   --since <date>          Start date for commits (default: yesterday)
 *   --until <date>          End date for commits (default: today)
 *   --all-branches          Search commits across all branches (current author only)
 *   --tracking-id <ID>      Force specific tracking ID (optional, auto-detects from commits)
 *   --summary <text>        Force specific summary (optional, looks up from task files)
 *   --cwd <path>            Git repository path (default: current directory)
 *
 * Examples:
 *   # Auto-detect JIRA IDs from commits (recommended)
 *   node log_commits.cjs --since "2 days ago"
 *
 *   # Search all branches for your commits
 *   node log_commits.cjs --since "2 days ago" --all-branches
 *
 *   # Force specific task (ignores JIRA IDs in commits)
 *   node log_commits.cjs \
 *     --since "2 days ago" \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations"
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logWork } = require('./log_work.cjs');
const { getWorklogsPath } = require('./config.cjs');

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    since: null,
    until: null,
    allBranches: false,
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
    } else if (arg === '--all-branches') {
      args.allBranches = true;
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
 * Get current git author name
 */
function getGitAuthor(cwd) {
  try {
    return execSync('git config user.name', {
      cwd,
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Extract JIRA ID from commit message
 */
function extractJiraId(message) {
  // Match pattern: PROJ-123, ABC-456, etc.
  const match = message.match(/\b([A-Z]+[-_]\d+)\b/);
  return match ? match[1].replace('_', '-') : null;
}

/**
 * Get commits with metadata (date, message, JIRA ID)
 */
function getCommitsWithMetadata(options) {
  const { since, until, allBranches, cwd } = options;

  // Default: yesterday to today
  const sinceDate = since || 'yesterday';
  const untilDate = until || 'now';

  // Build git log command
  let gitCmd = 'git log';

  if (allBranches) {
    const author = getGitAuthor(cwd);
    if (author) {
      gitCmd += ` --all --author="${author}"`;
    } else {
      gitCmd += ' --all';
    }
  }

  gitCmd += ` --since="${sinceDate}" --until="${untilDate}" --pretty=format:"%ad|%s" --date=short`;

  try {
    const gitLog = execSync(gitCmd, {
      cwd,
      encoding: 'utf-8',
    }).trim();

    if (!gitLog) {
      return [];
    }

    // Parse commits
    const commits = [];
    const lines = gitLog.split('\n');

    for (const line of lines) {
      const [date, message] = line.split('|');
      const jiraId = extractJiraId(message);

      commits.push({
        date,
        message,
        jiraId,
      });
    }

    return commits;
  } catch (error) {
    throw new Error(`Failed to get git commits: ${error.message}`);
  }
}

/**
 * Group commits by tracking ID and date
 */
function groupCommitsByTask(commits) {
  const grouped = {};

  for (const commit of commits) {
    const { jiraId, date, message } = commit;

    // Skip commits without JIRA ID
    if (!jiraId) continue;

    if (!grouped[jiraId]) {
      grouped[jiraId] = {};
    }

    if (!grouped[jiraId][date]) {
      grouped[jiraId][date] = [];
    }

    grouped[jiraId][date].push(message);
  }

  return grouped;
}

/**
 * Find task file and extract summary
 */
function findTaskSummary(trackingId, cwd) {
  try {
    // Detect project from cwd
    const getCurrentProject = require('./get_current_project.cjs');
    const projectInfo = getCurrentProject.getCurrentProject(cwd);

    if (!projectInfo) {
      return null;
    }

    const tasksPath = projectInfo.tasksPath;

    // Search for task file in all status directories
    const statusDirs = ['working', 'new', 'archived'];

    for (const status of statusDirs) {
      const dir = path.join(tasksPath, status);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse frontmatter to get tracking_id
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;

        const frontmatter = frontmatterMatch[1];
        const trackingIdMatch = frontmatter.match(/tracking_id:\s*['"]?([^'"'\n]+)['"]?/);
        const summaryMatch = frontmatter.match(/summary:\s*['"]?([^'"'\n]+)['"]?/);

        if (trackingIdMatch && trackingIdMatch[1] === trackingId && summaryMatch) {
          return summaryMatch[1];
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Summarize commit messages into work items
 */
function summarizeCommits(commits) {
  const workItems = [];

  for (const message of commits) {
    // Remove JIRA ID prefix
    let cleaned = message.replace(/^[A-Z]+[-_]\d+:?\s*/, '');

    // Remove common prefixes
    cleaned = cleaned
      .replace(/^(feat|fix|chore|docs|style|refactor|test|perf):\s*/i, '')
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    if (cleaned) {
      workItems.push(cleaned);
    }
  }

  return workItems;
}

/**
 * Log commits as work entries
 */
function logCommits(options) {
  const { trackingId, summary, cwd } = options;

  // Get commits with metadata
  const commits = getCommitsWithMetadata(options);

  if (commits.length === 0) {
    return {
      success: true,
      message: 'No commits found in the specified date range',
      tasks: [],
    };
  }

  // Check for commits without JIRA IDs
  const commitsWithoutJira = commits.filter(c => !c.jiraId);
  if (commitsWithoutJira.length > 0 && !trackingId) {
    console.error(`\n⚠️  Warning: Found ${commitsWithoutJira.length} commit(s) without JIRA ID, skipping:`);
    commitsWithoutJira.slice(0, 5).forEach(c => {
      console.error(`   - ${c.date}: ${c.message.substring(0, 60)}${c.message.length > 60 ? '...' : ''}`);
    });
    if (commitsWithoutJira.length > 5) {
      console.error(`   ... and ${commitsWithoutJira.length - 5} more`);
    }
    console.error('');
  }

  // If tracking ID is forced, use it for all commits
  if (trackingId && summary) {
    const commitsByDate = {};
    for (const commit of commits) {
      if (!commitsByDate[commit.date]) {
        commitsByDate[commit.date] = [];
      }
      commitsByDate[commit.date].push(commit.message);
    }

    const results = [];
    for (const [date, messages] of Object.entries(commitsByDate)) {
      const workItems = summarizeCommits(messages);

      try {
        logWork({ date, trackingId, summary, workItems });
        results.push({
          date,
          commitCount: messages.length,
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
      message: `Logged commits for 1 task, ${results.length} date(s)`,
      tasks: [{ trackingId, summary, dates: results }],
    };
  }

  // Group commits by JIRA ID and date
  const grouped = groupCommitsByTask(commits);

  if (Object.keys(grouped).length === 0) {
    return {
      success: true,
      message: 'No commits with JIRA IDs found',
      tasks: [],
    };
  }

  // Process each task
  const taskResults = [];

  for (const [jiraId, dateGroups] of Object.entries(grouped)) {
    // Find task summary
    const taskSummary = findTaskSummary(jiraId, cwd);

    if (!taskSummary) {
      console.error(`⚠️  Warning: Could not find task file for ${jiraId}, skipping...`);
      continue;
    }

    const dateResults = [];

    for (const [date, messages] of Object.entries(dateGroups)) {
      const workItems = summarizeCommits(messages);

      try {
        logWork({
          date,
          trackingId: jiraId,
          summary: taskSummary,
          workItems,
        });

        dateResults.push({
          date,
          commitCount: messages.length,
          workItems: workItems.length,
        });
      } catch (error) {
        dateResults.push({
          date,
          error: error.message,
        });
      }
    }

    taskResults.push({
      trackingId: jiraId,
      summary: taskSummary,
      dates: dateResults,
    });
  }

  return {
    success: true,
    message: `Logged commits for ${taskResults.length} task(s)`,
    tasks: taskResults,
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

module.exports = { logCommits, getCommitsWithMetadata, groupCommitsByTask, extractJiraId };
