import * as vscode from "vscode";
import { toggleChecklistItem } from "./markdown";
import { createNoteUri, DEVPAD_NOTE_VIEW_TYPE, getNoteIdFromUri } from "./noteUri";
import { DevPadStorage } from "./storage";
import { DevPadData, NoteRecord, SourceContext } from "./types";

interface DevPadCustomDocument extends vscode.CustomDocument {
  readonly noteId: string;
}

type EditorMessage =
  | { type: "ready" }
  | { type: "saveBody"; payload: { content: string } }
  | { type: "toggleChecklist"; payload: { itemIndex: number } }
  | { type: "openSource" };

export class DevPadNoteEditorProvider implements vscode.CustomReadonlyEditorProvider<DevPadCustomDocument> {
  private readonly panels = new Map<string, Set<vscode.WebviewPanel>>();

  constructor(
    private readonly storage: DevPadStorage,
    private readonly onOpenSource: (source: SourceContext) => Promise<void>,
    private readonly onNotesChanged: () => void,
  ) {}

  openCustomDocument(uri: vscode.Uri): DevPadCustomDocument {
    return {
      uri,
      noteId: getNoteIdFromUri(uri),
      dispose: () => undefined,
    };
  }

  async resolveCustomEditor(
    document: DevPadCustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const panels = this.panels.get(document.noteId) ?? new Set<vscode.WebviewPanel>();
    panels.add(webviewPanel);
    this.panels.set(document.noteId, panels);

    webviewPanel.onDidDispose(() => {
      const current = this.panels.get(document.noteId);
      current?.delete(webviewPanel);
      if (current && current.size === 0) {
        this.panels.delete(document.noteId);
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async (message: EditorMessage) => {
      await this.handleMessage(document.noteId, message);
    });

    await this.postNoteState(document.noteId);
  }

  async openNote(note: NoteRecord, column?: vscode.ViewColumn): Promise<void> {
    const uri = createNoteUri(note.id, note.title);
    await vscode.commands.executeCommand("vscode.openWith", uri, DEVPAD_NOTE_VIEW_TYPE, {
      viewColumn: column,
      preview: false,
    });
  }

  async refreshNote(noteId: string): Promise<void> {
    await this.postNoteState(noteId);
  }

  private async handleMessage(noteId: string, message: EditorMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.postNoteState(noteId);
        return;
      case "saveBody": {
        const data = await this.storage.load();
        const note = this.storage.getNote(data, noteId);
        if (!note) {
          return;
        }
        const updated = this.storage.updateNote(data, noteId, {
          title: note.title,
          content: message.payload.content,
          tags: note.tags,
        });
        await this.storage.save(updated);
        this.onNotesChanged();
        await this.postNoteState(noteId);
        return;
      }
      case "toggleChecklist": {
        const data = await this.storage.load();
        const note = this.storage.getNote(data, noteId);
        if (!note) {
          return;
        }

        const toggled = toggleChecklistItem(note.content, message.payload.itemIndex);
        const updated = this.storage.updateNote(data, noteId, {
          title: note.title,
          content: toggled.content,
          tags: note.tags,
        });
        await this.storage.save(updated);
        this.onNotesChanged();
        await this.postNoteState(noteId);
        return;
      }
      case "openSource": {
        const data = await this.storage.load();
        const note = this.storage.getNote(data, noteId);
        if (note?.sourceContext) {
          await this.onOpenSource(note.sourceContext);
        }
        return;
      }
      default:
        return;
    }
  }

  private async postNoteState(noteId: string): Promise<void> {
    const data = await this.storage.load();
    const note = this.storage.getNote(data, noteId);
    const panels = this.panels.get(noteId);
    if (!note || !panels) {
      return;
    }

    for (const panel of panels) {
      panel.title = note.title;
      panel.webview.postMessage({
        type: "state",
        payload: note,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevPad Note</title>
    <style>
      body {
        margin: 0;
        padding: 16px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
      }

      * { box-sizing: border-box; }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: calc(100vh - 32px);
      }
      textarea, button {
        font: inherit;
      }
      textarea {
        width: 100%;
        height: 100%;
        border: none;
        outline: none;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        padding: 0;
        line-height: 1.5;
        resize: none;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        tab-size: 2;
      }
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 6px 12px;
        cursor: pointer;
      }
      button.secondary {
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-editor-foreground);
      }
      .meta {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }
      .editor-shell {
        flex: 1;
        min-height: 0;
        display: flex;
      }
      .section {
        display: none;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-panel-border, transparent);
      }
      .section.visible { display: block; }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .tasks-list {
        display: grid;
        gap: 6px;
        max-height: 160px;
        overflow: auto;
      }
      .task-item {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 0;
      }
      .task-item input {
        margin-top: 2px;
      }
      .task-label {
        line-height: 1.45;
        word-break: break-word;
      }
      .task-label.done {
        color: var(--vscode-descriptionForeground);
        text-decoration: line-through;
      }
      code {
        font-family: var(--vscode-editor-font-family);
      }
    </style>
  </head>
  <body>
    <div class="stack">
      <div class="editor-shell">
        <textarea id="content"></textarea>
      </div>
      <div class="section" id="source-section">
        <div class="meta" id="source"></div>
        <div class="actions" id="source-actions"></div>
      </div>
      <div class="section" id="tasks-section">
        <div id="tasks"></div>
      </div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      let currentNote = null;
      const content = document.getElementById("content");
      const source = document.getElementById("source");
      const sourceActions = document.getElementById("source-actions");
      const sourceSection = document.getElementById("source-section");
      const tasks = document.getElementById("tasks");
      const tasksSection = document.getElementById("tasks-section");
      let saveTimer = null;

      content.addEventListener("input", () => {
        if (!currentNote) {
          return;
        }
        if (saveTimer) {
          clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
          vscode.postMessage({
            type: "saveBody",
            payload: {
              content: content.value
            }
          });
        }, 250);
      });

