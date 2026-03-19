import * as vscode from "vscode";
import { DEVPAD_NOTE_VIEW_TYPE } from "./noteUri";
import { DevPadNoteEditorProvider } from "./noteEditor";
import { DevPadSidebarProvider, NoteTreeItem } from "./sidebar";
import { DevPadStorage } from "./storage";
import { SourceContext } from "./types";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new DevPadStorage(context.workspaceState);
  const sidebarProvider = new DevPadSidebarProvider(storage);
  const noteEditorProvider = new DevPadNoteEditorProvider(
    storage,
    async (source) => openSnippetSource(source),
    () => {
      sidebarProvider.refresh();
      treeView.message = sidebarProvider.getViewMessage();
    },
  );
  const treeView = vscode.window.createTreeView("devpad.sidebar", {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false,
  });

  context.subscriptions.push(
    treeView,
    vscode.window.registerCustomEditorProvider(DEVPAD_NOTE_VIEW_TYPE, noteEditorProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: true,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpad.openPanel", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.devpad");
      treeView.message = sidebarProvider.getViewMessage();
    }),
    vscode.commands.registerCommand("devpad.addNote", async () => {
      const data = await storage.load();
      const note = storage.createNote();
      const updated = storage.upsertNote(data, note);
      await storage.save(updated);
      sidebarProvider.refresh();
      treeView.message = sidebarProvider.getViewMessage();
      await vscode.commands.executeCommand("workbench.view.extension.devpad");
      await revealNoteInSidebar(treeView, sidebarProvider, note.id);
      await noteEditorProvider.openNote(note);
    }),
    vscode.commands.registerCommand("devpad.openNote", async (input?: string | NoteTreeItem) => {
      const noteId = typeof input === "string" ? input : input?.note.id;
      if (!noteId) {
        return;
      }
      const data = await storage.load();
      const note = storage.getNote(data, noteId);
      if (!note) {
        await vscode.window.showWarningMessage("DevPad could not find that note.");
        return;
      }
      await noteEditorProvider.openNote(note);
    }),
    vscode.commands.registerCommand("devpad.renameNote", async (input?: string | NoteTreeItem) => {
      const noteId = typeof input === "string" ? input : input?.note.id;
      if (!noteId) {
        return;
      }
      const changed = await sidebarProvider.renameNote(noteId);
      if (!changed) {
        return;
      }
      treeView.message = sidebarProvider.getViewMessage();
      await noteEditorProvider.refreshNote(noteId);
    }),
    vscode.commands.registerCommand("devpad.editNoteTags", async (input?: string | NoteTreeItem) => {
      const noteId = typeof input === "string" ? input : input?.note.id;
      if (!noteId) {
        return;
      }
      const changed = await sidebarProvider.editNoteTags(noteId);
      if (!changed) {
        return;
      }
      treeView.message = sidebarProvider.getViewMessage();
      await noteEditorProvider.refreshNote(noteId);
    }),
    vscode.commands.registerCommand("devpad.deleteNote", async (input?: string | NoteTreeItem) => {
      const noteId = typeof input === "string" ? input : input?.note.id;
      if (!noteId) {
        return;
      }
      const changed = await sidebarProvider.deleteNote(noteId);
      if (!changed) {
        return;
      }
      treeView.message = sidebarProvider.getViewMessage();
    }),
    vscode.commands.registerCommand("devpad.searchNotes", async () => {
      await sidebarProvider.updateSearchText();
      treeView.message = sidebarProvider.getViewMessage();
    }),
    vscode.commands.registerCommand("devpad.filterByTag", async () => {
      await sidebarProvider.updateTagFilter();
      treeView.message = sidebarProvider.getViewMessage();
    }),
    vscode.commands.registerCommand("devpad.clearFilters", () => {
      sidebarProvider.clearFilters();
      treeView.message = sidebarProvider.getViewMessage();
    }),
    vscode.commands.registerCommand("devpad.saveSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showInformationMessage("DevPad needs an active editor selection to save a snippet.");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        await vscode.window.showInformationMessage("Select some code before running DevPad: Save Selection.");
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const path = workspaceFolder
        ? vscode.workspace.asRelativePath(editor.document.uri, false)
        : editor.document.uri.fsPath;

      const capture = {
        text: editor.document.getText(selection),
        path,
        startLine: selection.start.line + 1,
        endLine: selection.end.line + 1,
      };
      const data = await storage.load();
      const note = storage.createSnippetNote(capture);
      const updated = storage.upsertNote(data, note);
      await storage.save(updated);
      sidebarProvider.refresh();
      treeView.message = sidebarProvider.getViewMessage();
      await vscode.commands.executeCommand("workbench.view.extension.devpad");
      await revealNoteInSidebar(treeView, sidebarProvider, note.id);
      await noteEditorProvider.openNote(note);
    }),
    vscode.commands.registerCommand("devpad.openSnippetSource", async (source?: SourceContext) => {
      if (!source) {
        await vscode.window.showInformationMessage("No DevPad snippet source was provided.");
        return;
      }

      await openSnippetSource(source);
    }),
  );

  await sidebarProvider.initialize();
  treeView.message = sidebarProvider.getViewMessage();
}

export function deactivate(): void {}

async function revealNoteInSidebar(
  treeView: vscode.TreeView<NoteTreeItem>,
  sidebarProvider: DevPadSidebarProvider,
  noteId: string,
): Promise<void> {
  const children = await sidebarProvider.getChildren();
  const item = children.find((child) => child.note.id === noteId);
  if (!item) {
    return;
  }

  await treeView.reveal(item, {
    focus: false,
    select: true,
    expand: false,
  });
}

async function openSnippetSource(source: SourceContext): Promise<void> {
  const candidates = vscode.workspace.workspaceFolders?.map((folder) => vscode.Uri.joinPath(folder.uri, source.path)) ?? [];
  let uri: vscode.Uri | undefined;

  for (const candidate of candidates) {
    try {
      await vscode.workspace.fs.stat(candidate);
      uri = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!uri) {
    uri = vscode.Uri.file(source.path);
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const start = new vscode.Position(Math.max(source.startLine - 1, 0), 0);
    const end = new vscode.Position(Math.max(source.endLine - 1, 0), 0);
    const selection = new vscode.Selection(start, end);
    editor.selection = selection;
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
  } catch {
    await vscode.window.showWarningMessage(`DevPad could not reopen snippet source: ${source.path}`);
  }
}
