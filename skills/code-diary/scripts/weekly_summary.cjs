#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getWorklogsPath } = require('./config.cjs');

/**
 * Generate weekly summary by looking back 7 days from the given date
 * Collects tasks from all daily entries within the 7-day window
 * Usage: node weekly_summary.cjs [date]
 * Example: node weekly_summary.cjs 2026-02-12
 */

function parseDate(dateStr) {
  if (!dateStr) {
    return new Date();
  }
  return new Date(dateStr);
}

function getWeekRange(date) {
  // Get Monday of the week
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  // Get Sunday of the week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function extractTasksFromDailyEntries(content, endDate) {
  const tasksMap = new Map();

  // Calculate 7 days ago from endDate
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  // Split by daily headers (### YYYY/MM/DD) across all content
  const dailyPattern = /### (\d{4}\/\d{2}\/\d{2})/g;
  const sections = content.split(dailyPattern);

  // Process each daily section (skip first section which is before any daily header)
  for (let i = 1; i < sections.length; i += 2) {
    const dateHeader = sections[i]; // The date (e.g., "2026/02/12")
    const dailyContent = sections[i + 1]; // Content after the date

    if (!dailyContent) continue;

    // Parse the date to check if it's within the 7-day window
    const entryDate = new Date(dateHeader.replace(/\//g, '-'));

    // Skip if outside the 7-day window
    if (entryDate < start || entryDate > end) {
      continue;
    }

    // Extract task entries from this daily section
    // Tasks are lines that start with "- UNIFIC-" (or other tracking ID pattern)
    const taskPattern = /^- ([A-Z]+-\d+): (.+?)$/gm;
    let match;

    while ((match = taskPattern.exec(dailyContent)) !== null) {
      const trackingId = match[1];
      const summary = match[2];
      tasksMap.set(trackingId, summary);
    }
  }

  return tasksMap;
}

function updateWeeklySummary(worklogPath, weekNumber, tasks) {
  let content = fs.readFileSync(worklogPath, 'utf8');

  // Generate the "Last week:" section
  const lastWeekTasks = Array.from(tasks.entries())
    .map(([id, summary]) => `- ${id}: ${summary}`)
    .join('\n');

  // Replace the "Last week:" section in the specified week
  const weekPattern = new RegExp(
    `(## Week ${weekNumber}\\s+)Last week:\\s*\\n(?:[\\s\\S]*?\\n)?(?=\\nThis week:|$)`,
  );

  if (!weekPattern.test(content)) {
    console.error(`Week ${weekNumber} section not found in worklog`);
    process.exit(1);
  }

  content = content.replace(
    weekPattern,
    `$1Last week:\n\n${lastWeekTasks}\n`,
  );

  fs.writeFileSync(worklogPath, content, 'utf8');

  return { worklogPath, weekNumber, taskCount: tasks.size };
}

async function main() {
  try {
    const dateArg = process.argv[2];
    const date = parseDate(dateArg);
    const weekNumber = getWeekNumber(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get worklogs path
    const worklogsPath = getWorklogsPath();
    const worklogPath = path.join(worklogsPath, 'logs', `${year}-${month}.md`);

    // Check if worklog file exists
    if (!fs.existsSync(worklogPath)) {
      console.error(`Worklog file not found: ${worklogPath}`);
      process.exit(1);
    }

    // Read worklog
    const content = fs.readFileSync(worklogPath, 'utf8');

    // Extract tasks from daily entries in the last 7 days
    const tasks = extractTasksFromDailyEntries(content, date);

    if (tasks.size === 0) {
      console.log(
        `No tasks found in daily entries from the last 7 days. Nothing to update.`,
      );
      return;
    }

    // Update weekly summary
    const result = updateWeeklySummary(worklogPath, weekNumber, tasks);

    console.log(
      JSON.stringify(
        {
          success: true,
          message: `Updated Last Week section for Week ${weekNumber}`,
          ...result,
          tasks: Array.from(tasks.entries()).map(([id, summary]) => ({
            trackingId: id,
            summary,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractTasksFromDailyEntries, updateWeeklySummary };
