#!/usr/bin/env node

/**
 * Log work entries to the daily worklog with proper date ordering
 *
 * Usage: node log_work.cjs [options]
 *
 * Options:
 *   --date <YYYY-MM-DD>          Date for the work entry (default: today)
 *   --tracking-id <ID>           Tracking ID (e.g., PROJ-123)
 *   --summary <text>             Task summary
 *   --work <item>                Work item (can be specified multiple times)
 *
 * Examples:
 *   node log_work.cjs \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations" \
 *     --work "Implemented sensor time range selector" \
 *     --work "Added validation for date ranges"
 *
 *   node log_work.cjs \
 *     --date 2026-02-02 \
 *     --tracking-id PROJ-124 \
 *     --summary "Air Quality Sensor" \
 *     --work "Fixed device state handling"
 */

const fs = require('fs');
const path = require('path');
const { getWorklogsPath } = require('./config.cjs');
const { getWeekInfo } = require('./get_week_info.cjs');
const { formatWorklog } = require('./format_worklog.cjs');

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    date: null,
    trackingId: null,
    summary: null,
    workItems: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--date' && i + 1 < argv.length) {
      args.date = argv[++i];
    } else if (arg === '--tracking-id' && i + 1 < argv.length) {
      args.trackingId = argv[++i];
    } else if (arg === '--summary' && i + 1 < argv.length) {
      args.summary = argv[++i];
    } else if (arg === '--work' && i + 1 < argv.length) {
      args.workItems.push(argv[++i]);
    }
  }

  return args;
}

/**
 * Parse markdown content into structured sections
 */
