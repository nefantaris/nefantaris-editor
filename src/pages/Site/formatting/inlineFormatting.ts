import { syntaxTree } from "@codemirror/language";
import type {
  ChangeSpec,
  EditorState,
  SelectionRange,
  TransactionSpec,
} from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  isFormattingBlocked,
  parseLinePrefix,
  selectedLines,
} from "./markdownContext.ts";

export type InlineStyle = "bold" | "italic" | "strikethrough" | "code";

type InlineStyleSpec = { node: string; mark: string; delimiter: string };

const inlineStyleSpecs: Record<InlineStyle, InlineStyleSpec> = {
  bold: { node: "StrongEmphasis", mark: "EmphasisMark", delimiter: "**" },
  italic: { node: "Emphasis", mark: "EmphasisMark", delimiter: "*" },
  strikethrough: {
    node: "Strikethrough",
    mark: "StrikethroughMark",
    delimiter: "~~",
  },
  code: { node: "InlineCode", mark: "CodeMark", delimiter: "`" },
};

type Segment = { from: number; to: number };

function ancestorsAt(state: EditorState, pos: number, side: -1 | 1) {
  const nodes: SyntaxNode[] = [];
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
    node;
    node = node.parent
  ) {
    nodes.push(node);
  }
  return nodes;
}

function enclosingStyleNode(
  state: EditorState,
  range: Segment,
  spec: InlineStyleSpec,
): SyntaxNode | null {
  const isEmpty = range.from === range.to;
  const candidates = [
    ...ancestorsAt(state, range.from, 1),
    ...ancestorsAt(state, range.to, -1),
  ];
  return (
    candidates.find(
      (node) =>
        node.name === spec.node &&
        (isEmpty
          ? node.from < range.from && range.to < node.to
          : node.from <= range.from && range.to <= node.to),
    ) ?? null
  );
}

function unwrapChanges(node: SyntaxNode, spec: InlineStyleSpec): ChangeSpec[] {
  const marks = node.getChildren(spec.mark);
  const open = marks[0];
  const close = marks.at(-1);
  if (open === undefined || close === undefined || open === close) {
    return [];
  }
  return [
    { from: open.from, to: open.to },
    { from: close.from, to: close.to },
  ];
}

function nestedStyleChanges(
  state: EditorState,
  segment: Segment,
  spec: InlineStyleSpec,
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  syntaxTree(state).iterate({
    from: segment.from,
    to: segment.to,
    enter: (node) => {
      if (
        node.name === spec.node &&
        node.from >= segment.from &&
        node.to <= segment.to
      ) {
        changes.push(...unwrapChanges(node.node, spec));
        return false;
      }
      return;
    },
  });
  return changes;
}

function trimmedSegment(state: EditorState, segment: Segment): Segment | null {
  const text = state.sliceDoc(segment.from, segment.to);
  const leading = text.length - text.trimStart().length;
  const trailing = text.length - text.trimEnd().length;
  const from = segment.from + leading;
  const to = segment.to - trailing;
  return from < to ? { from, to } : null;
}

function wrapSegments(state: EditorState, range: SelectionRange): Segment[] {
  const lines = selectedLines(state, range);
  return lines.flatMap((line, index) => {
    const contentFrom = line.from + parseLinePrefix(line.text).contentFrom;
    const from = index === 0 ? Math.max(range.from, contentFrom) : contentFrom;
    const to =
      index === lines.length - 1 ? Math.min(range.to, line.to) : line.to;
    const segment = from < to ? trimmedSegment(state, { from, to }) : null;
    return segment === null ? [] : [segment];
  });
}

function codeDelimiterFor(text: string): { open: string; close: string } {
  const longestRun = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = "`".repeat(longestRun + 1);
  const padding = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return { open: `${fence}${padding}`, close: `${padding}${fence}` };
}

function delimitersFor(
  style: InlineStyle,
  state: EditorState,
  segment: Segment,
): { open: string; close: string } {
  if (style === "code") {
    return codeDelimiterFor(state.sliceDoc(segment.from, segment.to));
  }
  const delimiter = inlineStyleSpecs[style].delimiter;
  return { open: delimiter, close: delimiter };
}

function wordAround(state: EditorState, pos: number): Segment | null {
  const word = state.wordAt(pos);
  return word === null ? null : { from: word.from, to: word.to };
}

export function isInlineStyleActive(
  state: EditorState,
  style: InlineStyle,
): boolean {
  const range = state.selection.main;
  return enclosingStyleNode(state, range, inlineStyleSpecs[style]) !== null;
}

export function toggleInlineStyle(
  state: EditorState,
  style: InlineStyle,
): TransactionSpec | null {
  const range = state.selection.main;
  if (isFormattingBlocked(state, range)) {
    return null;
  }
  const spec = inlineStyleSpecs[style];
  const enclosing = enclosingStyleNode(state, range, spec);
  if (enclosing !== null) {
    return {
      changes: unwrapChanges(enclosing, spec),
      userEvent: "input",
    };
  }
  if (range.empty) {
    const word = wordAround(state, range.head);
    if (word === null) {
      const { open, close } = delimitersFor(style, state, {
        from: range.head,
        to: range.head,
      });
      return {
        changes: { from: range.head, insert: `${open}${close}` },
        selection: { anchor: range.head + open.length },
        userEvent: "input",
      };
    }
    const { open, close } = delimitersFor(style, state, word);
    const changes = state.changes([
      ...nestedStyleChanges(state, word, spec),
      { from: word.from, insert: open },
      { from: word.to, insert: close },
    ]);
    const cursor = changes.mapPos(range.head, range.head === word.to ? -1 : 1);
    return {
      changes,
      selection: { anchor: cursor },
      userEvent: "input",
    };
  }
  const segments = wrapSegments(state, range);
  if (segments.length === 0) {
    return null;
  }
  const changes = state.changes(
    segments.flatMap((segment) => {
      const { open, close } = delimitersFor(style, state, segment);
      return [
        ...nestedStyleChanges(state, segment, spec),
        { from: segment.from, insert: open },
        { from: segment.to, insert: close },
      ];
    }),
  );
  return {
    changes,
    selection: EditorSelection.single(
      changes.mapPos(range.anchor, range.anchor <= range.head ? 1 : -1),
      changes.mapPos(range.head, range.head < range.anchor ? 1 : -1),
    ),
    userEvent: "input",
  };
}
