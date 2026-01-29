#!/usr/bin/env node

/**
 * Detect current project from working directory
 *
 * Looks for project configuration based on current directory name.
 * Falls back to checking git remote URL for project identification.
 *
 * Usage: node get_current_project.cjs [working-directory]
 *
 * Examples:
 *   node get_current_project.cjs
 *   // Uses process.cwd()
 *
 *   node get_current_project.cjs ~/workspace/my-project
 *   // Uses specified directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getWorklogsPath } = require('./config.cjs');

function getProjectNameFromPath(dirPath) {
  // Get the directory name from the path
  return path.basename(dirPath);
}

function getProjectNameFromGit(dirPath) {
  try {
    // Try to get the git remote URL
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: dirPath,
      encoding: 'utf-8',
    }).trim();

    // Extract project name from git URL
    // Supports formats like:
    // - git@github.com:user/project.git
    // - https://github.com/user/project.git
    const match = remoteUrl.match(/[/:]([^/]+?)(\.git)?$/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    // Not a git repo or no remote configured
    return null;
  }
}

function findProjectConfig(projectName) {
  const worklogsRoot = getWorklogsPath();
  const configPath = path.join(worklogsRoot, projectName, 'project.json');

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        name: projectName,
        configPath: configPath,
        projectPath: path.dirname(configPath), // Project-specific path for tasks
        worklogPath: path.join(worklogsRoot, 'logs'), // Global worklog path
        tasksPath: path.join(worklogsRoot, projectName, 'tasks'), // Project-specific tasks path
        config: config,
      };
    } catch (error) {
      throw new Error(`Failed to parse project config at ${configPath}: ${error.message}`);
    }
  }

  return null;
}

function getCurrentProject(workingDir = null) {
  const cwd = workingDir || process.cwd();

  // Strategy 1: Try directory name
  const dirName = getProjectNameFromPath(cwd);
  let projectConfig = findProjectConfig(dirName);

  if (projectConfig) {
    return projectConfig;
  }

  // Strategy 2: Try git remote URL
  const gitProjectName = getProjectNameFromGit(cwd);
  if (gitProjectName) {
    projectConfig = findProjectConfig(gitProjectName);
    if (projectConfig) {
      return projectConfig;
    }
  }

  // Strategy 3: List available projects and suggest
  const worklogsPath = getWorklogsPath();
  let availableProjects = [];

  if (fs.existsSync(worklogsPath)) {
    availableProjects = fs.readdirSync(worklogsPath).filter(name => {
      const configPath = path.join(worklogsPath, name, 'project.json');
      return fs.existsSync(configPath);
    });
  }

  return {
    error: 'Project not found',
    cwd: cwd,
    triedNames: [dirName, gitProjectName].filter(Boolean),
    availableProjects: availableProjects,
  };
}

// Main
if (require.main === module) {
  const workingDir = process.argv[2];

  try {
    const result = getCurrentProject(workingDir);

    if (result.error) {
      console.error(`Error: ${result.error}`);
      console.error(`Current directory: ${result.cwd}`);
      console.error(`Tried project names: ${result.triedNames.join(', ')}`);

      if (result.availableProjects.length > 0) {
        console.error(`\nAvailable projects:`);
        result.availableProjects.forEach(name => {
          console.error(`  - ${name}`);
        });
      } else {
        console.error(`\nNo projects configured. Run setup to create a project.`);
      }

      process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { getCurrentProject, getProjectNameFromPath, getProjectNameFromGit };
