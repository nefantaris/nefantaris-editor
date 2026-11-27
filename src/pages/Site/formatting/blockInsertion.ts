import type {
  ChangeSpec,
  EditorState,
  TransactionSpec,
} from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";

type BlockCursor = { line: number; from: number; to?: number };

type BlockPlacement = { insertAt: number; prefix: string; suffix: string };

function blockPlacement(state: EditorState): BlockPlacement {
  const separator = state.lineBreak;
  const doc = state.doc;
  const line = doc.lineAt(state.selection.main.head);
  const isLineEmpty = line.text === "";
  const needsBlankBefore = isLineEmpty
    ? line.number > 1 && doc.line(line.number - 1).text !== ""
    : true;
  const needsBlankAfter =
    line.number < doc.lines && doc.line(line.number + 1).text !== "";
  const prefixWhenEmpty = needsBlankBefore ? separator : "";
  return {
    insertAt: isLineEmpty ? line.from : line.to,
    prefix: isLineEmpty ? prefixWhenEmpty : separator + separator,
    suffix: needsBlankAfter ? separator : "",
  };
}

function offsetInLines(
  lines: string[],
  separator: string,
  line: number,
  column: number,
): number {
  return (
    lines
      .slice(0, line)
      .reduce((total, text) => total + text.length + separator.length, 0) +
    column
  );
}

export function blockInsertion(
  state: EditorState,
  lines: string[],
  cursor: BlockCursor,
  changesAround: (insertAt: number) => ChangeSpec[] = () => [],
): TransactionSpec {
  const separator = state.lineBreak;
  const { insertAt, prefix, suffix } = blockPlacement(state);
  const changes = state.changes([
    { from: insertAt, insert: `${prefix}${lines.join(separator)}${suffix}` },
    ...changesAround(insertAt),
  ]);
  const start = changes.mapPos(insertAt, -1) + prefix.length;
  const anchor =
    start + offsetInLines(lines, separator, cursor.line, cursor.from);
  const head =
    start +
    offsetInLines(lines, separator, cursor.line, cursor.to ?? cursor.from);
  return {
    changes,
    selection: EditorSelection.single(anchor, head),
    userEvent: "input",
    scrollIntoView: true,
  };
}
