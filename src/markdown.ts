import { TaskSummary } from "./types";

const CHECKBOX_PATTERN = /^(\s*[-*]\s+\[)( |x|X)(\]\s.*)$/;

export interface ToggleResult {
  content: string;
  summary: TaskSummary;
}

export function summarizeChecklist(content: string): TaskSummary {
  let total = 0;
  let completed = 0;

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(CHECKBOX_PATTERN);
    if (!match) {
      continue;
    }

    total += 1;
    if (match[2].toLowerCase() === "x") {
      completed += 1;
    }
  }

  return {
    total,
    completed,
    active: total - completed,
  };
}

export function toggleChecklistItem(content: string, index: number): ToggleResult {
  const lines = content.split(/\r?\n/);
  let currentIndex = -1;

  const updated = lines.map((line) => {
    const match = line.match(CHECKBOX_PATTERN);
    if (!match) {
      return line;
    }

    currentIndex += 1;
    if (currentIndex !== index) {
      return line;
    }

    const nextValue = match[2].toLowerCase() === "x" ? " " : "x";
    return `${match[1]}${nextValue}${match[3]}`;
  });

  const nextContent = updated.join("\n");
  return {
    content: nextContent,
    summary: summarizeChecklist(nextContent),
  };
}