      function parseChecklist(text) {
        return text.split(/\\r?\\n/).reduce((acc, line) => {
          const match = line.match(/^(\\s*[-*]\\s+\\[)( |x|X)(\\]\\s.*)$/);
          if (!match) {
            return acc;
          }
          acc.push({
            label: match[3].slice(2),
            checked: match[2].toLowerCase() === "x"
          });
          return acc;
        }, []);
      }

      function renderTasks() {
        if (!currentNote) {
          tasks.innerHTML = "";
          tasks.className = "";
          tasksSection.classList.remove("visible");
          return;
        }

        const items = parseChecklist(currentNote.content);
        if (!items.length) {
          tasks.innerHTML = "";
          tasks.className = "";
          tasksSection.classList.remove("visible");
          return;
        }

        tasksSection.classList.add("visible");
        tasks.innerHTML = items.map((item, index) => {
          return '<label class="task-item">' +
            '<input type="checkbox" data-task-index="' + index + '" ' + (item.checked ? 'checked' : '') + ' />' +
            '<span class="task-label ' + (item.checked ? 'done' : '') + '">' + escapeHtml(item.label) + '</span>' +
          '</label>';
        }).join("");
        tasks.className = "tasks-list";

        tasks.querySelectorAll("[data-task-index]").forEach((checkbox) => {
          checkbox.addEventListener("change", () => {
            vscode.postMessage({
              type: "toggleChecklist",
              payload: { itemIndex: Number(checkbox.getAttribute("data-task-index")) }
            });
          });
        });
      }

      function renderSource() {
        sourceActions.innerHTML = "";
        if (!currentNote || !currentNote.sourceContext) {
          source.textContent = "";
          sourceSection.classList.remove("visible");
          return;
        }
        sourceSection.classList.add("visible");
        source.innerHTML = "<code>" + escapeHtml(currentNote.sourceContext.path + ":" + currentNote.sourceContext.startLine + "-" + currentNote.sourceContext.endLine) + "</code>";
        const button = document.createElement("button");
        button.textContent = "Open Source";
        button.className = "secondary";
        button.addEventListener("click", () => vscode.postMessage({ type: "openSource" }));
        sourceActions.appendChild(button);
      }

      function escapeHtml(value) {
        return value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }

      window.addEventListener("message", (event) => {
        if (event.data.type !== "state") {
          return;
        }
        currentNote = event.data.payload;
        if (document.activeElement !== content || content.value !== currentNote.content) {
          content.value = currentNote.content;
        }
        renderSource();
        renderTasks();
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
