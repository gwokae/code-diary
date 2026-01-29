#!/usr/bin/env node

/**
 * Code-diary configuration management
 * Handles reading/writing configuration and ensuring defaults
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  worklogsPath: path.join(process.env.HOME, '.claude/worklogs'),
};

function getConfigPath() {
  return path.join(process.env.HOME, '.claude/code-diary/config.json');
}

function ensureConfigDir() {
  const configDir = path.dirname(getConfigPath());
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function loadConfig() {
  const configPath = getConfigPath();

  // If config doesn't exist, create it with defaults
  if (!fs.existsSync(configPath)) {
    ensureConfigDir();
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n',
    );
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // Merge with defaults to ensure all required fields exist
    return {
      ...DEFAULT_CONFIG,
      ...config,
    };
  } catch (error) {
    console.error(
      `Warning: Failed to parse config at ${configPath}: ${error.message}`,
    );
    console.error('Using default configuration.');
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config) {
  const configPath = getConfigPath();
  ensureConfigDir();

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}

function updateConfig(updates) {
  const config = loadConfig();
  const newConfig = {
    ...config,
    ...updates,
  };
  saveConfig(newConfig);
  return newConfig;
}

function getWorklogsPath() {
  const config = loadConfig();
  return config.worklogsPath;
}

// Main (for CLI usage)
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log('Usage: node config.cjs <command> [args]');
    console.log('');
    console.log('Commands:');
    console.log('  show                          Show current configuration');
    console.log(
      '  init                          Initialize config with defaults',
    );
    console.log('  set <key> <value>            Set a configuration value');
    console.log('  get <key>                    Get a configuration value');
    console.log('  path                         Show config file path');
    console.log('');
    console.log('Keys:');
    console.log(
      '  worklogsPath                 Base directory for worklogs and projects',
    );
    console.log('');
    console.log('Examples:');
    console.log('  node config.cjs show');
    console.log('  node config.cjs set worklogsPath ~/my-worklogs');
    console.log('  node config.cjs get worklogsPath');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'show': {
        const config = loadConfig();
        console.log(JSON.stringify(config, null, 2));
        break;
      }

      case 'init': {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
          console.log(`Config already exists at: ${configPath}`);
          console.log('Use "set" command to update values.');
        } else {
          saveConfig(DEFAULT_CONFIG);
          console.log(`✅ Config initialized at: ${configPath}`);
          console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
        }
        break;
      }

      case 'set': {
        const key = args[1];
        const value = args[2];

        if (!key || !value) {
          console.error('Error: Missing key or value');
          console.error('Usage: node config.cjs set <key> <value>');
          process.exit(1);
        }

        // Expand ~ to home directory if present
        const expandedValue = value.startsWith('~')
          ? path.join(process.env.HOME, value.slice(1))
          : value;

        const updates = {};
        updates[key] = expandedValue;

        const newConfig = updateConfig(updates);
        console.log(`✅ Updated ${key} to: ${expandedValue}`);
        console.log('');
        console.log('Current configuration:');
        console.log(JSON.stringify(newConfig, null, 2));
        break;
      }

      case 'get': {
        const key = args[1];

        if (!key) {
          console.error('Error: Missing key');
          console.error('Usage: node config.cjs get <key>');
          process.exit(1);
        }

        const config = loadConfig();
        if (key in config) {
          console.log(config[key]);
        } else {
          console.error(`Error: Key "${key}" not found in config`);
          process.exit(1);
        }
        break;
      }

      case 'path': {
        console.log(getConfigPath());
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
  loadConfig,
  saveConfig,
  updateConfig,
  getWorklogsPath,
  getConfigPath,
  DEFAULT_CONFIG,
};
