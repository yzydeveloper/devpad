import * as vscode from "vscode";
import { DevPadStorage, DEFAULT_QUERY } from "./storage";
import { DevPadData, NoteRecord, QueryState } from "./types";

export class DevPadSidebarProvider implements vscode.TreeDataProvider<NoteTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<NoteTreeItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private data: DevPadData = { version: 1, notes: [] };
  private query: QueryState = { ...DEFAULT_QUERY };

  constructor(private readonly storage: DevPadStorage) {}

  async initialize(): Promise<void> {
    this.data = await this.storage.load();
    this.refresh();
  }

  getTreeItem(element: NoteTreeItem): vscode.TreeItem {
    return element;
  }

  getParent(_element: NoteTreeItem): vscode.ProviderResult<NoteTreeItem> {
    return undefined;
  }

  async getChildren(): Promise<NoteTreeItem[]> {
    this.data = await this.storage.load();
    const notes = this.filterNotes(this.data.notes);

    return notes.map((note) => {
      const descriptionParts: string[] = [];
      if (note.tags.length) {
        descriptionParts.push(note.tags.map((tag) => `#${tag}`).join(" "));
      }
      if (note.statusSummary.total > 0) {
        descriptionParts.push(`${note.statusSummary.completed}/${note.statusSummary.total}`);
      }
      if (note.sourceContext) {
        descriptionParts.push(`${note.sourceContext.path}:${note.sourceContext.startLine}`);
      }

      return new NoteTreeItem(note, descriptionParts.join(" • "));
    });
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  async updateSearchText(): Promise<void> {
    const searchText = await vscode.window.showInputBox({
      title: "Search DevPad Notes",
      value: this.query.searchText,
      prompt: "Filter notes by title, content, tags, or source path",
      placeHolder: "Search notes",
    });

    if (searchText === undefined) {
      return;
    }

    this.query.searchText = searchText.trim();
    this.refresh();
  }

  async updateTagFilter(): Promise<void> {
    this.data = await this.storage.load();
    const tags = [...new Set(this.data.notes.flatMap((note) => note.tags))].sort();
    const selection = await vscode.window.showQuickPick(
      [
        { label: "All tags", tag: "" },
        ...tags.map((tag) => ({ label: `#${tag}`, tag })),
      ],
      {
        title: "Filter DevPad Notes By Tag",
      },
    );

    if (!selection) {
      return;
    }

    this.query.selectedTag = selection.tag;
    this.refresh();
  }

  clearFilters(): void {
    this.query = { ...DEFAULT_QUERY };
    this.refresh();
  }

  async renameNote(noteId: string): Promise<boolean> {
    this.data = await this.storage.load();
    const note = this.storage.getNote(this.data, noteId);
    if (!note) {
      return false;
    }

    const title = await vscode.window.showInputBox({
      title: "Rename DevPad Note",
      value: note.title,
      prompt: "Update the note title shown in the sidebar",
      placeHolder: "Note title",
    });

    if (title === undefined) {
      return false;
    }

    const updated = this.storage.renameNote(this.data, noteId, title.trim() || note.title);
    await this.storage.save(updated);
    this.data = updated;
    this.refresh();
    return true;
  }

  async editNoteTags(noteId: string): Promise<boolean> {
    this.data = await this.storage.load();
    const note = this.storage.getNote(this.data, noteId);
    if (!note) {
      return false;
    }

    const value = await vscode.window.showInputBox({
      title: "Edit DevPad Note Tags",
      value: note.tags.map((tag) => `#${tag}`).join(", "),
      prompt: "Enter comma-separated tags",
      placeHolder: "#bug, #idea",
    });

    if (value === undefined) {
      return false;
    }

    const tags = value
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);

    const updated = this.storage.updateNoteTags(this.data, noteId, tags);
    await this.storage.save(updated);
    this.data = updated;
    this.refresh();
    return true;
  }

  async deleteNote(noteId: string): Promise<boolean> {
    this.data = await this.storage.load();
    const note = this.storage.getNote(this.data, noteId);
    if (!note) {
      return false;
    }

    const choice = await vscode.window.showWarningMessage(
      `Delete "${note.title}"?`,
      { modal: true },
      "Delete",
    );

    if (choice !== "Delete") {
      return false;
    }

    const updated = this.storage.deleteNote(this.data, noteId);
    await this.storage.save(updated);
    this.data = updated;
    this.refresh();
    return true;
  }

  getViewMessage(): string | undefined {
    const parts: string[] = [];
    if (this.query.searchText) {
      parts.push(`Search: ${this.query.searchText}`);
    }
    if (this.query.selectedTag) {
      parts.push(`Tag: #${this.query.selectedTag}`);
    }
    if (this.query.taskFilter !== "all") {
      parts.push(`Tasks: ${this.query.taskFilter}`);
    }

    return parts.length ? parts.join(" | ") : undefined;
  }

  private filterNotes(notes: NoteRecord[]): NoteRecord[] {
    return notes.filter((note) => {
      const searchText = this.query.searchText.toLowerCase();
      if (searchText) {
        const haystack = [
          note.title,
          note.content,
          note.tags.join(" "),
          note.sourceContext?.path ?? "",
        ]
          .join("\n")
          .toLowerCase();
        if (!haystack.includes(searchText)) {
          return false;
        }
      }

      if (this.query.selectedTag && !note.tags.includes(this.query.selectedTag)) {
        return false;
      }

      if (this.query.taskFilter === "active" && note.statusSummary.active === 0) {
        return false;
      }
      if (this.query.taskFilter === "completed" && note.statusSummary.completed === 0) {
        return false;
      }

      return true;
    });
  }
}

export class NoteTreeItem extends vscode.TreeItem {
  constructor(
    readonly note: NoteRecord,
    description: string,
  ) {
    super(note.title, vscode.TreeItemCollapsibleState.None);
    this.id = note.id;
    this.description = description;
    this.tooltip = new vscode.MarkdownString([note.title, "", description].filter(Boolean).join("\n\n"));
    this.contextValue = "devpadNote";
    this.iconPath = note.sourceContext ? new vscode.ThemeIcon("code") : new vscode.ThemeIcon("note");
    this.command = {
      command: "devpad.openNote",
      title: "Open DevPad Note",
      arguments: [note.id],
    };
  }
}
