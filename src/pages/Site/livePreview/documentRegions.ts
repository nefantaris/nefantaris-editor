import type { EditorState, Line, Text } from "@codemirror/state";
import { StateField } from "@codemirror/state";
import { closingFenceOf, parseDirectiveLine } from "../blockSyntax.ts";

export type FrontmatterRegion = { from: number; to: number };

export type DirectiveFence = {
  lineFrom: number;
  lineTo: number;
  colonsFrom: number;
  colonsTo: number;
};

export type DirectiveRegion = {
  kind: "container" | "leaf";
  name: string;
  from: number;
  to: number;
  fenceLength: number;
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

type OpenContainer = {
  name: string;
  fenceLength: number;
  open: DirectiveFence;
};

type CodeFence = { char: string; length: number };

function fenceOn(line: Line, colonsAt: number, length: number): DirectiveFence {
  return {
    lineFrom: line.from,
    lineTo: line.to,
    colonsFrom: line.from + colonsAt,
    colonsTo: line.from + colonsAt + length,
  };
}

function closesCodeFence(text: string, codeFence: CodeFence): boolean {
  const close = codeFenceClosePattern.exec(text);
  return (
    close !== null &&
    close[1].startsWith(codeFence.char) &&
    close[1].length >= codeFence.length
  );
}

class DirectiveScanner {
  readonly regions: DirectiveRegion[] = [];
  private readonly stack: OpenContainer[] = [];
  private codeFence: CodeFence | null = null;

  scan(line: Line): void {
    if (this.closeContainers(line)) {
      return;
    }
    if (this.codeFence) {
      if (closesCodeFence(line.text, this.codeFence)) {
        this.codeFence = null;
      }
      return;
    }
    const codeOpen = codeFenceOpenPattern.exec(line.text);
    if (codeOpen) {
      this.codeFence = {
        char: codeOpen[1].slice(0, 1),
        length: codeOpen[1].length,
      };
      return;
    }
    const directive = parseDirectiveLine(line.text);
    if (directive === null) {
      return;
    }
    const open = fenceOn(line, directive.fenceFrom, directive.fenceLength);
    if (directive.kind === "container") {
      this.stack.push({
        name: directive.name,
        fenceLength: directive.fenceLength,
        open,
      });
      return;
    }
    this.regions.push({
      kind: "leaf",
      name: directive.name,
      from: line.from,
      to: line.to,
      fenceLength: directive.fenceLength,
      open,
      close: null,
    });
  }

  finish(docLength: number): DirectiveRegion[] {
    this.closeFrom(0, null, docLength);
    return this.regions.toSorted((a, b) => a.from - b.from);
  }

  private closeContainers(line: Line): boolean {
    const closing = this.stack.length > 0 ? closingFenceOf(line.text) : null;
    if (closing === null) {
      return false;
    }
    const index = this.stack.findIndex(
      (container) => closing.length >= container.fenceLength,
    );
    if (index === -1) {
      return false;
    }
    this.closeFrom(
      index,
      fenceOn(line, closing.from, closing.length),
      line.from - 1,
    );
    this.codeFence = null;
    return true;
  }

  private closeFrom(
    index: number,
    close: DirectiveFence | null,
    innerEnd: number,
  ): void {
    for (const [offset, container] of this.stack.splice(index).entries()) {
      const ownClose = offset === 0 ? close : null;
      this.regions.push({
        kind: "container",
        name: container.name,
        from: container.open.lineFrom,
        to: ownClose?.lineTo ?? Math.max(innerEnd, container.open.lineTo),
        fenceLength: container.fenceLength,
        open: container.open,
        close: ownClose,
      });
    }
  }
}

export function computeDirectiveRegions(doc: Text): DirectiveRegion[] {
  const scanner = new DirectiveScanner();
  const frontmatter = computeFrontmatter(doc);
  const firstLine = frontmatter ? doc.lineAt(frontmatter.to).number + 1 : 1;
  for (let lineNumber = firstLine; lineNumber <= doc.lines; lineNumber++) {
    scanner.scan(doc.line(lineNumber));
  }
  return scanner.finish(doc.length);
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
