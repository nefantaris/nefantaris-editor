import type {
  SiteInspection,
  ThemeStyleToken,
} from "../../../electron/ipcContract.cts";
import type { FontStack } from "./styleValues.ts";

const FONT_TOKEN_PREFIX = "--font-";
const singleVariablePattern = /^var\(\s*(--[\w-]+)\s*\)$/;

function words(name: string): string {
  return name.replaceAll("-", " ");
}

export function themeFontsFrom(
  tokens: ThemeStyleToken[],
  inspection: SiteInspection | null,
): FontStack[] {
  const settings = Object.values(inspection?.settings ?? {});
  const fontTokens = tokens.filter((token) =>
    token.name.startsWith(FONT_TOKEN_PREFIX),
  );
  const referenced = new Set(
    fontTokens.flatMap(
      (token) => singleVariablePattern.exec(token.value)?.slice(1, 2) ?? [],
    ),
  );
  const tokenFonts = fontTokens.map((token): FontStack => {
    const variable = singleVariablePattern.exec(token.value)?.[1];
    const setting = settings.find(
      (definition) =>
        definition.type === "select" && definition.css === variable,
    );
    return {
      label:
        setting === undefined
          ? `Theme ${words(token.name.slice(FONT_TOKEN_PREFIX.length))}`
          : setting.label,
      value: `var(${token.name})`,
    };
  });
  const settingFonts = settings.flatMap((definition): FontStack[] =>
    definition.type === "select" &&
    definition.css !== null &&
    (referenced.has(definition.css) ||
      definition.css.startsWith(FONT_TOKEN_PREFIX))
      ? definition.options.flatMap((option) =>
          option.css === null || option.css.includes("var(")
            ? []
            : [{ label: option.label, value: option.css }],
        )
      : [],
  );
  const seen = new Set<string>();
  return [...tokenFonts, ...settingFonts].filter((stack) => {
    if (seen.has(stack.value)) {
      return false;
    }
    seen.add(stack.value);
    return true;
  });
}

const partNamePattern = /\[data-part="([a-z][a-z0-9-]*)"\]/g;

export function partsInSelector(selector: string): string[] {
  return [...selector.matchAll(partNamePattern)].map((match) => match[1]);
}
