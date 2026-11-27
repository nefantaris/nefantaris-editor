import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const codeHighlighting = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "var(--color-code-keyword)" },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp],
    color: "var(--color-code-string)",
  },
  { tag: tags.comment, color: "var(--color-ink-muted)" },
  {
    tag: [tags.number, tags.bool, tags.atom, tags.unit, tags.color],
    color: "var(--color-code-number)",
  },
  {
    tag: [tags.typeName, tags.className, tags.tagName, tags.namespace],
    color: "var(--color-code-type)",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.definition(tags.variableName),
    ],
    color: "var(--color-code-keyword)",
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: "var(--color-code-type)",
  },
  {
    tag: tags.special(tags.variableName),
    color: "var(--color-code-keyword)",
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket],
    color: "var(--color-ink-secondary)",
  },
  { tag: tags.invalid, color: "var(--color-danger)" },
]);

const codeEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    fontSize: "0.875rem",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "var(--color-ink)",
    padding: "0.75rem 0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-ink)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-sunken)",
    color: "var(--color-ink-muted)",
    borderRight: "1px solid var(--color-line)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-raised)",
    color: "var(--color-ink-secondary)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--color-raised-strong)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in srgb, var(--color-primary) 22%, transparent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-line)",
    borderRadius: "0.375rem",
    fontFamily: "var(--font-sans)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "0.125rem 0.5rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
  },
  ".cm-completionLabel": {
    fontFamily: "var(--font-mono)",
  },
  ".cm-completionDetail": {
    marginLeft: "0.75rem",
    fontStyle: "normal",
    color: "inherit",
    opacity: "0.8",
  },
  ".cm-completionInfo": {
    maxWidth: "20rem",
    padding: "0.5rem",
  },
  ".cm-diagnostic": {
    fontFamily: "var(--font-sans)",
  },
  "&.cm-editor .cm-collapsedLines": {
    color: "var(--color-ink-muted)",
    background: "var(--color-raised)",
  },
});

export const codeAppearance: Extension = [
  codeEditorTheme,
  syntaxHighlighting(codeHighlighting),
];
