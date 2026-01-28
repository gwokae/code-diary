#!/usr/bin/env node

/**
 * Parse various task input formats
 *
 * Supports formats:
 * 1. Multi-line with JIRA ID:
 *    PROJ-123
 *    [FE] Dashboard: Automations Triggers - Sensors
 *
 * 2. One-liner with JIRA ID:
 *    PROJ-123 [FE] Dashboard: Automations Triggers - Sensors
 *
 * 3. Multi-line without JIRA ID:
 *    [FE] Dashboard: Automations Triggers - Sensors
 *
 * Usage: node parse_task_input.cjs <input-text>
 * Output: JSON array of tasks
 */

function parseTaskInput(input) {
  const lines = input.trim().split('\n').map(line => line.trim()).filter(Boolean);
  const tasks = [];

  let currentTask = null;

  for (const line of lines) {
    // Check if line looks like a JIRA ID (e.g., PROJ-123, ABC-456)
    const jiraIdMatch = line.match(/^([A-Z]+-\d+)$/);

    if (jiraIdMatch) {
      // Standalone JIRA ID - next line should be summary
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = { trackingId: jiraIdMatch[1], summary: null };
    } else {
      // Check if line starts with JIRA ID followed by summary
      const oneLineMatch = line.match(/^([A-Z]+-\d+)\s+(.+)$/);

      if (oneLineMatch) {
        // One-liner format: JIRA-ID Summary
        if (currentTask) {
          tasks.push(currentTask);
        }
        tasks.push({
          trackingId: oneLineMatch[1],
          summary: oneLineMatch[2],
        });
        currentTask = null;
      } else {
        // Regular summary line
        if (currentTask && !currentTask.summary) {
          // This is the summary for the previous JIRA ID
          currentTask.summary = line;
          tasks.push(currentTask);
          currentTask = null;
        } else {
          // Summary without JIRA ID
          tasks.push({
            trackingId: null,
            summary: line,
          });
        }
      }
    }
  }

  // Add last task if exists
  if (currentTask) {
    if (currentTask.summary) {
      tasks.push(currentTask);
    } else {
      console.error(`Warning: JIRA ID ${currentTask.trackingId} has no summary`);
    }
  }

  return tasks;
}

// Main
if (require.main === module) {
  const input = process.argv.slice(2).join(' ');

  if (!input) {
    console.error('Usage: node parse_task_input.cjs <input-text>');
    console.error('');
    console.error('Example:');
    console.error('  node parse_task_input.cjs "PROJ-123\\n[FE] Dashboard: Automations"');
    process.exit(1);
  }

  const tasks = parseTaskInput(input);
  console.log(JSON.stringify(tasks, null, 2));
}

module.exports = { parseTaskInput };
