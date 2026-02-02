#!/usr/bin/env node

/**
 * Display specific knowledge topic content
 */

const fs = require('fs');
const path = require('path');
const { getProjectKnowledgePath } = require('./config.cjs');

function showKnowledgeTopic(projectName, topicName) {
  const knowledgePath = getProjectKnowledgePath(projectName);
  const topicFile = path.join(knowledgePath, `${topicName}.md`);

  if (!fs.existsSync(knowledgePath)) {
    return {
      error: `Knowledge directory not found: ${knowledgePath}`,
    };
  }

  if (!fs.existsSync(topicFile)) {
    return {
      error: `Topic not found: ${topicName}`,
      suggestion: 'Run "node list.cjs <project>" to see available topics',
    };
  }

  try {
    const content = fs.readFileSync(topicFile, 'utf-8');

    return {
      project: projectName,
      topic: topicName,
      file: topicFile,
      content,
    };
  } catch (error) {
    return {
      error: `Failed to read topic: ${error.message}`,
    };
  }
}

// Main (for CLI usage)
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectName = args[0];
  const topicName = args[1];

  if (!projectName || !topicName || projectName === '--help' || projectName === '-h') {
    console.log('Usage: node show.cjs <project-name> <topic-name>');
    console.log('');
    console.log('Examples:');
    console.log('  node show.cjs connect translations');
    console.log('  node show.cjs connect components');
    process.exit(0);
  }

  const result = showKnowledgeTopic(projectName, topicName);

  if (result.error) {
    console.error(`Error: ${result.error}`);
    if (result.suggestion) {
      console.log('');
      console.log(result.suggestion);
    }
    process.exit(1);
  }

  console.log(result.content);
}

module.exports = {
  showKnowledgeTopic,
};
