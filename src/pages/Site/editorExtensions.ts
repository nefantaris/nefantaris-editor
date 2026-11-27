import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { EditorCommand } from "./formatting/editorCommands.ts";
import type { ImageFileHandler } from "./formatting/pasteHandling.ts";
import { pasteHandling, pastePlainText } from "./formatting/pasteHandling.ts";
import { revealLineExtension } from "./formatting/revealLine.ts";
import type { SlashPickHandler } from "./formatting/slashMenu.ts";
import { slashMenu } from "./formatting/slashMenu.ts";
import { livePreviewExtensions } from "./livePreview/index.ts";

export type EditorExtensionsConfig = {
  sitePath: string;
  lineSeparator: string | null;
  onDocChanged: () => void;
  onSelectionOrDocChanged: (view: EditorView) => void;
  onImageFile: ImageFileHandler;
  onInsertDirectiveRequested: () => void;
  onBlockOptionsRequested: (lineFrom: number) => void;
  onCommandRequested: (command: EditorCommand) => void;
  onSlashPicked: SlashPickHandler;
};

const shortcutCommands: { key: string; command: EditorCommand }[] = [
  { key: "Mod-b", command: "bold" },
  { key: "Mod-i", command: "italic" },
  { key: "Mod-Shift-x", command: "strikethrough" },
  { key: "Mod-k", command: "link" },
];

export function detectLineSeparator(text: string): string | null {
  if (!text.includes("\r\n")) {
    return null;
  }
  return /[\r\n]/.test(text.replaceAll("\r\n", "")) ? null : "\r\n";
}

const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.5em", fontWeight: "600" },
  { tag: tags.heading2, fontSize: "1.25em", fontWeight: "600" },
  { tag: tags.heading3, fontSize: "1.125em", fontWeight: "600" },
  { tag: tags.heading, fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--color-primary-ink)" },
  { tag: tags.url, color: "var(--color-primary-ink)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
  { tag: tags.quote, color: "var(--color-ink-secondary)" },
  { tag: tags.meta, color: "var(--color-ink-muted)" },
  { tag: tags.processingInstruction, color: "var(--color-ink-muted)" },
  { tag: tags.contentSeparator, color: "var(--color-ink-muted)" },
  { tag: tags.keyword, color: "var(--color-code-keyword)" },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--color-code-string)",
  },
  { tag: tags.comment, color: "var(--color-ink-muted)" },
  {
    tag: [tags.number, tags.bool, tags.atom, tags.literal],
    color: "var(--color-code-number)",
  },
  {
    tag: [tags.typeName, tags.className, tags.tagName],
    color: "var(--color-code-type)",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--color-code-keyword)",
  },
  { tag: tags.propertyName, color: "var(--color-code-type)" },
  { tag: tags.operator, color: "var(--color-ink-secondary)" },
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
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
    caretColor: "var(--color-ink)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-ink)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--color-raised-strong)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in srgb, var(--color-primary) 22%, transparent)",
  },
});

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
      ...shortcutCommands.map(({ key, command }) => ({
        key,
        run: () => {
          config.onCommandRequested(command);
          return true;
        },
      })),
      { key: "Mod-Shift-v", run: pastePlainText },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    syntaxHighlighting(markdownHighlighting),
    editorTheme,
    ...livePreviewExtensions({
      sitePath: config.sitePath,
      onBlockOptionsRequested: config.onBlockOptionsRequested,
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        config.onDocChanged();
      }
      if (update.docChanged || update.selectionSet) {
        config.onSelectionOrDocChanged(update.view);
      }
    }),
    pasteHandling(config.onImageFile),
    slashMenu(config.onSlashPicked),
    revealLineExtension,
  ];
}
