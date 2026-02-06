#!/usr/bin/env node

/**
 * Auto-generate work log entries from git commits with JIRA ID detection
 *
 * Outputs commit metadata and diffs to temp files for interactive summarization by Claude.
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
 * Output:
 *   JSON object with temp file paths containing commit metadata and diffs.
 *   Temp files are written to /tmp/code-diary/ for Claude to read and summarize.
 *
 * Examples:
 *   # Auto-detect JIRA IDs from commits
 *   node log_commits.cjs --since "2 days ago"
 *
 *   # Search all branches for your commits
 *   node log_commits.cjs --since "2 days ago" --all-branches
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
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
 * Extract JIRA ID from commit message or branch name
 * Matches patterns: PROJ-123, ABC-456, UNIFIC_10271, etc.
 */
function extractJiraId(message) {
  // Match pattern: PROJ-123, ABC-456, UNIFIC_10271, etc.
  // Allow word boundary or non-word character before/after
  const match = message.match(/([A-Z]+[-_]\d+)/);
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

  // Always filter by current author to avoid including other people's commits
  const author = getGitAuthor(cwd);

  // Build git log command
  let gitCmd = 'git log --no-merges';

  if (allBranches) {
    gitCmd += ' --all';
  }

  // Add author filter if available
  if (author) {
    gitCmd += ` --author="${author}"`;
  }

  gitCmd += ` --since="${sinceDate}" --until="${untilDate}" --pretty=format:"%H|%ad|%s" --date=short`;

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
      const parts = line.split('|');
      const hash = parts[0];
      const date = parts[1];
      const message = parts.slice(2).join('|'); // Handle messages with | in them

      // Try to extract JIRA ID from commit message first
      let jiraId = extractJiraId(message);

      // If no JIRA ID in message, try to get it from branch name
      if (!jiraId) {
        try {
          const branches = execSync(`git branch --contains ${hash} --format='%(refname:short)'`, {
            cwd,
            encoding: 'utf-8',
          }).trim().split('\n').filter(b => b.trim());

          // Try to find a branch with JIRA ID (prefer feature branches)
          for (const branchName of branches) {
            const branchJiraId = extractJiraId(branchName);
            if (branchJiraId) {
              jiraId = branchJiraId;
              break;
            }
          }
        } catch (error) {
          // Ignore errors, jiraId remains null
        }
      }

      commits.push({
        hash,
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
    const { jiraId, date } = commit;

    // Skip commits without JIRA ID
    if (!jiraId) continue;

    if (!grouped[jiraId]) {
      grouped[jiraId] = {};
    }

    if (!grouped[jiraId][date]) {
      grouped[jiraId][date] = [];
    }

    grouped[jiraId][date].push(commit);
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
 * Get combined diff for multiple commits
 */
function getCommitsDiff(commits, cwd) {
  try {
    // Get diff from first parent of first commit to last commit
    const hashes = commits.map(c => c.hash);
    if (hashes.length === 0) return '';

    const firstCommit = `${hashes[hashes.length - 1]}^`; // Parent of oldest commit
    const lastCommit = hashes[0]; // Newest commit

    const diff = execSync(`git diff ${firstCommit}..${lastCommit} --stat --patch`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    }).trim();

    return diff;
  } catch (error) {
    console.error(`Warning: Failed to get diff: ${error.message}`);
    return '';
  }
}

/**
 * Write commit data to temp files for interactive summarization
 */
function writeCommitDataToTempFiles(taskId, date, commits, taskSummary, cwd) {
  const timestamp = Date.now();
  const tempDir = '/tmp/code-diary';

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const baseName = `${taskId}_${date}_${timestamp}`;
  const metadataFile = path.join(tempDir, `${baseName}_metadata.json`);
  const diffFile = path.join(tempDir, `${baseName}_diff.txt`);

  // Get combined diff
  const diff = getCommitsDiff(commits, cwd);

  // Write metadata
  const metadata = {
    taskId,
    date,
    taskSummary,
    commits: commits.map(c => ({
      hash: c.hash,
      date: c.date,
      message: c.message,
    })),
  };
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

  // Write diff
  fs.writeFileSync(diffFile, diff, 'utf-8');

  return {
    metadataFile,
    diffFile,
  };
}

/**
 * Analyze commits and output to temp files for interactive summarization
 */
function logCommits(options) {
  const { trackingId, summary, cwd } = options;

  // Get commits with metadata
  const commits = getCommitsWithMetadata(options);

  if (commits.length === 0) {
    return {
      success: true,
      message: 'No commits found in the specified date range',
      tempFiles: [],
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

  const tempFiles = [];

  // If tracking ID is forced, use it for all commits
  if (trackingId && summary) {
    const commitsByDate = {};
    for (const commit of commits) {
      if (!commitsByDate[commit.date]) {
        commitsByDate[commit.date] = [];
      }
      commitsByDate[commit.date].push(commit);
    }

    for (const [date, commitsForDate] of Object.entries(commitsByDate)) {
      const files = writeCommitDataToTempFiles(
        trackingId,
        date,
        commitsForDate,
        summary,
        cwd,
      );
      tempFiles.push({
        taskId: trackingId,
        date,
        taskSummary: summary,
        ...files,
      });
    }

    return {
      success: true,
      message: `Generated ${tempFiles.length} temp file(s) for interactive summarization`,
      tempFiles,
    };
  }

  // Group commits by JIRA ID and date
  const grouped = groupCommitsByTask(commits);

  if (Object.keys(grouped).length === 0) {
    return {
      success: true,
      message: 'No commits with JIRA IDs found',
      tempFiles: [],
    };
  }

  // Process each task
  for (const [jiraId, dateGroups] of Object.entries(grouped)) {
    // Find task summary
    const taskSummary = findTaskSummary(jiraId, cwd);

    if (!taskSummary) {
      console.error(`⚠️  Warning: Could not find task file for ${jiraId}, skipping...`);
      continue;
    }

    for (const [date, commitsForDate] of Object.entries(dateGroups)) {
      const files = writeCommitDataToTempFiles(
        jiraId,
        date,
        commitsForDate,
        taskSummary,
        cwd,
      );
      tempFiles.push({
        taskId: jiraId,
        date,
        taskSummary,
        ...files,
      });
    }
  }

  return {
    success: true,
    message: `Generated ${tempFiles.length} temp file(s) for interactive summarization`,
    tempFiles,
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
