import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { Diagnostic } from "@codemirror/lint";
import { linter } from "@codemirror/lint";
import type { EditorState, Extension } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { CodeLanguage } from "./codeLanguages.ts";

export type LineNote = {
  line: number | null;
  message: string;
};

type PlacedNote = {
  from: number;
  message: string;
};

const LINT_DELAY_MS = 400;
const FULL_PARSE_BUDGET_MS = 200;

const unfinishedCommentPattern = /\/\*[\s\S]*?(?:\*\/|$)/g;

const CSS_SYNTAX_MESSAGE =
  "Something here isn't valid CSS. Check for a missing bracket, colon, or semicolon.";

export const setLineNotes = StateEffect.define<LineNote[]>();

function placedNotesFor(state: EditorState, notes: LineNote[]): PlacedNote[] {
  return notes.map((note) => {
    const lineNumber = Math.min(Math.max(note.line ?? 1, 1), state.doc.lines);
    return { from: state.doc.line(lineNumber).from, message: note.message };
  });
}

const lineNotesField = StateField.define<PlacedNote[]>({
  create: () => [],
  update: (notes, transaction) => {
    let next = transaction.docChanged
      ? notes.map((note) => ({
          ...note,
          from: transaction.changes.mapPos(note.from),
        }))
      : notes;
    for (const effect of transaction.effects) {
      if (effect.is(setLineNotes)) {
        next = placedNotesFor(transaction.state, effect.value);
      }
    }
    return next;
  },
});

function fullSyntaxTree(state: EditorState) {
  return (
    ensureSyntaxTree(state, state.doc.length, FULL_PARSE_BUDGET_MS) ??
    syntaxTree(state)
  );
}

function lineEndingBefore(state: EditorState, position: number): number {
  const before = state.sliceDoc(0, position);
  const lastWritten = before.trimEnd().length;
  return state.doc.lineAt(Math.max(lastWritten - 1, 0)).number;
}

function unclosedCommentStart(text: string): number | null {
  for (const match of text.matchAll(unfinishedCommentPattern)) {
    if (match[0].length < 4 || !match[0].endsWith("*/")) {
      return match.index;
    }
  }
  return null;
}

export function unfinishedCssLine(state: EditorState): number | null {
  let line: number | null = null;
  fullSyntaxTree(state).iterate({
    enter: (node) => {
      if (line === null && node.type.isError) {
        line =
          node.from === node.to
            ? lineEndingBefore(state, node.from)
            : state.doc.lineAt(node.from).number;
      }
      return line === null;
    },
  });
  if (line !== null) {
    return line;
  }
  const commentStart = unclosedCommentStart(state.sliceDoc());
  return commentStart === null ? null : state.doc.lineAt(commentStart).number;
}

function cssSyntaxDiagnostics(state: EditorState): Diagnostic[] {
  const tree = fullSyntaxTree(state);
  const flaggedLines = new Set<number>();
  const diagnostics: Diagnostic[] = [];
  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) {
        return;
      }
      const line = state.doc.lineAt(node.from);
      if (flaggedLines.has(line.number)) {
        return;
      }
      flaggedLines.add(line.number);
      const from =
        node.from === node.to && node.from > line.from
          ? node.from - 1
          : node.from;
      diagnostics.push({
        from,
        to: Math.min(Math.max(node.to, from + 1), state.doc.length),
        severity: "error",
        message: CSS_SYNTAX_MESSAGE,
      });
    },
  });
  return diagnostics;
}

function noteDiagnostics(state: EditorState): Diagnostic[] {
  return state.field(lineNotesField).map((note) => {
    const line = state.doc.lineAt(Math.min(note.from, state.doc.length));
    return {
      from: line.from,
      to: line.to,
      severity: "warning",
      message: note.message,
    };
  });
}

export function codeLint(language: CodeLanguage): Extension {
  const checksSyntax = language === "css";
  return [
    lineNotesField,
    linter(
      (view) => [
        ...(checksSyntax ? cssSyntaxDiagnostics(view.state) : []),
        ...noteDiagnostics(view.state),
      ],
      {
        delay: LINT_DELAY_MS,
        needsRefresh: (update) =>
          update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(setLineNotes)),
          ),
      },
    ),
  ];
}
