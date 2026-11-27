import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { codeAppearance } from "./codeAppearance.ts";
import type { CodeLanguage } from "./codeLanguages.ts";
import { languageSupportFor } from "./codeLanguages.ts";
import { codeLint } from "./codeLint.ts";

export function codeEditing(language: CodeLanguage, label: string): Extension {
  return [
    history(),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    lintGutter(),
    keymap.of([
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...lintKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    languageSupportFor(language),
    codeLint(language),
    codeAppearance,
    EditorView.contentAttributes.of({ "aria-label": label }),
  ];
}

export function readOnlyCode(language: CodeLanguage, label: string): Extension {
  return [
    lineNumbers(),
    languageSupportFor(language),
    codeAppearance,
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ "aria-label": label }),
  ];
}
