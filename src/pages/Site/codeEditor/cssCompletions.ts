import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { pickedCompletion } from "@codemirror/autocomplete";
import { cssLanguage } from "@codemirror/lang-css";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type {
  ThemePart,
  ThemeSettingDefinition,
  ThemeStyleToken,
} from "../../../../electron/ipcContract.cts";

export type StyleVocabulary = {
  tokens: ThemeStyleToken[];
  parts: Record<string, ThemePart>;
  settings: Record<string, ThemeSettingDefinition>;
};

type SemanticColor = { name: string; use: string };

export const semanticColors: SemanticColor[] = [
  { name: "primary", use: "Primary actions and links" },
  { name: "primaryHover", use: "Primary under the pointer or pressed" },
  { name: "onPrimary", use: "Text and icons on primary" },
  { name: "text", use: "Body text" },
  { name: "muted", use: "Quieter text: hints, captions, placeholders" },
  { name: "background", use: "The page" },
  { name: "surface", use: "Raised areas: a field, a card, a code block" },
  { name: "border", use: "Field borders and dividers" },
  { name: "danger", use: "Errors and destructive actions" },
  { name: "onDanger", use: "Text and icons on danger" },
];

const SEMANTIC_SECTION = { name: "Colours every theme has", rank: 0 };
const THEME_SECTION = { name: "Your theme", rank: 1 };
const PARTS_SECTION = { name: "Parts of your theme", rank: 0 };

const customPropertyBefore = /--[\w-]*/;
const emptyVarCallBefore = /var\(\s*/;
const partNameBefore = /\[data-part\s*=\s*["']?[\w-]*/;
const selectorWordBefore = /\[[\w-]*|[\w-]+/;
const customPropertyValidFor = /^--[\w-]*$/;
const partNameValidFor = /^[\w-]*$/;

const styleVocabularyFacet = Facet.define<
  StyleVocabulary | null,
  StyleVocabulary | null
>({
  combine: (values) => values[0] ?? null,
});

function settingLabelsByProperty(
  settings: Record<string, ThemeSettingDefinition>,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const definition of Object.values(settings)) {
    if (
      (definition.type === "color" || definition.type === "select") &&
      definition.css !== null
    ) {
      labels.set(definition.css, definition.label);
    }
  }
  return labels;
}

function customPropertyOptions(vocabulary: StyleVocabulary): Completion[] {
  const semanticNames = new Set(
    semanticColors.map((color) => `--color-brand-${color.name}`),
  );
  const settingLabels = settingLabelsByProperty(vocabulary.settings);
  const semantic = semanticColors.map((color): Completion => ({
    label: `--color-brand-${color.name}`,
    type: "variable",
    detail: "Colour",
    info: color.use,
    section: SEMANTIC_SECTION,
  }));
  const fromTheme = vocabulary.tokens
    .filter((token) => !semanticNames.has(token.name))
    .map((token): Completion => {
      const settingLabel = settingLabels.get(token.name);
      return {
        label: token.name,
        type: "variable",
        detail: token.value,
        info:
          settingLabel === undefined
            ? undefined
            : `Design choice: ${settingLabel}`,
        section: THEME_SECTION,
      };
    });
  const tokenNames = new Set(vocabulary.tokens.map((token) => token.name));
  const fromSettings = [...settingLabels]
    .filter(([name]) => !tokenNames.has(name) && !semanticNames.has(name))
    .map(([name, label]): Completion => ({
      label: name,
      type: "variable",
      detail: label,
      info: `Design choice: ${label}`,
      section: THEME_SECTION,
    }));
  return [...semantic, ...fromTheme, ...fromSettings];
}

function partNameOptions(vocabulary: StyleVocabulary): Completion[] {
  return Object.entries(vocabulary.parts).map(([name, part]): Completion => ({
    label: name,
    type: "keyword",
    detail: part.label,
    info: part.description ?? undefined,
    section: PARTS_SECTION,
  }));
}

function applySelector(
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
): void {
  const closesBracket = view.state.sliceDoc(to, to + 1) === "]";
  const insert = completion.label;
  view.dispatch({
    changes: { from, to: closesBracket ? to + 1 : to, insert },
    selection: { anchor: from + insert.length },
    annotations: pickedCompletion.of(completion),
    userEvent: "input.complete",
  });
}

function partSelectorOptions(vocabulary: StyleVocabulary): Completion[] {
  return Object.entries(vocabulary.parts).map(([name, part]): Completion => ({
    label: `[data-part="${name}"]`,
    type: "class",
    detail: part.label,
    info: part.description ?? undefined,
    section: PARTS_SECTION,
    apply: applySelector,
  }));
}

function isInDeclarations(context: CompletionContext): boolean {
  for (
    let node = syntaxTree(context.state).resolveInner(context.pos, -1);
    node.parent !== null;
    node = node.parent
  ) {
    if (node.name === "Block") {
      return node.parent.name === "RuleSet";
    }
  }
  return false;
}

function themeStyleCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const vocabulary = context.state.facet(styleVocabularyFacet);
  if (vocabulary === null) {
    return null;
  }
  const property = context.matchBefore(customPropertyBefore);
  if (property !== null) {
    return {
      from: property.from,
      options: customPropertyOptions(vocabulary),
      validFor: customPropertyValidFor,
    };
  }
  if (context.matchBefore(emptyVarCallBefore) !== null) {
    return {
      from: context.pos,
      options: customPropertyOptions(vocabulary),
      validFor: customPropertyValidFor,
    };
  }
  const partName = context.matchBefore(partNameBefore);
  if (partName !== null) {
    const nameStart = /[\w-]*$/.exec(partName.text)?.index ?? 0;
    return {
      from: partName.from + nameStart,
      options: partNameOptions(vocabulary),
      validFor: partNameValidFor,
    };
  }
  if (isInDeclarations(context)) {
    return null;
  }
  const word = context.matchBefore(selectorWordBefore);
  if (word === null && !context.explicit) {
    return null;
  }
  return {
    from: word?.from ?? context.pos,
    options: partSelectorOptions(vocabulary),
  };
}

const themeStyleCompletionSource: CompletionSource = themeStyleCompletions;

export function styleVocabularyExtension(
  vocabulary: StyleVocabulary | null,
): Extension {
  return [
    styleVocabularyFacet.of(vocabulary),
    cssLanguage.data.of({ autocomplete: themeStyleCompletionSource }),
  ];
}
