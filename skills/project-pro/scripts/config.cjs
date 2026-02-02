#!/usr/bin/env node

/**
 * Project-pro configuration management
 * Reads configuration from environment variables (shared with code-diary)
 */

const path = require('path');

const ENV_VAR = 'CODE_DIARY_PATH';
const DEFAULT_PATH = path.join(process.env.HOME, 'workspace/worklogs');

/**
 * Get the base path from environment or default
 */
function getBasePath() {
  return process.env[ENV_VAR] || DEFAULT_PATH;
}

/**
 * Get project knowledge path
 */
function getProjectKnowledgePath(projectName) {
  return path.join(getBasePath(), projectName, 'knowledge');
}

/**
 * Check if environment variable is configured
 */
function isConfigured() {
  return !!process.env[ENV_VAR];
}

module.exports = {
  getBasePath,
  getProjectKnowledgePath,
  isConfigured,
  ENV_VAR,
  DEFAULT_PATH,
};
