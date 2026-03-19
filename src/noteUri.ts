import * as vscode from "vscode";

export const DEVPAD_NOTE_SCHEME = "devpad-note";
export const DEVPAD_NOTE_VIEW_TYPE = "devpad.noteEditor";

export function createNoteUri(noteId: string, title: string): vscode.Uri {
  const slug = slugify(title || noteId);
  return vscode.Uri.parse(
    `${DEVPAD_NOTE_SCHEME}:/${slug || "note"}.devpad-note?noteId=${encodeURIComponent(noteId)}`,
  );
}

export function getNoteIdFromUri(uri: vscode.Uri): string {
  const params = new URLSearchParams(uri.query);
  const noteId = params.get("noteId");
  if (!noteId) {
    throw new Error(`Missing DevPad note id for URI: ${uri.toString()}`);
  }

  return noteId;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
