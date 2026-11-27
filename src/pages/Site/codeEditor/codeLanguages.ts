import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import type { LanguageSupport } from "@codemirror/language";

export type CodeLanguage = "css" | "tsx" | "ts" | "jsx" | "js";

const languagesByExtension: Record<string, CodeLanguage> = {
  css: "css",
  tsx: "tsx",
  ts: "ts",
  mts: "ts",
  jsx: "jsx",
  js: "js",
  mjs: "js",
};

export function codeLanguageOf(filePath: string): CodeLanguage | null {
  const extension = filePath.split(".").at(-1) ?? "";
  return languagesByExtension[extension] ?? null;
}

export function languageSupportFor(language: CodeLanguage): LanguageSupport {
  switch (language) {
    case "css": {
      return css();
    }
    case "tsx": {
      return javascript({ jsx: true, typescript: true });
    }
    case "ts": {
      return javascript({ typescript: true });
    }
    case "jsx": {
      return javascript({ jsx: true });
    }
    case "js": {
      return javascript();
    }
  }
}
