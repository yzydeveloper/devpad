import * as vscode from "vscode";
import { summarizeChecklist } from "./markdown";
import {
  DevPadData,
  NoteRecord,
  QueryState,
  SelectionCapture,
  SourceContext,
  STORAGE_KEY,
  STORAGE_VERSION,
} from "./types";

export const DEFAULT_QUERY: QueryState = {
  searchText: "",
  selectedTag: "",
  taskFilter: "all",
};

export class DevPadStorage {
  constructor(private readonly workspaceState: vscode.Memento) {}

  async load(): Promise<DevPadData> {
    const raw = this.workspaceState.get<DevPadData>(STORAGE_KEY);
    if (!raw || raw.version !== STORAGE_VERSION || !Array.isArray(raw.notes)) {
      const empty = this.createEmpty();
      await this.workspaceState.update(STORAGE_KEY, empty);
      return empty;
    }

    const normalized: DevPadData = {
      version: STORAGE_VERSION,
      notes: raw.notes.map((note) => this.normalizeNote(note)),
    };

    await this.workspaceState.update(STORAGE_KEY, normalized);
    return normalized;
  }

  async save(data: DevPadData): Promise<void> {
    const normalized: DevPadData = {
      version: STORAGE_VERSION,
      notes: data.notes.map((note) => this.normalizeNote(note)),
    };
    await this.workspaceState.update(STORAGE_KEY, normalized);
  }

  createNote(partial?: Partial<NoteRecord>): NoteRecord {
    const now = new Date().toISOString();
    const content = partial?.content ?? "";
    return this.normalizeNote({
      id: partial?.id ?? createId(),
      title: partial?.title ?? "Untitled note",
      content,
      tags: normalizeTags(partial?.tags ?? []),
      createdAt: partial?.createdAt ?? now,
      updatedAt: partial?.updatedAt ?? now,
      statusSummary: summarizeChecklist(content),
      sourceContext: partial?.sourceContext ? normalizeSourceContext(partial.sourceContext) : undefined,
    });
  }

  upsertNote(data: DevPadData, nextNote: NoteRecord): DevPadData {
    const notes = [...data.notes];
    const index = notes.findIndex((note) => note.id === nextNote.id);
    if (index >= 0) {
      notes[index] = this.normalizeNote(nextNote);
    } else {
      notes.unshift(this.normalizeNote(nextNote));
    }

    return {
      version: STORAGE_VERSION,
      notes: sortNotes(notes),
    };
  }

  updateNote(
    data: DevPadData,
    noteId: string,
    update: Pick<NoteRecord, "title" | "content" | "tags">,
  ): DevPadData {
    const notes = data.notes.map((note) => {
      if (note.id !== noteId) {
        return note;
      }

      return this.normalizeNote({
        ...note,
        title: update.title.trim() || "Untitled note",
        content: update.content,
        tags: normalizeTags(update.tags),
        updatedAt: new Date().toISOString(),
      });
    });

    return {
      version: STORAGE_VERSION,
      notes: sortNotes(notes),
    };
  }

  renameNote(data: DevPadData, noteId: string, title: string): DevPadData {
    const note = this.getNote(data, noteId);
    if (!note) {
      return data;
    }

    return this.updateNote(data, noteId, {
      title,
      content: note.content,
      tags: note.tags,
    });
  }

  updateNoteTags(data: DevPadData, noteId: string, tags: string[]): DevPadData {
    const note = this.getNote(data, noteId);
    if (!note) {
      return data;
    }

    return this.updateNote(data, noteId, {
      title: note.title,
      content: note.content,
      tags,
    });
  }

  deleteNote(data: DevPadData, noteId: string): DevPadData {
    return {
      version: STORAGE_VERSION,
      notes: data.notes.filter((note) => note.id !== noteId),
    };
  }

  createSnippetNote(capture: SelectionCapture): NoteRecord {
    const sourceContext: SourceContext = {
      path: capture.path,
      startLine: capture.startLine,
      endLine: capture.endLine,
    };

    return this.createNote({
      title: `Snippet from ${capture.path.split("/").pop() ?? capture.path}`,
      content: ["```", capture.text, "```"].join("\n"),
      tags: ["snippet"],
      sourceContext,
    });
  }

  getNote(data: DevPadData, noteId: string): NoteRecord | undefined {
    return data.notes.find((note) => note.id === noteId);
  }

  private createEmpty(): DevPadData {
    return {
      version: STORAGE_VERSION,
      notes: [],
    };
  }

  private normalizeNote(note: NoteRecord): NoteRecord {
    const content = note.content ?? "";
    return {
      id: note.id,
      title: note.title?.trim() || "Untitled note",
      content,
      tags: normalizeTags(note.tags ?? []),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt ?? new Date().toISOString(),
      statusSummary: summarizeChecklist(content),
      sourceContext: note.sourceContext ? normalizeSourceContext(note.sourceContext) : undefined,
    };
  }
}

function sortNotes(notes: NoteRecord[]): NoteRecord[] {
  return [...notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))];
}

function normalizeSourceContext(sourceContext: SourceContext): SourceContext {
  return {
    path: sourceContext.path,
    startLine: sourceContext.startLine,
    endLine: sourceContext.endLine,
  };
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
