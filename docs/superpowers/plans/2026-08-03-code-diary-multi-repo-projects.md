# Multi-Repo Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a code-diary project (like `mobility`) span multiple repositories, each with its own filesystem path and default/main branch, while keeping one shared task pool and Jira config — without changing behavior for existing single-repo projects (`connect`, `review`).

**Architecture:** `project.json` gains an optional `repositories[]` array (mutually exclusive with the existing singular `repository`). `get_current_project.cjs` gains a third detection strategy that scans `repositories[]` by `path` (primary) or `name` (fallback), and every result — legacy or multi-repo — is normalized to include `activeRepository`. `init_project.cjs` gains `--repositories`/`--add-repository` flags to create/extend multi-repo projects. Task frontmatter's `branches: [{repo, branch}]` list (multi-repo only) is a documentation-only convention — no script parses task frontmatter today, so this needs no code change.

**Tech Stack:** Plain Node.js CommonJS scripts (`.cjs`), no framework, no test runner. Repo: `~/workspace/code-diary` (symlinked into `~/.claude/skills/code-diary`).

## Global Constraints

- No test framework exists in this repo — every "test" step below is a real invocation of the CLI script against a scratch `CODE_DIARY_PATH`, with the exact expected output shown. Never touch the real `~/workspace/worklogs` during verification (Tasks 1–3); only Task 4 touches the real `mobility` project, deliberately.
- Backward compatibility is non-negotiable: `connect` and `review`'s `project.json` files must not change, and `get_current_project.cjs`'s existing two detection strategies must run exactly as before for them.
- Follow the ADR at `docs/adr/0002-multi-repo-projects.md` for the design rationale — don't re-derive it.
- Every new/changed field name below (`repositories`, `path`, `activeRepository`, `--add-repository`) must be used identically across all tasks — this file is the single source of truth for those names.

---

### Task 1: `init_project.cjs` — create/extend multi-repo projects

**Files:**
- Modify: `skills/code-diary/scripts/config.cjs` (export `expandPath`)
- Modify: `skills/code-diary/scripts/init_project.cjs`

**Interfaces:**
- Produces: `addRepositoryToProject(projectName, repoOptions): { configPath, config }` — exported alongside existing `initProject`/`autoDetectSettings`. `repoOptions` is `{ name, path, mainBranch, featureBranchRule? }`.
- Produces: `initProject(projectName, options)` now also accepts `options.repositories` (array of the same shape) — when present, writes `config.repositories` instead of `config.repository`.
- Consumes (Task 2): the `repositories[]` shape `{ name, path, mainBranch, featureBranchRule }` written here is exactly what `get_current_project.cjs` will read.

- [ ] **Step 1: Export `expandPath` from `config.cjs`**

In `skills/code-diary/scripts/config.cjs`, change the final export block:

```js
module.exports = {
  getWorklogsPath,
  isConfigured,
  getSetupInstructions,
  expandPath,
  ENV_VAR,
  DEFAULT_PATH,
};
```

- [ ] **Step 2: Verify the export**

Run: `node -e "console.log(require('/Users/gwokae/workspace/code-diary/skills/code-diary/scripts/config.cjs').expandPath('~/foo'))"`
Expected: prints `/Users/gwokae/foo` (your home directory + `/foo`)

- [ ] **Step 3: Add `normalizeRepositoryEntry` and `addRepositoryToProject` to `init_project.cjs`**

Add near the top, after the existing `autoDetectSettings` function:

