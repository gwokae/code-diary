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
const { getWorklogsPath, expandPath } = require('./config.cjs');

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

function resolveRealPath(p) {
  const expanded = expandPath(p);
  try {
    return fs.realpathSync(expanded);
  } catch (error) {
    return path.resolve(expanded);
  }
}

function findPathMatch(repositories, resolvedCwd) {
  return repositories.find(
    (repo) => repo.path && resolveRealPath(repo.path) === resolvedCwd,
  );
}

function findNameMatch(repositories, cwdDirName, cwdGitName) {
  return repositories.find(
    (repo) => repo.name === cwdDirName || (cwdGitName && repo.name === cwdGitName),
  );
}

function matchRepositoryEntry(repositories, cwd) {
  const resolvedCwd = resolveRealPath(cwd);
  const cwdDirName = getProjectNameFromPath(cwd);
  const cwdGitName = getProjectNameFromGit(cwd);
  return (
    findPathMatch(repositories, resolvedCwd) ||
    findNameMatch(repositories, cwdDirName, cwdGitName) ||
    null
  );
}

function findProjectByRepository(cwd) {
  const worklogsRoot = getWorklogsPath();
  if (!fs.existsSync(worklogsRoot)) {
    return null;
  }

  const projectNames = fs.readdirSync(worklogsRoot).filter((name) => {
    const configPath = path.join(worklogsRoot, name, 'project.json');
    return fs.existsSync(configPath);
  });

  const candidates = [];
  for (const projectName of projectNames) {
    const configPath = path.join(worklogsRoot, projectName, 'project.json');
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      continue;
    }
    if (!Array.isArray(config.repositories)) {
      continue;
    }
    candidates.push({ projectName, configPath, config });
  }

  // Path matches take priority over name matches, across ALL candidate
  // projects — a name-based fallback match in one project must never win
  // over an exact path match in another.
  const resolvedCwd = resolveRealPath(cwd);
  for (const candidate of candidates) {
    const matchedEntry = findPathMatch(candidate.config.repositories, resolvedCwd);
    if (matchedEntry) {
      return { ...candidate, matchedEntry };
    }
  }

  const cwdDirName = getProjectNameFromPath(cwd);
  const cwdGitName = getProjectNameFromGit(cwd);
  for (const candidate of candidates) {
    const matchedEntry = findNameMatch(candidate.config.repositories, cwdDirName, cwdGitName);
    if (matchedEntry) {
      return { ...candidate, matchedEntry };
    }
  }

  return null;
}

function attachActiveRepository(projectConfig, cwd) {
  const { config } = projectConfig;

  if (config.repository) {
    return {
      ...projectConfig,
      activeRepository: {
        name: config.name,
        path: cwd,
        mainBranch: config.repository.mainBranch,
        featureBranchRule: config.repository.featureBranchRule,
      },
    };
  }

  if (Array.isArray(config.repositories)) {
    const matchedEntry = matchRepositoryEntry(config.repositories, cwd);
    return {
      ...projectConfig,
      repositories: config.repositories,
      activeRepository: matchedEntry ? { ...matchedEntry, path: cwd } : null,
    };
  }

  return { ...projectConfig, activeRepository: null };
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
      throw new Error(
        `Failed to parse project config at ${configPath}: ${error.message}`,
      );
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
    return attachActiveRepository(projectConfig, cwd);
  }

  // Strategy 2: Try git remote URL
  const gitProjectName = getProjectNameFromGit(cwd);
  if (gitProjectName) {
    projectConfig = findProjectConfig(gitProjectName);
    if (projectConfig) {
      return attachActiveRepository(projectConfig, cwd);
    }
  }

  // Strategy 3: Scan multi-repo projects' repositories[] by path/name
  const repoMatch = findProjectByRepository(cwd);
  if (repoMatch) {
    const worklogsRoot = getWorklogsPath();
    return {
      name: repoMatch.projectName,
      configPath: repoMatch.configPath,
      projectPath: path.dirname(repoMatch.configPath),
      worklogPath: path.join(worklogsRoot, 'logs'),
      tasksPath: path.join(worklogsRoot, repoMatch.projectName, 'tasks'),
      config: repoMatch.config,
      activeRepository: { ...repoMatch.matchedEntry, path: cwd },
      repositories: repoMatch.config.repositories,
    };
  }

  // Strategy 4: List available projects and suggest
  const worklogsPath = getWorklogsPath();
  let availableProjects = [];

  if (fs.existsSync(worklogsPath)) {
    availableProjects = fs.readdirSync(worklogsPath).filter((name) => {
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
        result.availableProjects.forEach((name) => {
          console.error(`  - ${name}`);
        });
      } else {
        console.error(
          `\nNo projects configured. Run setup to create a project.`,
        );
      }

      process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  getCurrentProject,
  getProjectNameFromPath,
  getProjectNameFromGit,
  findProjectByRepository,
};
