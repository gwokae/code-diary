# Code Diary

Agent skills for developer task management and daily work logging, with git/JIRA/GitHub/Linear integration. Works with any tool that supports the [Agent Skills specification](https://agentskills.io/specification), including [pi](https://github.com/badlogic/pi-mono) and [Claude Code](https://claude.com/claude-code).

| Skill         | Purpose                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `code-diary`  | Add projects and tasks, switch tasks, log work from git commits, archive, weekly summary, OKRs   |
| `project-pro` | Project-specific knowledge (patterns, conventions, pitfalls) stored alongside each project       |

## Requirements

- An Agent Skills-compatible coding agent such as [pi](https://github.com/badlogic/pi-mono) or [Claude Code](https://claude.com/claude-code)
- Node.js (the skills' helper scripts are `.cjs`)
- Git

## Install

1. Clone the repo:

   ```bash
   git clone git@github.com:gwokae/code-diary.git ~/workspace/code-diary
   ```

2. Link the skills into your agent's skills directory (symlinks keep them updated with `git pull`).

   **pi** (uses the shared Agent Skills location `~/.agents/skills/`):

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/workspace/code-diary/skills/code-diary ~/.agents/skills/code-diary
   ln -s ~/workspace/code-diary/skills/project-pro ~/.agents/skills/project-pro
   ```

   **Claude Code**:

   ```bash
   mkdir -p ~/.claude/skills
   ln -s ~/workspace/code-diary/skills/code-diary ~/.claude/skills/code-diary
   ln -s ~/workspace/code-diary/skills/project-pro ~/.claude/skills/project-pro
   ```

3. Set where worklogs and tasks are stored by adding this to your shell profile (`~/.zshrc` or `~/.bashrc`):

   ```bash
   export CODE_DIARY_PATH="$HOME/workspace/worklogs"
   ```

   Then reload your shell (`source ~/.zshrc`). If unset, it defaults to `~/workspace/worklogs`.

4. Restart your agent so the skills are picked up. In pi you can also run `/reload` in an active session, and force a skill with `/skill:code-diary`.

## Initialize a project

From inside your project's repo, ask your agent:

> add this project to code-diary

or run the script directly (use the path where you linked the skill, e.g. `~/.agents/skills` for pi or `~/.claude/skills` for Claude Code):

```bash
cd ~/workspace/my-project
node ~/.agents/skills/code-diary/scripts/init_project.cjs my-project --auto-detect
```

`--auto-detect` reads the main branch and issue tracker type from git. Other options (manual tracker settings, multi-repo projects) are in [`skills/code-diary/references/adding_project.md`](skills/code-diary/references/adding_project.md).

This creates:

```
$CODE_DIARY_PATH/
├── logs/                 # global worklogs (cross-project)
├── okrs/                 # OKR files, one per period
└── my-project/
    ├── project.json
    └── tasks/{new,working,archived}/
```

## Usage

Run from within the project directory; the project is detected automatically. Example prompts (in pi you can also invoke the skill explicitly with `/skill:code-diary ...`):

- "add task PROJ-123 fix login redirect"
- "switch to PROJ-123"
- "log work for today"
- "archive PROJ-123"
- "compose weekly"
- "record OKRs for 2026-h2"

Workflow details live in [`skills/code-diary/SKILL.md`](skills/code-diary/SKILL.md) and `skills/code-diary/references/`.
