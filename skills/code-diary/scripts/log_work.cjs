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
 *   --task <json>                Complete task entry as JSON (can be specified multiple times)
 *
 * Examples:
 *   # Single task with multiple work items
 *   node log_work.cjs \
 *     --tracking-id PROJ-123 \
 *     --summary "Dashboard Automations" \
 *     --work "Implemented sensor time range selector" \
 *     --work "Added validation for date ranges"
 *
 *   # Multiple tasks in one call (recommended to avoid race conditions)
 *   node log_work.cjs \
 *     --date 2026-02-02 \
 *     --task '{"trackingId":"PROJ-123","summary":"Dashboard","workItems":["Feature A"]}' \
 *     --task '{"trackingId":"PROJ-124","summary":"Sensor","workItems":["Feature B"]}'
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
    tasks: [], // Array of {trackingId, summary, workItems}
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
    } else if (arg === '--task' && i + 1 < argv.length) {
      try {
        const taskData = JSON.parse(argv[++i]);
        args.tasks.push(taskData);
      } catch (error) {
        throw new Error(`Invalid JSON for --task: ${error.message}`);
      }
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
      // Save current task and day before switching weeks
      if (currentTask && currentDay) {
        currentDay.tasks.push(currentTask);
      }
      if (currentDay && currentWeek) {
        currentWeek.days.push(currentDay);
      }
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
      // Save current task before switching days
      if (currentTask && currentDay) {
        currentDay.tasks.push(currentTask);
      }
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
 * Return worklog sections with weeks and their days ordered newest first.
 * Existing malformed ordering is repaired on every write, not only when a
 * new week or day is created.
 */
function normalizeWorklogSections(sections) {
  const headerSections = sections.filter(
    (section) => section.type === 'header',
  );
  const weekSections = sections
    .filter((section) => section.type === 'week')
    .map((week) => ({
      ...week,
      days: [...week.days].sort((a, b) => compareDates(a.date, b.date)),
    }))
    .sort((a, b) => b.weekNumber - a.weekNumber);

  return [...headerSections, ...weekSections];
}

/**
 * Validate structural invariants that prettier cannot enforce.
 */
function validateWorklogSections(sections, options = {}) {
  const { expectedMonth } = options;
  const errors = [];
  const weeks = sections.filter((section) => section.type === 'week');
  const seenWeeks = new Set();

  for (let index = 0; index < weeks.length; index++) {
    const week = weeks[index];

    if (seenWeeks.has(week.weekNumber)) {
      errors.push({
        code: 'DUPLICATE_WEEK',
        message: `Duplicate Week ${week.weekNumber} header`,
      });
    }
    seenWeeks.add(week.weekNumber);

    if (index > 0 && weeks[index - 1].weekNumber <= week.weekNumber) {
      errors.push({
        code: 'WEEK_ORDER',
        message: 'Week headers must be ordered descending',
      });
    }

    const seenDays = new Set();
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex++) {
      const day = week.days[dayIndex];
      const normalizedDate = day.date.replace(/\//g, '-');

      if (seenDays.has(day.date)) {
        errors.push({
          code: 'DUPLICATE_DAY',
          message: `Duplicate ${day.date} header in Week ${week.weekNumber}`,
        });
      }
      seenDays.add(day.date);

      if (
        dayIndex > 0 &&
        compareDates(week.days[dayIndex - 1].date, day.date) > 0
      ) {
        errors.push({
          code: 'DAY_ORDER',
          message: `Dates in Week ${week.weekNumber} must be ordered descending`,
        });
      }

      if (expectedMonth && !normalizedDate.startsWith(`${expectedMonth}-`)) {
        errors.push({
          code: 'MONTH_MISMATCH',
          message: `${day.date} does not belong to ${expectedMonth}`,
        });
      }

      if (getWeekInfo(normalizedDate).weekNumber !== week.weekNumber) {
        errors.push({
          code: 'WEEK_MISMATCH',
          message: `${day.date} does not belong to Week ${week.weekNumber}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Serialize parsed worklog sections without changing their content.
 */
function serializeWorklog(sections) {
  const output = [];

  for (const section of sections.filter((item) => item.type === 'header')) {
    output.push(...section.lines);
  }

  for (const week of sections.filter((item) => item.type === 'week')) {
    output.push('');
    output.push(week.header);
    output.push(...week.content);

    for (const day of week.days) {
      output.push('');
      output.push(day.header);
      output.push(...day.content);

      for (const task of day.tasks) {
        output.push('');
        output.push(`- ${task.trackingId}: ${task.summary}`);
        output.push(...task.content);
      }
    }
  }

  return `${output.join('\n')}\n`;
}

function writeFileAtomically(filePath, content) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, content, 'utf-8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

/**
 * Check if work item is redundant with task summary
 * Removes common prefixes, normalizes text, and checks for similarity
 */
function isRedundantWithSummary(workItem, summary) {
  // Normalize both strings: lowercase, remove punctuation, trim whitespace
  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedWork = normalize(workItem);
  const normalizedSummary = normalize(summary);

  // Check if work item is essentially the same as summary
  if (normalizedWork === normalizedSummary) {
    return true;
  }

  // Check if strings are very similar in length (within 80% ratio)
  const lengthRatio = Math.min(normalizedWork.length, normalizedSummary.length) /
                      Math.max(normalizedWork.length, normalizedSummary.length);

  // If one contains the other and they're similar in length, consider redundant
  if (lengthRatio > 0.8 && normalizedWork.length > 10) {
    if (normalizedSummary.includes(normalizedWork) || normalizedWork.includes(normalizedSummary)) {
      return true;
    }
  }

  return false;
}

/**
 * Add a single task to day section
 */
function addTaskToDay(daySection, taskData) {
  const { trackingId, summary, workItems } = taskData;

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
  }
  // Note: DO NOT update summary if task already exists
  // This prevents overwriting when multiple commits for same task on same day

  // Add work items (skip if redundant with summary)
  const filteredWorkItems = workItems.filter(
    (workItem) => !isRedundantWithSummary(workItem, summary),
  );

  for (const workItem of filteredWorkItems) {
    const workLine = `  - ${workItem}`;
    // Check if work item already exists (exact match or similar content)
    const alreadyExists = taskEntry.content.some((existingLine) => {
      // Exact match
      if (existingLine === workLine) return true;

      // Similar content check (normalize and compare)
      const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const normalizedNew = normalize(workItem);
      const normalizedExisting = normalize(existingLine.replace(/^\s*-\s*/, ''));

      // If 95% similar in length and one contains the other, consider duplicate
      const lengthRatio = Math.min(normalizedNew.length, normalizedExisting.length) /
                          Math.max(normalizedNew.length, normalizedExisting.length);
      if (lengthRatio > 0.95 && normalizedNew.length > 20) {
        return normalizedExisting.includes(normalizedNew) || normalizedNew.includes(normalizedExisting);
      }

      return false;
    });

    if (!alreadyExists) {
      taskEntry.content.push(workLine);
    }
  }
}

/**
 * Add or update work entries in the worklog
 * Supports adding multiple tasks in a single call to avoid race conditions
 */
function logWork(options) {
  const { date, trackingId, summary, workItems, tasks } = options;

  // Determine which mode: single task or multiple tasks
  const tasksToAdd = [];

  if (tasks && tasks.length > 0) {
    // Multiple tasks mode
    tasksToAdd.push(...tasks);
  } else {
    // Single task mode (legacy)
    if (!trackingId || !summary || workItems.length === 0) {
      throw new Error(
        'Missing required fields: --tracking-id, --summary, and at least one --work item are required',
      );
    }
    tasksToAdd.push({ trackingId, summary, workItems });
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
      content: [],
      days: [],
    };
    sections.push(weekSection);
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
  }

  // Add all tasks to the day section
  for (const taskData of tasksToAdd) {
    addTaskToDay(daySection, taskData);
  }

  const normalizedSections = normalizeWorklogSections(sections);
  const validationErrors = validateWorklogSections(normalizedSections, {
    expectedMonth: weekInfo.month,
  });
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.map((error) => error.message).join('; '));
  }

  writeFileAtomically(worklogFile, serializeWorklog(normalizedSections));

  // Format with prettier
  formatWorklog(worklogFile);

  return {
    worklogFile,
    date: dateStr,
    dailyHeader,
    tasks: tasksToAdd,
  };
}

// Main
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = logWork(args);
    const message =
      result.tasks.length === 1
        ? `Added work entry for ${result.tasks[0].trackingId} on ${result.date}`
        : `Added ${result.tasks.length} work entries on ${result.date}`;

    console.log(
      JSON.stringify(
        {
          success: true,
          message,
          worklogFile: result.worklogFile,
          date: result.date,
          tasks: result.tasks,
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

module.exports = {
  addTaskToDay,
  compareDates,
  formatDateHeader,
  isRedundantWithSummary,
  logWork,
  normalizeWorklogSections,
  parseWorklog,
  serializeWorklog,
  validateWorklogSections,
  writeFileAtomically,
};
