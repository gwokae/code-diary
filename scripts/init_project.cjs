#!/usr/bin/env node

/**
 * Initialize a new project configuration
 * Usage: node init_project.cjs <project-name> [options]
 *
 * Options:
 *   --issue-tracker-type <type>      Issue tracker type (jira|github|linear)
 *   --issue-tracker-url <url>        Issue tracker base URL
 *   --issue-tracker-prefix <prefix>  Issue tracker project prefix
 *   --main-branch <branch>           Main branch name (default: main)
 *   --feature-branch-rule <rule>     Feature branch rule (default: feat/{filename})
 *   --auto-detect                    Auto-detect settings from current directory
 *
 * Examples:
 *   node init_project.cjs my-project --auto-detect
 *   node init_project.cjs my-project --issue-tracker-type jira --issue-tracker-url https://example.atlassian.net --issue-tracker-prefix PROJ --main-branch develop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getWorklogsPath } = require('./config.cjs');

function autoDetectSettings(cwd = process.cwd()) {
  const settings = {
    mainBranch: 'main',
    issueTracker: null,
  };

  try {
    // Try to detect main branch
    const branches = execSync('git branch -r', { cwd, encoding: 'utf-8' }).split('\n');

    for (const branch of branches) {
      const trimmed = branch.trim();
      if (trimmed.includes('origin/main')) {
        settings.mainBranch = 'main';
        break;
      } else if (trimmed.includes('origin/master')) {
        settings.mainBranch = 'master';
        break;
      } else if (trimmed.includes('origin/develop')) {
        settings.mainBranch = 'develop';
        break;
      }
    }

    // Try to detect issue tracker from git remote
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd,
      encoding: 'utf-8',
    }).trim();

    if (remoteUrl.includes('github.com')) {
      settings.issueTracker = {
        type: 'github',
        baseUrl: remoteUrl.replace('.git', '').replace('git@github.com:', 'https://github.com/'),
      };
    }
  } catch (error) {
    // Git commands failed, use defaults
  }

  return settings;
}

function initProject(projectName, options = {}) {
  const worklogsRoot = getWorklogsPath();
  const projectPath = path.join(worklogsRoot, projectName);
  const tasksPath = path.join(projectPath, 'tasks');
  const configPath = path.join(projectPath, 'project.json');

  // Check if project already exists
  if (fs.existsSync(configPath)) {
    throw new Error(`Project "${projectName}" already exists at ${projectPath}`);
  }

  // Create directory structure
  fs.mkdirSync(path.join(tasksPath, 'new'), { recursive: true });
  fs.mkdirSync(path.join(tasksPath, 'working'), { recursive: true });
  fs.mkdirSync(path.join(tasksPath, 'archived'), { recursive: true });

  // Create global logs directory if it doesn't exist
  const logsPath = path.join(worklogsRoot, 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  // Build configuration
  const config = {
    name: projectName,
  };

  // Add issue tracker if provided
  if (options.issueTrackerType) {
    config.issueTracker = {
      type: options.issueTrackerType,
    };

    if (options.issueTrackerUrl) {
      config.issueTracker.baseUrl = options.issueTrackerUrl;
    }

    if (options.issueTrackerPrefix) {
      config.issueTracker.projectPrefix = options.issueTrackerPrefix;
    }
  } else if (options.issueTracker) {
    config.issueTracker = options.issueTracker;
  }

  // Add repository settings
  config.repository = {
    mainBranch: options.mainBranch || 'main',
    featureBranchRule: options.featureBranchRule || 'feat/{filename}',
  };

  // Write configuration
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return {
    projectPath,
    tasksPath,
    configPath,
    config,
  };
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node init_project.cjs <project-name> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --issue-tracker-type <type>      Issue tracker type (jira|github|linear)');
    console.log('  --issue-tracker-url <url>        Issue tracker base URL');
    console.log('  --issue-tracker-prefix <prefix>  Issue tracker project prefix');
    console.log('  --main-branch <branch>           Main branch name (default: main)');
    console.log('  --feature-branch-rule <rule>     Feature branch rule (default: feat/{filename})');
    console.log('  --auto-detect                    Auto-detect settings from current directory');
    console.log('');
    console.log('Examples:');
    console.log('  node init_project.cjs my-project --auto-detect');
    console.log('  node init_project.cjs my-project --issue-tracker-type jira --issue-tracker-url https://example.atlassian.net --issue-tracker-prefix PROJ');
    process.exit(0);
  }

  const projectName = args[0];
  const options = {};

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--auto-detect') {
      const detected = autoDetectSettings();
      options.mainBranch = detected.mainBranch;
      if (detected.issueTracker) {
        options.issueTracker = detected.issueTracker;
      }
    } else if (args[i] === '--issue-tracker-type' && i + 1 < args.length) {
      options.issueTrackerType = args[i + 1];
      i++;
    } else if (args[i] === '--issue-tracker-url' && i + 1 < args.length) {
      options.issueTrackerUrl = args[i + 1];
      i++;
    } else if (args[i] === '--issue-tracker-prefix' && i + 1 < args.length) {
      options.issueTrackerPrefix = args[i + 1];
      i++;
    } else if (args[i] === '--main-branch' && i + 1 < args.length) {
      options.mainBranch = args[i + 1];
      i++;
    } else if (args[i] === '--feature-branch-rule' && i + 1 < args.length) {
      options.featureBranchRule = args[i + 1];
      i++;
    }
  }

  try {
    const result = initProject(projectName, options);
    console.log(`✅ Project "${projectName}" initialized successfully!`);
    console.log(`   Configuration: ${result.configPath}`);
    console.log(`   Tasks directory: ${result.tasksPath}`);
    console.log('');
    console.log('Configuration:');
    console.log(JSON.stringify(result.config, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { initProject, autoDetectSettings };
