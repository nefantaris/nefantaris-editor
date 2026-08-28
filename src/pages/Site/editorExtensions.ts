import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { livePreviewExtensions } from "./livePreview/index.ts";

export type EditorExtensionsConfig = {
  sitePath: string;
  lineSeparator: string | null;
  onDocChanged: () => void;
  onImageFile: (view: EditorView, file: File, insertPos: number) => void;
  onInsertDirectiveRequested: () => void;
};

export function detectLineSeparator(text: string): string | null {
  if (!text.includes("\r\n")) {
    return null;
  }
  return /[\r\n]/.test(text.replaceAll("\r\n", "")) ? null : "\r\n";
}

const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.5em", fontWeight: "700" },
  { tag: tags.heading2, fontSize: "1.25em", fontWeight: "700" },
  { tag: tags.heading3, fontSize: "1.125em", fontWeight: "600" },
  { tag: tags.heading, fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--color-brand-primary)" },
  { tag: tags.url, color: "var(--color-brand-primary)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
  { tag: tags.quote, color: "var(--color-brand-grayDark)" },
  { tag: tags.meta, color: "var(--color-brand-gray)" },
  { tag: tags.processingInstruction, color: "var(--color-brand-gray)" },
  { tag: tags.contentSeparator, color: "var(--color-brand-gray)" },
  { tag: tags.keyword, color: "var(--color-brand-secondary)" },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--color-brand-success)",
  },
  {
    tag: tags.comment,
    color: "var(--color-brand-gray)",
    fontStyle: "italic",
  },
  {
    tag: [tags.number, tags.bool, tags.atom, tags.literal],
    color: "var(--color-brand-primaryActive)",
  },
  {
    tag: [tags.typeName, tags.className, tags.tagName],
    color: "var(--color-brand-secondaryActive)",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--color-brand-primary)",
  },
  { tag: tags.propertyName, color: "var(--color-brand-primaryHover)" },
  { tag: tags.operator, color: "var(--color-brand-grayDark)" },
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-brand-white)",
    color: "var(--color-brand-black)",
    fontSize: "1rem",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-sans)",
    lineHeight: "1.75",
    overflow: "auto",
  },
  ".cm-content": {
    maxWidth: "44rem",
    margin: "0 auto",
    padding: "3rem 1.5rem",
    caretColor: "var(--color-brand-black)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-brand-black)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--color-brand-grayLight)",
  },
});

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

function imageTransferHandlers(config: EditorExtensionsConfig): Extension {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const file = firstImageFile(event.clipboardData);
      if (!file) {
        return false;
      }
      event.preventDefault();
      config.onImageFile(view, file, view.state.selection.main.head);
      return true;
    },
    drop: (event, view) => {
      const file = firstImageFile(event.dataTransfer);
      if (!file) {
        return false;
      }
      event.preventDefault();
      const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      config.onImageFile(view, file, dropPos ?? view.state.selection.main.head);
      return true;
    },
  });
}

export function createEditorExtensions(
  config: EditorExtensionsConfig,
): Extension[] {
  return [
    ...(config.lineSeparator
      ? [EditorState.lineSeparator.of(config.lineSeparator)]
      : []),
    history(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([
      {
        key: "Mod-/",
        run: () => {
          config.onInsertDirectiveRequested();
          return true;
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    syntaxHighlighting(markdownHighlighting),
    editorTheme,
    ...livePreviewExtensions({ sitePath: config.sitePath }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        config.onDocChanged();
      }
    }),
    imageTransferHandlers(config),
  ];
}
