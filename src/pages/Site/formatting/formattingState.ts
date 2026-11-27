import type { EditorState } from "@codemirror/state";
import { isInlineStyleActive } from "./inlineFormatting.ts";
import type { HeadingLevel } from "./lineFormatting.ts";
import { headingLevelOf, isLineFormatActive } from "./lineFormatting.ts";
import { isLinkActive } from "./linkEditing.ts";
import { isFormattingBlocked } from "./markdownContext.ts";

export type FormattingState = {
  isAvailable: boolean;
  headingLevel: HeadingLevel | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  link: boolean;
  bullet: boolean;
  numbered: boolean;
  task: boolean;
  quote: boolean;
};

export const unavailableFormatting: FormattingState = {
  isAvailable: false,
  headingLevel: null,
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  link: false,
  bullet: false,
  numbered: false,
  task: false,
  quote: false,
};

export function formattingStateOf(state: EditorState): FormattingState {
  if (isFormattingBlocked(state)) {
    return unavailableFormatting;
  }
  return {
    isAvailable: true,
    headingLevel: headingLevelOf(state),
    bold: isInlineStyleActive(state, "bold"),
    italic: isInlineStyleActive(state, "italic"),
    strikethrough: isInlineStyleActive(state, "strikethrough"),
    code: isInlineStyleActive(state, "code"),
    link: isLinkActive(state),
    bullet: isLineFormatActive(state, "bullet"),
    numbered: isLineFormatActive(state, "numbered"),
    task: isLineFormatActive(state, "task"),
    quote: isLineFormatActive(state, "quote"),
  };
}

export function isSameFormatting(
  a: FormattingState,
  b: FormattingState,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
