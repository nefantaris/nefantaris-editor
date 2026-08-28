import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState, Extension, Range } from "@codemirror/state";
import { StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";
import type { SyntaxNode, Tree } from "@lezer/common";
import { siteAssetUrl } from "./assetUrl.ts";
import { computeFrontmatter, selectionTouches } from "./documentRegions.ts";
import {
  ImagePreviewWidget,
  TableWidget,
  type TableColumnAlign,
  type TableWidgetModel,
} from "./widgets.ts";

const tableSourceLineDeco = Decoration.line({ class: "nef-table-source" });

const PARSE_BUDGET_MS = 50;

function parseAligns(delimiterText: string): TableColumnAlign[] {
  return delimiterText
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const alignsLeft = part.startsWith(":");
      const alignsRight = part.endsWith(":");
      if (alignsLeft && alignsRight) {
        return "center";
      }
      if (alignsRight) {
        return "right";
      }
      if (alignsLeft) {
        return "left";
      }
      return null;
    });
}

function rowCellTexts(state: EditorState, row: SyntaxNode): string[] {
  return row
    .getChildren("TableCell")
    .map((cell) => state.sliceDoc(cell.from, cell.to).trim());
}

function buildTableModel(
  state: EditorState,
  table: SyntaxNode,
): TableWidgetModel {
  const headerNode = table.getChild("TableHeader");
  const delimiterNode = table.getChild("TableDelimiter");
  return {
    header: headerNode ? rowCellTexts(state, headerNode) : [],
    aligns: delimiterNode
      ? parseAligns(state.sliceDoc(delimiterNode.from, delimiterNode.to))
      : [],
    rows: table.getChildren("TableRow").map((row) => rowCellTexts(state, row)),
  };
}

function handleTable(
  state: EditorState,
  table: SyntaxNode,
  ranges: Range<Decoration>[],
): void {
  const firstLine = state.doc.lineAt(table.from);
  const lastLine = state.doc.lineAt(table.to);
  if (selectionTouches(state, firstLine.from, lastLine.to)) {
    for (let n = firstLine.number; n <= lastLine.number; n++) {
      ranges.push(tableSourceLineDeco.range(state.doc.line(n).from));
    }
    return;
  }
  const source = state.sliceDoc(firstLine.from, lastLine.to);
  ranges.push(
    Decoration.replace({
      widget: new TableWidget(source, buildTableModel(state, table)),
      block: true,
    }).range(firstLine.from, lastLine.to),
  );
}

function resolveImageSource(
  sitePath: string,
  rawSource: string,
): string | null {
  if (rawSource.startsWith("/assets/")) {
    return siteAssetUrl(sitePath, rawSource);
  }
  if (/^https?:\/\//.test(rawSource)) {
    return rawSource;
  }
  return null;
}

function handleImage(
  state: EditorState,
  sitePath: string,
  image: SyntaxNode,
  ranges: Range<Decoration>[],
): void {
  const url = image.getChild("URL");
  if (!url) {
    return;
  }
  const marks = image.getChildren("LinkMark");
  const altText =
    marks.length >= 2 ? state.sliceDoc(marks[0].to, marks[1].from) : "";
  const resolved = resolveImageSource(
    sitePath,
    state.sliceDoc(url.from, url.to),
  );
  const line = state.doc.lineAt(image.to);
  ranges.push(
    Decoration.widget({
      widget: new ImagePreviewWidget(resolved, altText.trim()),
      block: true,
      side: 1,
    }).range(line.to),
  );
}

function buildBlockDecorations(
  state: EditorState,
  sitePath: string,
): DecorationSet {
  const tree: Tree =
    ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS) ??
    syntaxTree(state);
  const frontmatter = computeFrontmatter(state.doc);
  const ranges: Range<Decoration>[] = [];
  tree.iterate({
    enter: (node) => {
      if (
        frontmatter &&
        node.name !== "Document" &&
        node.to <= frontmatter.to
      ) {
        return false;
      }
      if (node.name === "Table") {
        handleTable(state, node.node, ranges);
        return false;
      }
      if (node.name === "Image") {
        handleImage(state, sitePath, node.node, ranges);
        return false;
      }
      return true;
    },
  });
  return Decoration.set(ranges, true);
}

export function createBlockPreviewField(sitePath: string): Extension {
  return StateField.define<DecorationSet>({
    create: (state) => buildBlockDecorations(state, sitePath),
    update: (value, transaction) =>
      transaction.docChanged || transaction.selection
        ? buildBlockDecorations(transaction.state, sitePath)
        : value,
    provide: (field) => EditorView.decorations.from(field),
  });
}