```js
const { expandPath } = require('./config.cjs');

function normalizeRepositoryEntry(entry) {
  if (!entry.name) {
    throw new Error('Repository entry requires a "name"');
  }
  if (!entry.path) {
    throw new Error(`Repository "${entry.name}" requires a "path"`);
  }
  if (!entry.mainBranch) {
    throw new Error(`Repository "${entry.name}" requires a "mainBranch"`);
  }

  return {
    name: entry.name,
    path: expandPath(entry.path),
    mainBranch: entry.mainBranch,
    featureBranchRule: entry.featureBranchRule || 'feat/{filename}',
  };
}

function addRepositoryToProject(projectName, repoOptions) {
  const worklogsRoot = getWorklogsPath();
  const configPath = path.join(worklogsRoot, projectName, 'project.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Project "${projectName}" does not exist at ${configPath}. Create it first with init_project.cjs.`,
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const newEntry = normalizeRepositoryEntry(repoOptions);

  if (!Array.isArray(config.repositories)) {
    delete config.repository;
    config.repositories = [];
  }

  if (config.repositories.some((repo) => repo.name === newEntry.name)) {
    throw new Error(
      `Repository "${newEntry.name}" already exists in project "${projectName}". Edit ${configPath} manually to update it.`,
    );
  }

  config.repositories.push(newEntry);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return { configPath, config };
}
```

- [ ] **Step 4: Make `initProject` support `options.repositories`**

In `initProject`, replace:

```js
  // Add repository settings
  config.repository = {
    mainBranch: options.mainBranch || 'main',
    featureBranchRule: options.featureBranchRule || 'feat/{filename}',
  };
```

with:

```js
  // Add repository settings
  if (options.repositories) {
    config.repositories = options.repositories.map(normalizeRepositoryEntry);
  } else {
    config.repository = {
      mainBranch: options.mainBranch || 'main',
      featureBranchRule: options.featureBranchRule || 'feat/{filename}',
    };
  }
