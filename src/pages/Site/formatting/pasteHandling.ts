import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { htmlToMarkdown } from "./htmlToMarkdown.ts";
import { linkAt, linkSource, pastedUrl } from "./linkEditing.ts";
import { isFormattingBlocked } from "./markdownContext.ts";

export type ImageFileHandler = (
  view: EditorView,
  file: File,
  insertPos: number,
) => void;

function firstImageFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) {
    return null;
  }
  for (const item of dataTransfer.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

function withLineBreaks(state: EditorState, text: string): string {
  return text.split(/\r\n?|\n/).join(state.lineBreak);
}

function insertPastedText(view: EditorView, text: string): void {
  const state = view.state;
  view.dispatch(
    state.update(state.replaceSelection(withLineBreaks(state, text)), {
      userEvent: "input.paste",
      scrollIntoView: true,
    }),
  );
}

function linkOverSelection(view: EditorView, url: string): boolean {
  const state = view.state;
  const range = state.selection.main;
  if (
    range.empty ||
    state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number ||
    linkAt(state, range.from, range.to) !== null
  ) {
    return false;
  }
  const source = linkSource(state.sliceDoc(range.from, range.to), url);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: source },
    selection: { anchor: range.from + source.length },
    userEvent: "input.paste",
    scrollIntoView: true,
  });
  return true;
}

function handlePaste(
  event: ClipboardEvent,
  view: EditorView,
  onImageFile: ImageFileHandler,
): boolean {
  const data = event.clipboardData;
  if (!data) {
    return false;
  }
  const file = firstImageFile(data);
  if (file) {
    event.preventDefault();
    onImageFile(view, file, view.state.selection.main.head);
    return true;
  }
  if (isFormattingBlocked(view.state)) {
    return false;
  }
  const url = pastedUrl(data.getData("text/plain"));
  if (url !== null && linkOverSelection(view, url)) {
    event.preventDefault();
    return true;
  }
  const html = data.getData("text/html");
  const markdown = html === "" ? null : htmlToMarkdown(html);
  if (markdown === null) {
    return false;
  }
  event.preventDefault();
  insertPastedText(view, markdown);
  return true;
}

export function pasteHandling(onImageFile: ImageFileHandler): Extension {
  return EditorView.domEventHandlers({
    paste: (event, view) => handlePaste(event, view, onImageFile),
    drop: (event, view) => {
      const file = firstImageFile(event.dataTransfer);
      if (!file) {
        return false;
      }
      event.preventDefault();
      const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      onImageFile(view, file, dropPos ?? view.state.selection.main.head);
      return true;
    },
  });
}

async function pastePlainTextFromClipboard(view: EditorView): Promise<void> {
  const text = await globalThis.nefantaris.invoke("clipboard:readText");
  if (text !== "" && view.dom.isConnected) {
    insertPastedText(view, text);
  }
}

export function pastePlainText(view: EditorView): boolean {
  void pastePlainTextFromClipboard(view);
  return true;
}
