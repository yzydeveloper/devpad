export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "devpad.workspace.data";

export type TaskFilter = "all" | "active" | "completed";

export interface SourceContext {
  path: string;
  startLine: number;
  endLine: number;
}

export interface TaskSummary {
  total: number;
  completed: number;
  active: number;
}

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  statusSummary: TaskSummary;
  sourceContext?: SourceContext;
}

export interface DevPadData {
  version: number;
  notes: NoteRecord[];
}

export interface SelectionCapture {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface QueryState {
  searchText: string;
  selectedTag: string;
  taskFilter: TaskFilter;
}

export interface WebviewStatePayload {
  data: DevPadData;
  query: QueryState;
  selectedNoteId: string | null;
}