```

- [ ] **Step 5: Wire up CLI flags**

In the `if (require.main === module)` block, add `--add-repository`, `--path`, and `--repositories` parsing. Replace the argument-parsing `for` loop with:

```js
  const projectName = args[0];
  const options = {};
  let addRepositoryName = null;

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
    } else if (args[i] === '--path' && i + 1 < args.length) {
      options.path = args[i + 1];
      i++;
    } else if (args[i] === '--add-repository' && i + 1 < args.length) {
      addRepositoryName = args[i + 1];
      i++;
    } else if (args[i] === '--repositories' && i + 1 < args.length) {
      try {
        options.repositories = JSON.parse(args[i + 1]);
      } catch (error) {
        console.error(`Error: --repositories value is not valid JSON: ${error.message}`);
        process.exit(1);
      }
      i++;
    }
  }

  try {
    if (addRepositoryName) {
      const result = addRepositoryToProject(projectName, {
        name: addRepositoryName,
        path: options.path,
        mainBranch: options.mainBranch,
        featureBranchRule: options.featureBranchRule,
      });
      console.log(`✅ Repository "${addRepositoryName}" added to project "${projectName}"!`);
      console.log(`   Configuration: ${result.configPath}`);
      console.log('');
      console.log('Configuration:');
      console.log(JSON.stringify(result.config, null, 2));
    } else {
      const result = initProject(projectName, options);
      console.log(`✅ Project "${projectName}" initialized successfully!`);
      console.log(`   Configuration: ${result.configPath}`);
      console.log(`   Tasks directory: ${result.tasksPath}`);
      console.log('');
      console.log('Configuration:');
      console.log(JSON.stringify(result.config, null, 2));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
```

This replaces both the old argument-parsing loop AND the old `try { const result = initProject(...) ... }` block that followed it — the new block folds both branches (`--add-repository` vs. plain create) into one `try`.

- [ ] **Step 6: Update the `--help` output**

In the `console.log('Usage: ...')` help block (the `args.length === 0 || args[0] === '--help'` branch), after the existing `--auto-detect` line add:

```js
    console.log(
      '  --path <path>                    Absolute path to the repo (used with --add-repository or in --repositories entries)',
    );
    console.log(
      '  --add-repository <name>          Append a repo to an existing project\'s repositories[] (needs --path and --main-branch)',
    );
    console.log(
      '  --repositories <json>            Create a project with multiple repos in one shot: \'[{"name":..,"path":..,"mainBranch":..}]\'',
    );
```

And after the existing two `Examples:` lines, add:

```js
    console.log(
      '  node init_project.cjs my-project --add-repository my-repo --path ~/workspace/my-repo --main-branch develop',
    );
```

- [ ] **Step 7: Export the new function**

Change the final export line from:

```js
module.exports = { initProject, autoDetectSettings };
```

to:

```js
module.exports = { initProject, autoDetectSettings, addRepositoryToProject, normalizeRepositoryEntry };
```

- [ ] **Step 8: Verify — create a multi-repo project from scratch**

```bash
export CODE_DIARY_PATH=/tmp/code-diary-verify
rm -rf /tmp/code-diary-verify
mkdir -p /tmp/code-diary-verify/scratch-repo-a /tmp/code-diary-verify/scratch-repo-b
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs demo \
  --issue-tracker-type jira --issue-tracker-prefix DEMO --issue-tracker-url https://example.atlassian.net
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs demo \
  --add-repository repo-a --path /tmp/code-diary-verify/scratch-repo-a --main-branch develop
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs demo \
  --add-repository repo-b --path /tmp/code-diary-verify/scratch-repo-b --main-branch main
cat /tmp/code-diary-verify/demo/project.json
```

Expected: the first command creates `demo` with a placeholder singular `repository` (`mainBranch: "main"`, since no `--main-branch` was passed). The final `cat` must show **no `repository` key at all** — only `repositories`, an array of exactly two entries (`repo-a` with `mainBranch: "develop"`, `repo-b` with `mainBranch: "main"`), each with an absolute `path` and `featureBranchRule: "feat/{filename}"`. This confirms the discard-on-first-add behavior from the ADR.

- [ ] **Step 9: Verify — duplicate repository name is rejected**

```bash
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs demo \
  --add-repository repo-a --path /tmp/code-diary-verify/scratch-repo-a --main-branch develop
```

Expected: exits non-zero, prints `Error: Repository "repo-a" already exists in project "demo". Edit ... manually to update it.`

- [ ] **Step 10: Verify — `--repositories` one-shot creation**

```bash
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs demo2 \
  --issue-tracker-type jira --issue-tracker-prefix DEMO2 \
  --repositories '[{"name":"repo-a","path":"/tmp/code-diary-verify/scratch-repo-a","mainBranch":"develop"},{"name":"repo-b","path":"/tmp/code-diary-verify/scratch-repo-b","mainBranch":"main"}]'
cat /tmp/code-diary-verify/demo2/project.json
```

Expected: `repositories` array with both entries, `repository` key absent, `featureBranchRule` defaulted to `feat/{filename}` on both since it wasn't passed.

- [ ] **Step 11: Commit**

```bash
cd ~/workspace/code-diary
git add skills/code-diary/scripts/config.cjs skills/code-diary/scripts/init_project.cjs
git commit -m "feat(code-diary): support multi-repo projects in init_project.cjs"
```

---

### Task 2: `get_current_project.cjs` — detect multi-repo projects, normalize `activeRepository`

**Files:**
- Modify: `skills/code-diary/scripts/get_current_project.cjs`

**Interfaces:**
- Consumes: `repositories[]` shape from Task 1 (`{ name, path, mainBranch, featureBranchRule }`).
- Produces: `getCurrentProject(workingDir)` return value now always includes `activeRepository: { name, path, mainBranch, featureBranchRule }` on success. Multi-repo matches additionally include `repositories: [...]` (the full array). This is what `switching_tasks.md` (Task 3) will document reading.

- [ ] **Step 1: Add a path-resolving helper and the repositories-scan strategy**

Add after `getProjectNameFromGit`:

```js
function resolveRealPath(p) {
  try {
    return fs.realpathSync(p);
  } catch (error) {
    return path.resolve(p);
  }
}

function findProjectByRepository(cwd) {
  const worklogsRoot = getWorklogsPath();
  if (!fs.existsSync(worklogsRoot)) {
    return null;
  }

  const resolvedCwd = resolveRealPath(cwd);
  const cwdDirName = getProjectNameFromPath(cwd);
  const cwdGitName = getProjectNameFromGit(cwd);

  const projectNames = fs.readdirSync(worklogsRoot).filter((name) => {
    const configPath = path.join(worklogsRoot, name, 'project.json');
    return fs.existsSync(configPath);
  });

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

    const matchedEntry = config.repositories.find((repo) => {
      if (repo.path && resolveRealPath(repo.path) === resolvedCwd) {
        return true;
      }
      if (repo.name === cwdDirName) {
        return true;
      }
      if (cwdGitName && repo.name === cwdGitName) {
        return true;
      }
      return false;
    });

    if (matchedEntry) {
      return { projectName, configPath, config, matchedEntry };
    }
  }

  return null;
}
```

- [ ] **Step 2: Add `activeRepository` normalization**

Add right after `findProjectByRepository`:

```js
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
  return projectConfig;
}
```

- [ ] **Step 3: Wire the new strategy into `getCurrentProject`**

Replace the whole function body with:

```js
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
      activeRepository: repoMatch.matchedEntry,
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
```

- [ ] **Step 4: Export the new helpers**

Change the final export block to:

```js
module.exports = {
  getCurrentProject,
  getProjectNameFromPath,
  getProjectNameFromGit,
  findProjectByRepository,
};
```

- [ ] **Step 5: Verify — multi-repo detection resolves the right repo**

Using the `demo` project created in Task 1:

```bash
export CODE_DIARY_PATH=/tmp/code-diary-verify
node ~/workspace/code-diary/skills/code-diary/scripts/get_current_project.cjs /tmp/code-diary-verify/scratch-repo-a
```

Expected JSON includes:
```json
{
  "name": "demo",
  "activeRepository": {
    "name": "repo-a",
    "path": "/tmp/code-diary-verify/scratch-repo-a",
    "mainBranch": "develop",
    "featureBranchRule": "feat/{filename}"
  },
  "repositories": [ /* both repo-a and repo-b entries */ ]
}
```

Run the same command with `scratch-repo-b` instead — `activeRepository.mainBranch` must be `"main"`.

- [ ] **Step 6: Verify — legacy single-repo projects are unaffected**

```bash
unset CODE_DIARY_PATH
node ~/workspace/code-diary/skills/code-diary/scripts/get_current_project.cjs ~/workspace/connect
```

Expected: same output as before this change (name `connect`, `config.repository.mainBranch: "develop"`), **plus** a new `activeRepository: { "name": "connect", "path": "/Users/gwokae/workspace/connect", "mainBranch": "develop", "featureBranchRule": "feat/{filename}" }` field. No `repositories` key (single-repo projects never get one).

- [ ] **Step 7: Verify — not-found case still lists available projects**

```bash
export CODE_DIARY_PATH=/tmp/code-diary-verify
node ~/workspace/code-diary/skills/code-diary/scripts/get_current_project.cjs /tmp/code-diary-verify
```

Expected: exits non-zero, prints `Error: Project not found` and lists `demo`, `demo2` under "Available projects."

- [ ] **Step 8: Commit**

```bash
cd ~/workspace/code-diary
git add skills/code-diary/scripts/get_current_project.cjs
git commit -m "feat(code-diary): detect multi-repo projects, normalize activeRepository"
```

---

### Task 3: Update reference docs

**Files:**
- Modify: `skills/code-diary/references/project_config.md`
- Modify: `skills/code-diary/references/adding_project.md`
- Modify: `skills/code-diary/references/adding_tasks.md`
- Modify: `skills/code-diary/references/switching_tasks.md`

**Interfaces:**
- Consumes: exact flag names (`--repositories`, `--add-repository`, `--path`) from Task 1, exact field name (`activeRepository`, `repositories`) from Task 2.
- Produces: nothing consumed elsewhere — this task only needs to read correctly for a future Claude session following these docs.

- [ ] **Step 1: Document the `repositories[]` schema in `project_config.md`**

After the existing `### \`repository\` (object, required)` section, add:

