# DevPad

[简体中文](./README.zh-CN.md)

DevPad is a lightweight VSCode workspace notes extension for capturing ideas, TODOs, and code snippets without leaving your coding context.

## Features And Goals

- Integrated into the workspace as an Activity Bar sidebar view
- Note body editing in the main editor area with a document-like flow
- Workspace-scoped notes with tags, search, and filtering
- Save the current code selection and jump back to the original source
- Uses VSCode workspace storage by default, so it does not create note files in your repository or pollute `git status`

Current product goals:

- Keep note-taking inside the coding workflow
- Stay native, simple, and low-noise inside VSCode
- Focus on personal developer scratchpad workflows instead of a heavy knowledge base

## Development

### Requirements

- Node.js 20+
- VSCode 1.88+

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch

```bash
npm run watch
```

### Type Check

```bash
npm run lint
```

### Run Locally

1. Open this repository in VSCode.
2. Press `F5`.
3. Open `DevPad` in the new Extension Development Host window.

If you change manifest-level resources such as Activity Bar icons or contributed views, restart the Extension Development Host instead of relying only on hot reload.

## Commands

- `DevPad: Open Panel`
- `DevPad: Add Note`
- `DevPad: Open Note`
- `DevPad: Rename Note`
- `DevPad: Edit Note Tags`
- `DevPad: Delete Note`
- `DevPad: Search Notes`
- `DevPad: Filter Notes By Tag`
- `DevPad: Clear Filters`
- `DevPad: Save Selection`
- `DevPad: Open Snippet Source`
