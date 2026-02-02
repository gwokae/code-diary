---
name: project-pro
description: Project-specific knowledge and patterns for frontend projects. Use when working on projects that need architectural guidance, coding conventions, common pitfalls, or best practices. Automatically loads relevant knowledge based on current project context.
---

# Project Pro

Manages project-specific knowledge, patterns, and conventions to help maintain consistency and avoid common pitfalls.

## Overview

Project Pro stores project-specific knowledge in `$CODE_DIARY_PATH/<project>/knowledge/` alongside tasks and project configuration. This keeps domain knowledge close to the project work and makes it easy to reference common patterns and avoid known pitfalls.

## Directory Structure

```
$CODE_DIARY_PATH/
└── <project>/
    ├── project.json
    ├── tasks/
    └── knowledge/           # Project-specific knowledge
        ├── index.md         # Knowledge catalog
        ├── translations.md  # Translation guidelines
        ├── components.md    # Component patterns
        └── ...
```

## Environment Setup

Project Pro uses the `CODE_DIARY_PATH` environment variable (shared with code-diary).

**Setup:**

```bash
# Add to ~/.zshrc or ~/.bashrc
export CODE_DIARY_PATH="~/workspace/worklogs"

# Reload shell
source ~/.zshrc
```

**Default:** `~/workspace/worklogs` if not configured

## Commands

### List Knowledge Topics

Show all available knowledge topics for a project:

```bash
node scripts/list.cjs <project-name>
```

**Example:**
```bash
node scripts/list.cjs connect
```

**Output:**
- Topic names
- Brief descriptions
- Total count

### Show Knowledge Content

Display full content of a specific knowledge topic:

```bash
node scripts/show.cjs <project-name> <topic-name>
```

**Example:**
```bash
node scripts/show.cjs connect translations
```

**Output:**
- Full markdown content of the topic
- Guidelines, patterns, examples
- Common pitfalls

## Knowledge Format

Each knowledge file uses structured markdown:

```markdown
# Topic Title

Brief description of the topic.

## Guidelines

Core rules and principles.

## Patterns

Common patterns and how to implement them.

## Examples

Code examples demonstrating the pattern.

## Pitfalls

Common mistakes and how to avoid them.
```

## Creating Knowledge

Knowledge files are stored as markdown in `$CODE_DIARY_PATH/<project>/knowledge/`.

**To add new knowledge:**

1. Create a new `.md` file in the project's knowledge directory
2. Use structured markdown format
3. Include guidelines, patterns, examples, and pitfalls
4. Update `index.md` to catalog the new topic

**Example:**

```bash
# Create new knowledge file
echo "# API Patterns" > $CODE_DIARY_PATH/connect/knowledge/api.md

# Edit the file
vim $CODE_DIARY_PATH/connect/knowledge/api.md

# Verify it appears in list
node scripts/list.cjs connect
```

## Automatic Context Loading

When working on a project, Claude can automatically reference knowledge files as needed. For example:

- Working on translations → Reads `knowledge/translations.md`
- Creating components → Reads `knowledge/components.md`
- Redux questions → Reads `knowledge/redux.md`

Knowledge files are loaded on-demand to save context window space.

## Best Practices

1. **Keep knowledge focused** - One topic per file
2. **Use examples** - Show don't tell
3. **Document pitfalls** - Capture common mistakes
4. **Update regularly** - Add learnings as you discover them
5. **Be concise** - Token efficiency matters

## Integration with Code Diary

Project Pro shares the same `CODE_DIARY_PATH` environment variable with code-diary, keeping tasks and knowledge organized together:

```
$CODE_DIARY_PATH/
├── connect/
│   ├── project.json        # Project config (code-diary)
│   ├── tasks/              # Task tracking (code-diary)
│   └── knowledge/          # Domain knowledge (project-pro)
└── logs/                   # Work logs (code-diary)
```

## Helper Scripts

All scripts are in `scripts/` directory:

- **`config.cjs`**: Configuration management using CODE_DIARY_PATH
- **`list.cjs`**: List available knowledge topics
- **`show.cjs`**: Display specific knowledge content
