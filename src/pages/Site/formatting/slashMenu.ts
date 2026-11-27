import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSection,
} from "@codemirror/autocomplete";
import {
  autocompletion,
  closeCompletion,
  completionStatus,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import {
  EditorState,
  Facet,
  MapMode,
  Prec,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { ReplacedText } from "./editorEdits.ts";
import { isCodeLine, isFrontmatterPosition } from "./markdownContext.ts";

type BuiltInSection = "text" | "insert";

export type SlashSection = {
  name: string;
  rank: number;
};

export type SlashItem = {
  id: string;
  label: string;
  description: string | null;
  keywords: string;
  section: BuiltInSection | SlashSection;
};

export type SlashPickHandler = (
  view: EditorView,
  id: string,
  trigger: ReplacedText,
) => void;

const builtInSections: Record<BuiltInSection, CompletionSection> = {
  text: { name: "Text", rank: 0 },
  insert: { name: "Insert", rank: 1 },
};

export const FIRST_BLOCK_SECTION_RANK = 2;

const slashTriggerPattern = /^(\s*)\/([^/]*)$/;

export const slashItemsFacet = Facet.define<SlashItem[], SlashItem[]>({
  combine: (values) => values.flat(),
});

const slashPickFacet = Facet.define<SlashPickHandler, SlashPickHandler | null>({
  combine: (values) => values[0] ?? null,
});

const dismissSlash = StateEffect.define<number>();

const dismissedSlashField = StateField.define<number | null>({
  create: () => null,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(dismissSlash)) {
        return effect.value;
      }
    }
    return value === null || !transaction.docChanged
      ? value
      : transaction.changes.mapPos(value, 1, MapMode.TrackDel);
  },
});

function slashBefore(
  state: EditorState,
  pos: number,
): { from: number; query: string } | null {
  const line = state.doc.lineAt(pos);
  const match = slashTriggerPattern.exec(state.sliceDoc(line.from, pos));
  return match === null
    ? null
    : { from: line.from + match[1].length, query: match[2] };
}

const dismissOnEscape = Prec.highest(
  keymap.of([
    {
      key: "Escape",
      run: (view) => {
        if (completionStatus(view.state) !== "active") {
          return false;
        }
        const slash = slashBefore(view.state, view.state.selection.main.head);
        if (slash !== null) {
          view.dispatch({ effects: dismissSlash.of(slash.from) });
        }
        return closeCompletion(view);
      },
    },
  ]),
);

function wordsOf(item: SlashItem): string[] {
  return `${item.label} ${item.keywords} ${item.description ?? ""}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

function rankOf(item: SlashItem, query: string, terms: string[]): number {
  const label = item.label.toLowerCase();
  if (label.startsWith(query)) {
    return 0;
  }
  return label.split(/\s+/).some((word) => word.startsWith(terms[0])) ? 1 : 2;
}

function matchingSlashItems(items: SlashItem[], rawQuery: string): SlashItem[] {
  const query = rawQuery.trim().toLowerCase();
  const terms = query.split(/\s+/).filter((term) => term !== "");
  if (terms.length === 0) {
    return items;
  }
  return items
    .flatMap((item) => {
      const words = wordsOf(item);
      const isMatch = terms.every((term) =>
        words.some((word) => word.startsWith(term)),
      );
      return isMatch ? [{ item, rank: rankOf(item, query, terms) }] : [];
    })
    .toSorted((a, b) => a.rank - b.rank)
    .map((entry) => entry.item);
}

function completionFor(item: SlashItem): Completion {
  return {
    label: item.label,
    detail: item.description ?? undefined,
    section:
      typeof item.section === "string"
        ? builtInSections[item.section]
        : item.section,
    apply: (view, _completion, from, to) => {
      closeCompletion(view);
      view.state.facet(slashPickFacet)?.(view, item.id, { from, to });
    },
  };
}

function slashSource(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const slash = slashBefore(state, pos);
  if (
    slash === null ||
    /^\s/.test(slash.query) ||
    state.field(dismissedSlashField) === slash.from ||
    isFrontmatterPosition(state, pos) ||
    isCodeLine(state, state.doc.lineAt(pos))
  ) {
    return null;
  }
  const items = matchingSlashItems(state.facet(slashItemsFacet), slash.query);
  if (items.length === 0) {
    return null;
  }
  return {
    from: slash.from,
    to: pos,
    filter: false,
    options: items.map((item) => completionFor(item)),
  };
}

const slashMenuTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-line)",
    borderRadius: "0.375rem",
    padding: "0.25rem",
    boxShadow: "none",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-sans)",
    maxHeight: "20rem",
    minWidth: "16rem",
    maxWidth: "22rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[role=option]": {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    padding: "0.375rem 0.5rem",
    borderRadius: "0.375rem",
    lineHeight: "1.3",
    whiteSpace: "normal",
    color: "var(--color-ink)",
    cursor: "pointer",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[role=option][aria-selected]": {
    backgroundColor: "var(--color-raised)",
    color: "var(--color-ink)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section": {
    display: "block",
    padding: "0.5rem 0.5rem 0.25rem",
    border: "none",
    color: "var(--color-ink-muted)",
    fontSize: "0.75rem",
    fontWeight: "600",
    opacity: "1",
  },
  ".cm-completionLabel": {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  ".cm-completionDetail": {
    marginLeft: "0",
    fontStyle: "normal",
    fontSize: "0.75rem",
    color: "var(--color-ink-secondary)",
  },
});

export function slashMenu(onPicked: SlashPickHandler): Extension {
  return [
    dismissedSlashField,
    dismissOnEscape,
    autocompletion({
      override: [slashSource],
      icons: false,
      closeOnBlur: true,
      maxRenderedOptions: 200,
    }),
    slashPickFacet.of(onPicked),
    EditorState.phrases.of({ Completions: "Add to the page" }),
    slashMenuTheme,
  ];
}
