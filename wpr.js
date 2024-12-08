#!/usr/bin/env node

/**
 * wpr
 * ----
 * A command-line tool to:
 * 1. Interactively search and select files using fuzzy search and autocompletion.
 * 2. Prompt the user for a single prompt string.
 * 3. Automatically generate a markdown filename based on the prompt (e.g., sanitize and use first few words).
 * 4. Store generated .md files in a "wpr/" subfolder.
 *
 * This script uses ES modules. Make sure that your package.json has "type": "module".
 *
 * Dependencies:
 *   npm install inquirer@9.2.8 inquirer-autocomplete-prompt@2.0.0 fs-extra@10.1.0 fuse.js@6.6.2
 *
 * Installation:
 *   - Make sure to chmod +x this file.
 *   - When run, if it's not installed (not accessible in your PATH as "wpr"), it will prompt to create a symlink.
 *
 * Usage:
 *   ./wpr
 *     Interactively select files, enter a prompt. The markdown filename is generated automatically from the prompt.
 *
 *   ./wpr --uninstall
 *     Remove the symlink if it exists.
 *
 *   ./wpr --config
 *     Creates a default wpr.conf file in the current directory if one doesn't exist.
 *
 * Configuration:
 *   If a wpr.conf file exists in the current directory, it should be a JSON file with:
 *   {
 *     "whitelist": ["optional/paths"],
 *     "blacklist": [".git", "node_modules", ...]
 *   }
 *   Whitelisted paths limit selection to those paths only. Blacklisted entries are excluded.
 *
 * The generated Markdown file will contain the prompt and the selected files' content.
 */

import fsExtra from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt';
import Fuse from 'fuse.js';

inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

const linkPath = '/usr/local/bin/wpr';

/**
 * Uninstall the symlink, removing "wpr" from PATH if it exists.
 */
async function uninstall() {
  try {
    await fsExtra.remove(linkPath);
    console.log(`Successfully removed symlink at ${linkPath}`);
  } catch (err) {
    console.error(`Error removing symlink: ${err.message}`);
  }
  process.exit(0);
}

/**
 * Ensure that the script is installed in the PATH. If not, prompt and create a symlink.
 */
async function ensureInstalled() {
  try {
    // Check if "wpr" is accessible in PATH by using `command -v`.
    execSync('command -v wpr', { stdio: 'ignore' });
  } catch {
    // If not installed, prompt user to install by creating symlink.
    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'wpr is not currently accessible in your PATH. Would you like to create a symlink so it can be run as "wpr"?',
        default: true
      }
    ]);

    if (install) {
      try {
        await fsExtra.ensureDir(path.dirname(linkPath));
        await fsExtra.symlink(path.resolve(process.argv[1]), linkPath);
        console.log(`Symlink created at ${linkPath}. You can now run "wpr" from anywhere.`);
      } catch (err) {
        console.error(`Failed to create symlink: ${err.message}`);
      }
    }
  }
}

/**
 * Load configuration from wpr.conf in the current directory, or use defaults if not found.
 */
async function loadConfig() {
  const configPath = path.join(process.cwd(), 'wpr.conf');
  if (await fsExtra.pathExists(configPath)) {
    const raw = await fsExtra.readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  }

  // Default config if no wpr.conf found
  return {
    whitelist: [],
    blacklist: [
      '.git',
      'node_modules',
      '.DS_Store',
      '.idea',
      '.vscode',
      'package-lock.json',
      'package.json',
      'yarn.lock'
    ]
  };
}

/**
 * Create a default wpr.conf file if it doesn't already exist.
 */
async function createDefaultConfig() {
  const configPath = path.join(process.cwd(), 'wpr.conf');
  if (await fsExtra.pathExists(configPath)) {
    console.log('wpr.conf already exists in this directory.');
    process.exit(0);
  }

  const defaultConfig = {
    whitelist: [],
    blacklist: [
      '.git',
      'node_modules',
      '.DS_Store',
      '.idea',
      '.vscode',
      'package-lock.json',
      'package.json',
      'yarn.lock'
    ]
  };

  await fsExtra.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  console.log('Created default wpr.conf in the current directory.');
  process.exit(0);
}