```markdown
### `repositories` (array, optional)

Alternative to `repository`, for a project that spans multiple repos sharing one Jira/issue-tracker config. Mutually exclusive with `repository` — a project has one or the other, never both.

Each entry:

```json
{
  "name": "umr-local",
  "path": "/Users/you/workspace/umr-local",
  "mainBranch": "main",
  "featureBranchRule": "feat/{filename}"
}
```

- **`name`**: stable identifier, used as a fallback match (directory basename or git remote) and as the `repo` key in a multi-repo task's `branches:` frontmatter list.
- **`path`**: absolute, this-machine path to the repo. Primary match for detection; also where to `cd` when acting on this repo.
- **`mainBranch`** / **`featureBranchRule`**: same meaning as the singular `repository` fields, but scoped to this one repo.

### `activeRepository` (in `get_current_project.cjs` output, not in `project.json`)

Every successful `get_current_project.cjs` result includes a normalized `activeRepository: { name, path, mainBranch, featureBranchRule }`, resolved from whichever repo matches the cwd you passed in — regardless of whether the project uses `repository` or `repositories`. Read `activeRepository.mainBranch` (not `config.repository.mainBranch`) when you need "the main branch for the repo I'm currently in." Multi-repo results also include the full `repositories` array.
```

- [ ] **Step 2: Document the new `init_project.cjs` flags in `adding_project.md`**

