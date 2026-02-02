#!/usr/bin/env node

/**
 * Calculate week number, date range, and determine which week a date belongs to
 * Uses ISO week date system (week starts on Monday)
 *
 * Usage: node get_week_info.cjs [date]
 *
 * Examples:
 *   node get_week_info.cjs              # Current date
 *   node get_week_info.cjs 2026-01-28   # Specific date
 */

function getWeekNumber(date) {
  // Copy date so we don't modify original
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  return weekNum;
}

function getWeekRange(date) {
  // Get the Monday of the week
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));

  // Get the Sunday of the week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getWeekInfo(dateStr = null) {
  const date = dateStr ? new Date(dateStr) : new Date();

  // Validate date
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  const weekNum = getWeekNumber(date);
  const weekRange = getWeekRange(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return {
    date: date.toISOString().slice(0, 10),
    year: year,
    month: `${year}-${month}`,
    weekNumber: weekNum,
    weekHeader: `Week ${weekNum}`,
    weekRange: weekRange,
    dailyHeader: date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    monthHeader: date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
  };
}

// Main
if (require.main === module) {
  const dateStr = process.argv[2];

  try {
    const info = getWeekInfo(dateStr);
    console.log(JSON.stringify(info, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { getWeekInfo, getWeekNumber, getWeekRange };