/**
 * Recursively gather all files from a given directory, applying whitelist/blacklist filters.
 * @param {string} dirPath - The directory to scan.
 * @param {object} config - The configuration object.
 * @param {string} relativeBase - The base path for relative path calculation.
 * @returns {Promise<string[]>} - A promise that resolves with an array of file paths.
 */
async function getAllFiles(dirPath, config, relativeBase = dirPath) {
  let files = [];
  const entries = await fsExtra.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(relativeBase, fullPath);

    // Skip blacklisted paths
    if (config.blacklist.some(b => relPath.includes(b))) {
      continue;
    }

    // If whitelist is not empty, only include files inside whitelisted paths.
    if (config.whitelist.length > 0 && !config.whitelist.some(w => relPath.startsWith(w))) {
      if (!entry.isDirectory()) {
        continue;
      }
    }

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, config, relativeBase);
      files = files.concat(subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Generate a safe filename from the prompt.
 * We'll take the prompt, convert to lowercase, replace non-alphanumeric chars with dashes,
 * and trim to a reasonable length. This ensures a safe filename.
 */
function generateFilenameFromPrompt(prompt) {
  const base = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const filename = base.length > 50 ? base.slice(0, 50) : base;
  return filename || 'prompt';
}

(async function main() {
  // Handle uninstall flag
  if (process.argv.includes('--uninstall')) {
    await uninstall();
    return;
  }

  // Handle config flag
  if (process.argv.includes('--config')) {
    await createDefaultConfig();
    return;
  }

  // Ensure the script is installed in PATH (i.e., accessible as wpr)
  await ensureInstalled();
  
  // Load configuration
  const config = await loadConfig();

  // Gather all files based on the config
  const allFiles = await getAllFiles(process.cwd(), config);

  // Create a Fuse instance for fuzzy searching the relative paths of all files
  const fuse = new Fuse(allFiles.map(f => path.relative(process.cwd(), f)), {
    threshold: 0.4,
    distance: 100,
    keys: ['file'],
  });

  let selectedFiles = [];
  let addingFiles = true;

  // Interactive loop to select files until the user chooses "Done"
  while (addingFiles) {
    const { file } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'file',
        message: 'Select a file to include or select "Done" to finish:',
        source: (answersSoFar, input) => {
          input = input || '';
          if (input.trim() === '') {
            // No input, show a "Done" option plus all files
            return Promise.resolve(['Done', ...allFiles.map(f => path.relative(process.cwd(), f))]);
          } else {
            // Fuzzy search the input against the file list
            const results = fuse.search(input);
            return Promise.resolve(results.map(r => r.item));
          }
        }
      }
    ]);

    if (file === 'Done') {
      addingFiles = false;
    } else {
      // Add the selected file if not already selected
      if (file && !selectedFiles.includes(file)) {
        selectedFiles.push(file);
      }
    }
  }

  // Prompt for the user's input prompt
  const { prompt: userPrompt } = await inquirer.prompt([
    {
      type: 'input',
      name: 'prompt',
      message: 'Enter the prompt:'
    }
  ]);

  // Generate a filename based on the prompt
  const filename = generateFilenameFromPrompt(userPrompt);

  // Ensure the wpr/ directory exists
  const wprDir = path.join(process.cwd(), 'wpr');
  await fsExtra.ensureDir(wprDir);

  // Construct the Markdown content
  let content = `# Prompt\n\n${userPrompt}\n\n---\n\n# Files:\n\n`;
  for (const f of selectedFiles) {
    const filePath = path.join(process.cwd(), f);
    const fileContent = await fsExtra.readFile(filePath, 'utf-8');
    content += `## ${f}\n\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
  }

  // The resulting file should be placed in the wpr/ folder
  const outFile = path.join(wprDir, `${filename}.md`);
  await fsExtra.writeFile(outFile, content, 'utf-8');
  console.log(`Created ${outFile} successfully.`);
})();