function parseWorklog(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentWeek = null;
  let currentDay = null;
  let currentTask = null;
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      if (currentTask) {
        currentTask.content.push(...buffer);
      } else if (currentDay) {
        currentDay.content.push(...buffer);
      } else if (currentWeek) {
        currentWeek.content.push(...buffer);
      } else {
        sections.push({ type: 'header', lines: [...buffer] });
      }
      buffer = [];
    }
  };

  for (const line of lines) {
    // Week header (## Week N)
    if (line.match(/^## Week \d+/)) {
      flushBuffer();
      if (currentWeek) {
        sections.push(currentWeek);
      }
      currentWeek = {
        type: 'week',
        header: line,
        weekNumber: parseInt(line.match(/\d+/)[0]),
        content: [],
        days: [],
      };
      currentDay = null;
      currentTask = null;
      continue;
    }

    // Daily header (### YYYY/MM/DD)
    if (line.match(/^### \d{4}\/\d{2}\/\d{2}/)) {
      flushBuffer();
      if (currentDay) {
        currentWeek.days.push(currentDay);
      }
      currentDay = {
        type: 'day',
        header: line,
        date: line.replace('### ', ''),
        content: [],
        tasks: [],
      };
      currentTask = null;
      continue;
    }

    // Task entry (- TRACKING-ID: Summary)
    if (currentDay && line.match(/^- [A-Z]+-\d+:/)) {
      flushBuffer();
      if (currentTask) {
        currentDay.tasks.push(currentTask);
      }
      const match = line.match(/^- ([A-Z]+-\d+): (.+)$/);
      currentTask = {
        type: 'task',
        trackingId: match[1],
        summary: match[2],
        content: [],
      };
      continue;
    }

    buffer.push(line);
  }

  // Flush remaining content
  flushBuffer();
  if (currentTask) {
    currentDay.tasks.push(currentTask);
  }
  if (currentDay) {
    currentWeek.days.push(currentDay);
  }
  if (currentWeek) {
    sections.push(currentWeek);
  }

  return sections;
}

/**
 * Format date as YYYY/MM/DD
 */
function formatDateHeader(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Compare dates for sorting (descending - newest first)
 */
function compareDates(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1.replace(/\//g, '-'));
  const d2 = new Date(dateStr2.replace(/\//g, '-'));
  return d2 - d1; // Descending order
}

/**
 * Add or update work entry in the worklog
 */
function logWork(options) {
  const { date, trackingId, summary, workItems } = options;

  // Validate required fields
  if (!trackingId || !summary || workItems.length === 0) {
    throw new Error(
      'Missing required fields: --tracking-id, --summary, and at least one --work item are required',
    );
  }

  // Get date info
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const weekInfo = getWeekInfo(dateStr);
  const dailyHeader = formatDateHeader(dateStr);

  // Get worklog file path
  const worklogsPath = getWorklogsPath();
  const logsDir = path.join(worklogsPath, 'logs');
  const worklogFile = path.join(logsDir, `${weekInfo.month}.md`);

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Read or create worklog file
  let content = '';
  if (fs.existsSync(worklogFile)) {
    content = fs.readFileSync(worklogFile, 'utf-8');
  } else {
    // Create new worklog file
    content = `# ${weekInfo.month.replace('-', '/')} Contribution log\n`;
  }

  // Parse worklog
  const sections = parseWorklog(content);

  // Find or create week section
  let weekSection = sections.find(
    (s) => s.type === 'week' && s.weekNumber === weekInfo.weekNumber,
  );

  if (!weekSection) {
    weekSection = {
      type: 'week',
      header: `## ${weekInfo.weekHeader}`,
      weekNumber: weekInfo.weekNumber,
      content: ['', 'Last week:', '', 'This week:', ''],
      days: [],
    };
    sections.push(weekSection);
    // Sort weeks by week number (descending)
    sections.sort((a, b) => {
      if (a.type !== 'week' || b.type !== 'week') return 0;
      return b.weekNumber - a.weekNumber;
    });
  }

  // Find or create day section
  let daySection = weekSection.days.find((d) => d.date === dailyHeader);

  if (!daySection) {
    daySection = {
      type: 'day',
      header: `### ${dailyHeader}`,
      date: dailyHeader,
      content: [],
      tasks: [],
    };
    weekSection.days.push(daySection);
    // Sort days by date (descending - newest first)
    weekSection.days.sort((a, b) => compareDates(a.date, b.date));
  }

  // Find or create task entry
  let taskEntry = daySection.tasks.find((t) => t.trackingId === trackingId);

  if (!taskEntry) {
    taskEntry = {
      type: 'task',
      trackingId: trackingId,
      summary: summary,
      content: [],
    };
    daySection.tasks.push(taskEntry);
  } else {
    // Update summary if provided
    taskEntry.summary = summary;
  }

  // Add work items
  for (const workItem of workItems) {
    const workLine = `  - ${workItem}`;
    if (!taskEntry.content.includes(workLine)) {
      taskEntry.content.push(workLine);
    }
  }

  // Rebuild content
  let output = [];

  // Add header sections
  const headerSections = sections.filter((s) => s.type === 'header');
  for (const section of headerSections) {
    output.push(...section.lines);
  }

  // Add week sections
  const weekSections = sections.filter((s) => s.type === 'week');
  for (const week of weekSections) {
    output.push('');
    output.push(week.header);
    output.push(...week.content);

    // Add days
    for (const day of week.days) {
      output.push('');
      output.push(day.header);
      if (day.content.length > 0) {
        output.push(...day.content);
      }

      // Add tasks
      for (const task of day.tasks) {
        output.push('');
        output.push(`- ${task.trackingId}: ${task.summary}`);
        output.push(...task.content);
      }
    }
  }

  // Write file
  const newContent = output.join('\n') + '\n';
  fs.writeFileSync(worklogFile, newContent, 'utf-8');

  // Format with prettier
  formatWorklog(worklogFile);

  return {
    worklogFile,
    date: dateStr,
    dailyHeader,
    trackingId,
    summary,
    workItems,
  };
}

// Main
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = logWork(args);
    console.log(
      JSON.stringify(
        {
          success: true,
          message: `Added work entry for ${result.trackingId} on ${result.date}`,
          worklogFile: result.worklogFile,
          trackingId: result.trackingId,
          summary: result.summary,
          workItems: result.workItems,
        },
        null,
        2,
      ),
    );
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

module.exports = { logWork, parseWorklog, formatDateHeader, compareDates };