After the existing "Manual configuration" bullet list, add:

```markdown
- **Multi-repo project** (a project spanning several repos, e.g. one Jira project touching 4 repos):
  - One-shot: `--repositories '<json-array>'`, each entry `{name, path, mainBranch, featureBranchRule?}`
  - Incremental: `--add-repository <name> --path <path> --main-branch <branch> [--feature-branch-rule <rule>]` — appends to an *existing* project. The first `--add-repository` call on a project that still has the old singular `repository` field discards it and starts a fresh `repositories[]` — there's no automatic migration of the old field's values, since a placeholder single-repo guess usually doesn't match any of the real repos.
```

And after the "Manual configuration" example, add:

```markdown
Multi-repo, incremental:

```bash
node scripts/init_project.cjs mobility --issue-tracker-type jira --issue-tracker-url https://example.atlassian.net --issue-tracker-prefix PROJ
node scripts/init_project.cjs mobility --add-repository umr       --path ~/workspace/umr       --main-branch develop
node scripts/init_project.cjs mobility --add-repository ui-commons --path ~/workspace/ui-commons --main-branch main
```
```

- [ ] **Step 3: Document `branches: []` initialization for multi-repo projects in `adding_tasks.md`**

Change frontmatter step 3's `branch` bullet from:

```markdown
     - `branch`: Generated from filename using project's `featureBranchRule`
```

to:

```markdown
     - `branch`: Generated from filename using project's `featureBranchRule` — **only for single-repo projects** (`get_current_project.cjs` result has no `repositories` key)
     - For multi-repo projects (result has a `repositories` key): use `branches: []` (empty list) instead of `branch` — which repo(s) this task touches isn't known until a branch is actually created during Workflow 3 (Switching Tasks)
```

- [ ] **Step 4: Document `activeRepository`/`branches[]` resolution in `switching_tasks.md`**

In the "Git workflow" section, change:

```markdown
6. Git workflow:
   - Ensure working directory is clean
   - Check if branch exists:
```

to:

```markdown
6. Git workflow:
   - Ensure working directory is clean
   - Resolve the base branch from `activeRepository.mainBranch` (from `get_current_project.cjs`'s output for your current cwd) — **not** `config.repository.mainBranch` directly. This is the same field for single- and multi-repo projects, so this step doesn't change based on project type.
   - Check if branch exists:
```

And after the existing "Rework branches" section, add:

