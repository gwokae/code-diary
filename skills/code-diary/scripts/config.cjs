#!/usr/bin/env node

/**
 * Code-diary configuration management
 * Reads configuration from environment variables
 */

const path = require('path');

const ENV_VAR = 'CODE_DIARY_PATH';
const DEFAULT_PATH = path.join(process.env.HOME, 'workspace/worklogs');

/**
 * Get the worklogs base path from environment or default
 */
function getWorklogsPath() {
  return process.env[ENV_VAR] || DEFAULT_PATH;
}

/**
 * Check if environment variable is configured
 */
function isConfigured() {
  return !!process.env[ENV_VAR];
}

/**
 * Get setup instructions for the environment variable
 */
function getSetupInstructions() {
  const shell = process.env.SHELL || '';
  const profileFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';

  return `
Environment variable ${ENV_VAR} is not set.

To configure it permanently, add this line to your shell profile (${profileFile}):

    export ${ENV_VAR}="${DEFAULT_PATH}"

Or use a custom path:

    export ${ENV_VAR}="~/workspace/worklogs"

Then reload your shell:

    source ${profileFile}

Current default (used when not configured): ${DEFAULT_PATH}
`.trim();
}

// Main (for CLI usage)
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log('Usage: node config.cjs <command>');
    console.log('');
    console.log('Commands:');
    console.log('  show         Show current worklogs path');
    console.log('  check        Check if environment variable is configured');
    console.log('  setup        Show setup instructions');
    console.log('');
    console.log(`Environment variable: ${ENV_VAR}`);
    console.log(`Default path: ${DEFAULT_PATH}`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'show': {
        const worklogsPath = getWorklogsPath();
        const isEnvSet = isConfigured();

        console.log(JSON.stringify({
          worklogsPath,
          source: isEnvSet ? 'environment' : 'default',
          envVar: ENV_VAR,
          isConfigured: isEnvSet,
        }, null, 2));
        break;
      }

      case 'check': {
        const isEnvSet = isConfigured();
        if (isEnvSet) {
          console.log(`✅ ${ENV_VAR} is configured: ${process.env[ENV_VAR]}`);
        } else {
          console.log(`⚠️  ${ENV_VAR} is not configured`);
          console.log(`Using default: ${DEFAULT_PATH}`);
          console.log('');
          console.log('Run "node config.cjs setup" for configuration instructions.');
        }
        process.exit(isEnvSet ? 0 : 1);
      }

      case 'setup': {
        console.log(getSetupInstructions());
        break;
      }

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.error('Run "node config.cjs --help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  getWorklogsPath,
  isConfigured,
  getSetupInstructions,
  ENV_VAR,
  DEFAULT_PATH,
};
