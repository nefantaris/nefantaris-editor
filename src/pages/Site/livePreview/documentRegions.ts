import type { EditorState, Text } from "@codemirror/state";
import { StateField } from "@codemirror/state";

export type FrontmatterRegion = { from: number; to: number };

export type DirectiveFence = { lineFrom: number; lineTo: number };

export type DirectiveRegion = {
  kind: "container" | "leaf";
  name: string;
  from: number;
  to: number;
  open: DirectiveFence;
  close: DirectiveFence | null;
};

export function computeFrontmatter(doc: Text): FrontmatterRegion | null {
  if (doc.lines < 2 || doc.line(1).text !== "---") {
    return null;
  }
  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber);
    if (line.text === "---") {
      return { from: 0, to: line.to };
    }
  }
  return null;
}

const codeFenceOpenPattern = /^\s{0,3}(`{3,}|~{3,})/;
const codeFenceClosePattern = /^\s{0,3}(`{3,}|~{3,})\s*$/;
const containerOpenPattern = /^:{3,}([A-Za-z][A-Za-z0-9_-]*)/;
const containerClosePattern = /^:{3,}\s*$/;
const leafPattern = /^::([A-Za-z][A-Za-z0-9_-]*)/;

type OpenContainer = { name: string; lineFrom: number; lineTo: number };

function computeDirectiveRegions(doc: Text): DirectiveRegion[] {
  const regions: DirectiveRegion[] = [];
  const stack: OpenContainer[] = [];
  const frontmatter = computeFrontmatter(doc);
  let codeFence: { char: string; length: number } | null = null;
  const firstLine = frontmatter ? doc.lineAt(frontmatter.to).number + 1 : 1;
  for (let lineNumber = firstLine; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber);
    if (codeFence) {
      const close = codeFenceClosePattern.exec(line.text);
      if (
        close &&
        close[1].startsWith(codeFence.char) &&
        close[1].length >= codeFence.length
      ) {
        codeFence = null;
      }
      continue;
    }
    const open = codeFenceOpenPattern.exec(line.text);
    if (open) {
      codeFence = { char: open[1].slice(0, 1), length: open[1].length };
      continue;
    }
    const containerOpen = containerOpenPattern.exec(line.text);
    if (containerOpen) {
      stack.push({
        name: containerOpen[1],
        lineFrom: line.from,
        lineTo: line.to,
      });
      continue;
    }
    if (containerClosePattern.test(line.text)) {
      const opened = stack.pop();
      if (opened) {
        regions.push({
          kind: "container",
          name: opened.name,
          from: opened.lineFrom,
          to: line.to,
          open: { lineFrom: opened.lineFrom, lineTo: opened.lineTo },
          close: { lineFrom: line.from, lineTo: line.to },
        });
      }
      continue;
    }
    const leaf = leafPattern.exec(line.text);
    if (leaf) {
      regions.push({
        kind: "leaf",
        name: leaf[1],
        from: line.from,
        to: line.to,
        open: { lineFrom: line.from, lineTo: line.to },
        close: null,
      });
    }
  }
  return regions.toSorted((a, b) => a.from - b.from);
}

export const frontmatterField = StateField.define<FrontmatterRegion | null>({
  create: (state: EditorState) => computeFrontmatter(state.doc),
  update: (value, transaction) =>
    transaction.docChanged ? computeFrontmatter(transaction.state.doc) : value,
});

export const directiveRegionsField = StateField.define<DirectiveRegion[]>({
  create: (state: EditorState) => computeDirectiveRegions(state.doc),
  update: (value, transaction) =>
    transaction.docChanged
      ? computeDirectiveRegions(transaction.state.doc)
      : value,
});

export function selectionTouches(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
}
