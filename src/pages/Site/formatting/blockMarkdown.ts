import type { EditorState, Line, TransactionSpec } from "@codemirror/state";
import { blockInsertion } from "./blockInsertion.ts";
import { isFormattingBlocked, selectedLines } from "./markdownContext.ts";

export type PickedImage = { assetPath: string; alt: string };

const TABLE_HEADING_PREFIX = "Column";

function escapeImageAlt(alt: string): string {
  return alt
    .replaceAll(/\s*[\r\n]+\s*/g, " ")
    .trim()
    .replaceAll(/([\\[\]])/g, String.raw`\$1`);
}

function imageDestination(path: string): string {
  return /[\s()<>]/.test(path)
    ? `<${path.replaceAll("<", "%3C").replaceAll(">", "%3E")}>`
    : path;
}

export function imageSource(image: PickedImage): string {
  return `![${escapeImageAlt(image.alt)}](${imageDestination(image.assetPath)})`;
}

export function insertImage(
  state: EditorState,
  image: PickedImage,
): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  const source = imageSource(image);
  return blockInsertion(state, [source], { line: 0, from: source.length });
}

export function insertDivider(state: EditorState): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  return blockInsertion(state, ["---"], { line: 0, from: 3 });
}

function tableRow(cells: string[], widths: number[]): string {
  return `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
}

function tableLines(columns: number, rows: number): string[] {
  const headings = Array.from(
    { length: columns },
    (_, index) => `${TABLE_HEADING_PREFIX} ${index + 1}`,
  );
  const widths = headings.map((heading) => Math.max(3, heading.length));
  return [
    tableRow(headings, widths),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...Array.from({ length: rows }, () =>
      tableRow(
        headings.map(() => ""),
        widths,
      ),
    ),
  ];
}

export function insertTable(
  state: EditorState,
  columns: number,
  rows: number,
): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  return blockInsertion(state, tableLines(columns, rows), {
    line: 0,
    from: 2,
    to: 2 + `${TABLE_HEADING_PREFIX} 1`.length,
  });
}

function codeFenceFor(lines: string[]): string {
  const longestRun = Math.max(
    0,
    ...lines.flatMap((line) =>
      [...line.matchAll(/`{3,}/g)].map((match) => match[0].length),
    ),
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

function codeLanguageSource(language: string): string {
  return language.trim().replaceAll(/[^\w#+.-]/g, "");
}

function wrapLinesInCode(
  state: EditorState,
  lines: Line[],
  language: string,
): TransactionSpec {
  const separator = state.lineBreak;
  const doc = state.doc;
  const first = lines[0];
  const last = lines.at(-1) ?? first;
  const texts = lines.map((line) => line.text);
  const fence = codeFenceFor(texts);
  const before =
    first.number > 1 && doc.line(first.number - 1).text !== "" ? separator : "";
  const after =
    last.number < doc.lines && doc.line(last.number + 1).text !== ""
      ? separator
      : "";
  const insert = [
    `${before}${fence}${language}`,
    ...texts,
    `${fence}${after}`,
  ].join(separator);
  const contentStart =
    first.from +
    before.length +
    fence.length +
    language.length +
    separator.length;
  return {
    changes: { from: first.from, to: last.to, insert },
    selection: {
      anchor: contentStart,
      head: contentStart + texts.join(separator).length,
    },
    userEvent: "input",
    scrollIntoView: true,
  };
}

export function insertCodeBlock(
  state: EditorState,
  language: string,
): TransactionSpec | null {
  if (isFormattingBlocked(state)) {
    return null;
  }
  const languageSource = codeLanguageSource(language);
  const range = state.selection.main;
  const lines = selectedLines(state, range);
  if (!range.empty && lines.some((line) => line.text.trim() !== "")) {
    return wrapLinesInCode(state, lines, languageSource);
  }
  return blockInsertion(state, [`\`\`\`${languageSource}`, "", "```"], {
    line: 1,
    from: 0,
  });
}
