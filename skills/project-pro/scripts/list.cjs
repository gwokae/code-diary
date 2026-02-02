#!/usr/bin/env node

/**
 * List available knowledge topics for a project
 */

const fs = require('fs');
const path = require('path');
const { getProjectKnowledgePath } = require('./config.cjs');

function listKnowledgeTopics(projectName) {
  const knowledgePath = getProjectKnowledgePath(projectName);

  if (!fs.existsSync(knowledgePath)) {
    return {
      error: `Knowledge directory not found: ${knowledgePath}`,
      topics: [],
      path: knowledgePath,
    };
  }

  try {
    const files = fs
      .readdirSync(knowledgePath)
      .filter((file) => file.endsWith('.md'))
      .sort();

    const topics = files.map((file) => {
      const topicName = file.replace('.md', '');
      const filePath = path.join(knowledgePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract first heading as description
      const match = content.match(/^#\s+(.+)$/m);
      const title = match ? match[1] : topicName;

      // Extract first paragraph as description
      const descMatch = content.match(/^#.+\n\n(.+?)(\n\n|$)/ms);
      const description = descMatch ? descMatch[1].trim() : '';

      return {
        name: topicName,
        file,
        title,
        description: description.slice(0, 100) + (description.length > 100 ? '...' : ''),
      };
    });

    return {
      project: projectName,
      path: knowledgePath,
      count: topics.length,
      topics,
    };
  } catch (error) {
    return {
      error: `Failed to read knowledge directory: ${error.message}`,
      topics: [],
      path: knowledgePath,
    };
  }
}

// Main (for CLI usage)
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectName = args[0];

  if (!projectName || projectName === '--help' || projectName === '-h') {
    console.log('Usage: node list.cjs <project-name>');
    console.log('');
    console.log('Examples:');
    console.log('  node list.cjs connect');
    console.log('  node list.cjs my-project');
    process.exit(0);
  }

  const result = listKnowledgeTopics(projectName);

  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\n📚 ${result.project} knowledge (${result.count} topics)\n`);
  console.log(`Path: ${result.path}\n`);

  if (result.topics.length === 0) {
    console.log('No knowledge topics found.');
    console.log('');
    console.log('Create a markdown file in the knowledge directory to get started:');
    console.log(`  ${result.path}/translations.md`);
  } else {
    result.topics.forEach((topic) => {
      console.log(`• ${topic.name}`);
      if (topic.title !== topic.name) {
        console.log(`  ${topic.title}`);
      }
      if (topic.description) {
        console.log(`  ${topic.description}`);
      }
      console.log('');
    });
  }
}

module.exports = {
  listKnowledgeTopics,
};
