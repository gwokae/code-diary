#!/usr/bin/env node

/**
 * Find task files by tracking ID or summary keywords
 * Usage: node find_task.cjs <tasks-path> <search-term>
 *
 * Examples:
 *   node find_task.cjs ~/.claude/worklogs/my-project/tasks PROJ-123
 *   node find_task.cjs ~/.claude/worklogs/my-project/tasks "dashboard feature"
 */

const fs = require('fs');
const path = require('path');

function findTaskFiles(tasksPath, searchTerm) {

  if (!fs.existsSync(tasksPath)) {
    return [];
  }

  const results = [];
  const statuses = ['new', 'working', 'archived'];

  // Normalize search term for comparison
  const normalizedSearch = searchTerm.toLowerCase().trim();

  for (const status of statuses) {
    const statusPath = path.join(tasksPath, status);

    if (!fs.existsSync(statusPath)) {
      continue;
    }

    const files = fs.readdirSync(statusPath);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      const filePath = path.join(statusPath, file);
      const fileName = file.replace('.md', '');

      // Check if search term matches filename
      if (fileName.toLowerCase().includes(normalizedSearch)) {
        results.push({
          path: filePath,
          status: status,
          filename: fileName,
          matchType: 'filename',
        });
        continue;
      }

      // Check if search term matches content (tracking_id or summary in frontmatter)
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const trackingIdMatch = frontmatter.match(/tracking_id:\s*(.+)/);
          const summaryMatch = frontmatter.match(/summary:\s*(.+)/);

          if (trackingIdMatch && trackingIdMatch[1].toLowerCase().includes(normalizedSearch)) {
            results.push({
              path: filePath,
              status: status,
              filename: fileName,
              matchType: 'tracking_id',
              trackingId: trackingIdMatch[1].trim(),
            });
          } else if (summaryMatch && summaryMatch[1].toLowerCase().includes(normalizedSearch)) {
            results.push({
              path: filePath,
              status: status,
              filename: fileName,
              matchType: 'summary',
              summary: summaryMatch[1].trim(),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  }

  return results;
}

// Main
if (require.main === module) {
  const tasksPath = process.argv[2];
  const searchTerm = process.argv[3];

  if (!tasksPath || !searchTerm) {
    console.error('Usage: node find_task.cjs <tasks-path> <search-term>');
    process.exit(1);
  }

  const results = findTaskFiles(path.resolve(tasksPath), searchTerm);

  if (results.length === 0) {
    console.log('No tasks found');
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

module.exports = { findTaskFiles };
