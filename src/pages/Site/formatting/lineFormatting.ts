import type {
  ChangeSpec,
  EditorState,
  Line,
  TransactionSpec,
} from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";
import type { LineListKind } from "./markdownContext.ts";
import {
  isFormattingBlocked,
  parseLinePrefix,
  selectedLines,
} from "./markdownContext.ts";

export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ListOrQuote = LineListKind | "quote";

function isBlank(line: Line): boolean {
  return line.text.trim() === "";
}

function targetLines(state: EditorState): Line[] {
  const lines = selectedLines(state, state.selection.main);
  const filled = lines.filter((line) => !isBlank(line));
  return filled.length === 0 ? lines.slice(0, 1) : filled;
}

function lineEdit(
  state: EditorState,
  changes: ChangeSpec[],
): TransactionSpec | null {
  if (changes.length === 0) {
    return null;
  }
  const changeSet = state.changes(changes);
  return {
    changes: changeSet,
    selection: EditorSelection.create(
      state.selection.ranges.map((range) =>
        EditorSelection.range(
          changeSet.mapPos(range.anchor, 1),
          changeSet.mapPos(range.head, 1),
        ),
      ),
      state.selection.mainIndex,
    ),
    userEvent: "input",
  };
}

export function headingLevelOf(state: EditorState): HeadingLevel | null {
  const levels = new Set(
    targetLines(state).map(
      (line) => parseLinePrefix(line.text).heading?.level ?? 0,
    ),
  );
  const [only] = levels;
  return levels.size === 1 && only !== undefined && isHeadingLevel(only)
    ? only
    : null;
}

function isHeadingLevel(value: number): value is HeadingLevel {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export function setHeadingLevel(
  state: EditorState,
  level: HeadingLevel,
): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  const marks = level === 0 ? "" : `${"#".repeat(level)} `;
  const changes = targetLines(state).flatMap((line): ChangeSpec[] => {
    const prefix = parseLinePrefix(line.text);
    if (prefix.heading === null) {
      return marks === ""
        ? []
        : [{ from: line.from + prefix.contentFrom, insert: marks }];
    }
    const current = line.text.slice(prefix.heading.from, prefix.heading.to);
    return current === marks
      ? []
      : [
          {
            from: line.from + prefix.heading.from,
            to: line.from + prefix.heading.to,
            insert: marks,
          },
        ];
  });
  return lineEdit(state, changes);
}

function hasLineFormat(line: Line, format: ListOrQuote): boolean {
  const prefix = parseLinePrefix(line.text);
  return format === "quote"
    ? prefix.quoteTo > prefix.quoteFrom
    : prefix.list?.kind === format;
}

export function isLineFormatActive(
  state: EditorState,
  format: ListOrQuote,
): boolean {
  const lines = targetLines(state);
  return lines.every((line) => hasLineFormat(line, format));
}

function quoteChanges(state: EditorState, isActive: boolean): ChangeSpec[] {
  const lines = selectedLines(state, state.selection.main);
  if (isActive) {
    return lines.flatMap((line): ChangeSpec[] => {
      const prefix = parseLinePrefix(line.text);
      if (prefix.quoteTo === prefix.quoteFrom) {
        return [];
      }
      const markerTo = prefix.quoteFrom + 1;
      const spaceTo = line.text[markerTo] === " " ? markerTo + 1 : markerTo;
      return [{ from: line.from + prefix.quoteFrom, to: line.from + spaceTo }];
    });
  }
  return lines.map((line) => ({
    from: line.from,
    insert: isBlank(line) && lines.length > 1 ? ">" : "> ",
  }));
}

function listMarker(kind: LineListKind, index: number): string {
  if (kind === "numbered") {
    return `${index + 1}. `;
  }
  return kind === "task" ? "- [ ] " : "- ";
}

function listChanges(
  state: EditorState,
  kind: LineListKind,
  isActive: boolean,
): ChangeSpec[] {
  return targetLines(state).map((line, index) => {
    const prefix = parseLinePrefix(line.text);
    const from = line.from + prefix.listFrom;
    const to = prefix.list === null ? from : line.from + prefix.list.to;
    return { from, to, insert: isActive ? "" : listMarker(kind, index) };
  });
}

export function toggleLineFormat(
  state: EditorState,
  format: ListOrQuote,
): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  const isActive = isLineFormatActive(state, format);
  return lineEdit(
    state,
    format === "quote"
      ? quoteChanges(state, isActive)
      : listChanges(state, format, isActive),
  );
}
