import type { EditorView } from "@codemirror/view";

export function insertDirectiveBlock(view: EditorView, name: string): void {
  const state = view.state;
  const separator = state.lineBreak;
  const doc = state.doc;
  const line = doc.lineAt(state.selection.main.head);
  const isLineEmpty = line.text === "";
  const insertAt = isLineEmpty ? line.from : line.to;
  const needsBlankBefore = isLineEmpty
    ? line.number > 1 && doc.line(line.number - 1).text !== ""
    : true;
  const needsBlankAfter =
    line.number < doc.lines && doc.line(line.number + 1).text !== "";
  const prefix = isLineEmpty
    ? needsBlankBefore
      ? separator
      : ""
    : separator + separator;
  const suffix = needsBlankAfter ? separator : "";
  const openFence = `:::${name}`;
  const insertText = `${prefix}${openFence}${separator}${separator}:::${suffix}`;
  const cursor = insertAt + prefix.length + openFence.length + separator.length;
  view.dispatch({
    changes: { from: insertAt, insert: insertText },
    selection: { anchor: cursor },
    userEvent: "input",
    scrollIntoView: true,
  });
}
