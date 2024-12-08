# wpr (WonderPrompt)

`wpr` is a command-line tool designed to help you quickly gather files from your project, bundle them together with a prompt you provide, and produce a nicely formatted Markdown file containing both the prompt and the selected files' contents.

## Features

- **Fuzzy Search & Autocomplete:** Quickly find and select files within your project, even in large codebases.
- **Selective Inclusion:** Include only the files you need to reference. Use `Done` to finish selecting files.
- **Automated Markdown Generation:** After entering a single prompt, `wpr` automatically creates a Markdown file with the provided prompt and the selected files embedded.
- **Configurable:** Use a `wpr.conf` file (optional) to blacklist certain files or whitelist directories, ensuring that irrelevant files never clutter your selection.
- **Automatic Filename Generation:** Based on the prompt you provide, `wpr` will generate a filename and store your new Markdown file in the `wpr/` directory.
- **Installation & Management:** Automatically prompt to install a symlink to `wpr` in your `PATH`, making it easy to run from anywhere. Also offers `--uninstall` to remove the symlink and `--config` to generate a default configuration file.

## Requirements

- Node.js (with ES Module support)
- A `package.json` with `"type": "module"`
- Installed dependencies:
  ```bash
  npm install inquirer@9.2.8 inquirer-autocomplete-prompt@2.0.0 fs-extra@10.1.0 fuse.js@6.6.2
