import { syntaxTree } from "@codemirror/language";
import type { EditorState, Line, SelectionRange } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { computeFrontmatter } from "../livePreview/documentRegions.ts";

export type LineListKind = "bullet" | "numbered" | "task";

type LinePrefix = {
  quoteFrom: number;
  quoteTo: number;
  listFrom: number;
  list: { kind: LineListKind; to: number } | null;
  heading: { level: number; from: number; to: number } | null;
  contentFrom: number;
};

const codeBlockNames = new Set(["FencedCode", "CodeBlock"]);
const listMarkerPattern = /^(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;
const taskBoxPattern = /^\[[ xX]\](?:[ \t]+|$)/;
const headingMarkPattern = /^(#{1,6})(?:[ \t]+|$)/;

function skipSpaces(text: string, from: number): number {
  let index = from;
  while (text[index] === " " || text[index] === "\t") {
    index += 1;
  }
  return index;
}

export function parseLinePrefix(text: string): LinePrefix {
  const quoteFrom = skipSpaces(text, 0);
  let index = quoteFrom;
  while (text[index] === ">") {
    index += 1;
    if (text[index] === " " || text[index] === "\t") {
      index += 1;
    }
  }
  const quoteTo = index;
  const listFrom = skipSpaces(text, quoteTo);
  index = listFrom;
  let list: LinePrefix["list"] = null;
  const listMarker = listMarkerPattern.exec(text.slice(index));
  if (listMarker !== null) {
    index += listMarker[0].length;
    const taskBox = taskBoxPattern.exec(text.slice(index));
    if (taskBox !== null) {
      index += taskBox[0].length;
    }
    list = {
      kind:
        taskBox === null
          ? /^\d/.test(listMarker[0])
            ? "numbered"
            : "bullet"
          : "task",
      to: index,
    };
  }
  let heading: LinePrefix["heading"] = null;
  const headingMark = headingMarkPattern.exec(text.slice(index));
  if (headingMark !== null) {
    heading = {
      level: headingMark[1].length,
      from: index,
      to: index + headingMark[0].length,
    };
    index += headingMark[0].length;
  }
  return { quoteFrom, quoteTo, listFrom, list, heading, contentFrom: index };
}

export function isFrontmatterPosition(
  state: EditorState,
  pos: number,
): boolean {
  const frontmatter = computeFrontmatter(state.doc);
  return frontmatter !== null && pos <= frontmatter.to;
}

export function isCodeLine(state: EditorState, line: Line): boolean {
  const probe = line.from + (line.text.length - line.text.trimStart().length);
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(probe, 1);
    node;
    node = node.parent
  ) {
    if (codeBlockNames.has(node.name)) {
      return true;
    }
  }
  return false;
}

export function selectedLines(
  state: EditorState,
  range: SelectionRange,
): Line[] {
  const first = state.doc.lineAt(range.from);
  let last = state.doc.lineAt(range.to);
  if (!range.empty && last.number > first.number && range.to === last.from) {
    last = state.doc.line(last.number - 1);
  }
  const lines: Line[] = [];
  for (let number = first.number; number <= last.number; number++) {
    lines.push(state.doc.line(number));
  }
  return lines;
}

export function isFormattingBlocked(
  state: EditorState,
  range: SelectionRange = state.selection.main,
): boolean {
  if (isFrontmatterPosition(state, range.from)) {
    return true;
  }
  return selectedLines(state, range).some((line) => isCodeLine(state, line));
}