```markdown
**Multi-repo projects — recording branches per repo:**
If the current project's `get_current_project.cjs` result has a `repositories` key, the task file's frontmatter uses `branches: [{repo, branch}]` instead of a single `branch:` string (see `adding_tasks.md`). When creating or switching to a branch:

- Append `{repo: activeRepository.name, branch: <branch-name>}` to the task's `branches:` list if that repo isn't already in it.
- If that repo IS already in the list, use its recorded `branch` value rather than generating a new name.
- Most tasks still touch only one repo — `branches:` having one entry is the common case, not a sign something's wrong.
```

- [ ] **Step 5: Verify — grep for the new terms**

```bash
cd ~/workspace/code-diary
grep -n "repositories" skills/code-diary/references/project_config.md skills/code-diary/references/adding_project.md
grep -n "activeRepository" skills/code-diary/references/project_config.md skills/code-diary/references/switching_tasks.md
grep -n "branches" skills/code-diary/references/adding_tasks.md skills/code-diary/references/switching_tasks.md
```

Expected: each command prints at least one matching line per file — confirms the edits landed in the right files.

- [ ] **Step 6: Commit**

```bash
cd ~/workspace/code-diary
git add skills/code-diary/references/project_config.md skills/code-diary/references/adding_project.md skills/code-diary/references/adding_tasks.md skills/code-diary/references/switching_tasks.md
git commit -m "docs(code-diary): document multi-repo projects, activeRepository, branches[] frontmatter"
```

---

### Task 4: Migrate the real `mobility` project

**Files:**
- Modify (data, not code): `~/workspace/worklogs/mobility/project.json`

**Interfaces:**
- Consumes: `--add-repository` from Task 1, `activeRepository` resolution from Task 2. No new interfaces produced — this is the end-to-end validation that Tasks 1–3 actually solve the motivating problem.

- [ ] **Step 1: Confirm the current placeholder state**

```bash
unset CODE_DIARY_PATH
cat ~/workspace/worklogs/mobility/project.json
```

Expected: shows the placeholder singular `repository` (guessed from `mobility-portal`, `mainBranch: "develop"`) from when this project was first created.

- [ ] **Step 2: Add all four real repositories**

```bash
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs mobility \
  --add-repository mobility-portal --path ~/workspace/mobility-portal --main-branch develop
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs mobility \
  --add-repository umr --path ~/workspace/umr --main-branch develop
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs mobility \
  --add-repository umr-local --path ~/workspace/umr-local --main-branch main
node ~/workspace/code-diary/skills/code-diary/scripts/init_project.cjs mobility \
  --add-repository ui-commons --path ~/workspace/ui-commons --main-branch main
```

- [ ] **Step 3: Verify the final config**

```bash
cat ~/workspace/worklogs/mobility/project.json
```

Expected: `repository` key is gone; `repositories` is an array of exactly 4 entries (`mobility-portal`/`umr` with `mainBranch: "develop"`, `umr-local`/`ui-commons` with `mainBranch: "main"`), `issueTracker` unchanged (`type: "jira"`, `baseUrl: "https://ubiquiti.atlassian.net"`, `projectPrefix: "LTEF"`).

- [ ] **Step 4: Verify detection from each of the 4 real repos**

```bash
for repo in mobility-portal umr umr-local ui-commons; do
  echo "== $repo =="
  node ~/workspace/code-diary/skills/code-diary/scripts/get_current_project.cjs ~/workspace/$repo | grep -A4 activeRepository
done
```

Expected: each block shows `"name": "<repo>"` and the correct `mainBranch` (`develop` for `mobility-portal`/`umr`, `main` for `umr-local`/`ui-commons`) — and the top-level `"name"` (visible earlier in each full JSON output, check by running without `grep` if you want the full picture) is `mobility` in all four cases.

- [ ] **Step 5: Verify `connect` and `review` are untouched**

```bash
git -C ~/workspace/worklogs status --short
```

Expected: only `mobility/project.json` shows as modified — no changes to `connect/project.json` or anything under `review/`.

- [ ] **Step 6: Commit the worklogs change** (separate repo from code-diary itself)

```bash
cd ~/workspace/worklogs
git add mobility/project.json
git commit -m "chore(mobility): register the 4 real repos, drop placeholder single-repo config"
```
