import type {
  SiteInspection,
  ThemeStyleToken,
} from "../../../electron/ipcContract.cts";
import { semanticColors } from "./codeEditor/cssCompletions.ts";

export type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type SemanticSwatch = {
  name: string;
  label: string;
  use: string;
  value: string;
  shown: string | null;
};

export type ContrastCheck = {
  ratio: number;
  required: number;
};

const MAX_VARIABLE_DEPTH = 12;
const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const BOLD_WEIGHT = 700;
const AA_NORMAL = 4.5;
const AA_LARGE = 3;
const SENTINEL_COLOR = "#010203";
const variablePattern = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/;
const semanticVariablePattern = /^var\(\s*--color-brand-([A-Za-z]+)\s*\)$/;

let probeCanvas: CanvasRenderingContext2D | null = null;

function swatchLabelOf(name: string): string {
  const words = name.replaceAll(/([A-Z])/g, " $1").toLowerCase();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function semanticVariable(name: string): string {
  return `var(--color-brand-${name})`;
}

export function semanticNameOf(value: string): string | null {
  const match = semanticVariablePattern.exec(value.trim());
  return match !== null &&
    semanticColors.some((color) => color.name === match[1])
    ? match[1]
    : null;
}

export function semanticLabelOf(name: string): string {
  return swatchLabelOf(name);
}

export function tokenValuesFor(
  tokens: ThemeStyleToken[],
  inspection: SiteInspection | null,
): Map<string, string> {
  const values = new Map(tokens.map((token) => [token.name, token.value]));
  for (const [name, definition] of Object.entries(inspection?.settings ?? {})) {
    const value = inspection?.settingValues[name];
    if (definition.type === "color" && definition.css !== null) {
      if (typeof value === "object" && value !== null) {
        values.set(definition.css, value.light);
      }
    } else if (definition.type === "select" && definition.css !== null) {
      const option = definition.options.find(
        (candidate) => candidate.value === value,
      );
      if (option?.css !== undefined && option.css !== null) {
        values.set(definition.css, option.css);
      }
    }
  }
  return values;
}

export function resolvedValue(
  value: string,
  tokens: Map<string, string>,
): string | null {
  let resolved = value;
  for (let depth = 0; depth < MAX_VARIABLE_DEPTH; depth += 1) {
    const match = variablePattern.exec(resolved);
    if (match === null) {
      return resolved;
    }
    const replacement = tokens.get(match[1]) ?? match[2];
    if (replacement === undefined) {
      return null;
    }
    resolved = `${resolved.slice(0, match.index)}${replacement.trim()}${resolved.slice(match.index + match[0].length)}`;
  }
  return null;
}

export function semanticSwatches(
  tokens: Map<string, string>,
): SemanticSwatch[] {
  return semanticColors.map((color) => {
    const value = semanticVariable(color.name);
    const shown = resolvedValue(value, tokens);
    return {
      name: color.name,
      label: swatchLabelOf(color.name),
      use: color.use,
      value,
      shown: shown !== null && CSS.supports("color", shown) ? shown : null,
    };
  });
}

function canvasContext(): CanvasRenderingContext2D | null {
  if (probeCanvas === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probeCanvas = canvas.getContext("2d", { willReadFrequently: true });
  }
  return probeCanvas;
}

function computedColorOf(value: string): string | null {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.hidden = true;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed === "" ? null : computed;
}

export function parsedColor(value: string): Rgba | null {
  if (value.trim() === "" || !CSS.supports("color", value)) {
    return null;
  }
  const computed = computedColorOf(value);
  const context = canvasContext();
  if (computed === null || context === null) {
    return null;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = SENTINEL_COLOR;
  context.fillStyle = computed;
  if (context.fillStyle === SENTINEL_COLOR && computed !== "rgb(1, 2, 3)") {
    return null;
  }
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: alpha / 255 };
}

export function hexOf(color: Rgba): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top.a + bottom.a * (1 - top.a);
  if (alpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const mix = (front: number, back: number) =>
    (front * top.a + back * bottom.a * (1 - top.a)) / alpha;
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a: alpha,
  };
}

export function flattenedBackground(layers: (Rgba | null)[]): Rgba {
  let result: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of layers.toReversed()) {
    if (layer !== null) {
      result = over(layer, result);
    }
  }
  return result;
}

function luminanceOf(color: Rgba): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

export function contrastBetween(
  text: Rgba,
  background: Rgba,
  fontSizePx: number,
  fontWeight: number,
): ContrastCheck {
  const shownText = over(text, background);
  const lighter = Math.max(luminanceOf(shownText), luminanceOf(background));
  const darker = Math.min(luminanceOf(shownText), luminanceOf(background));
  const isLarge =
    fontSizePx >= LARGE_TEXT_PX ||
    (fontSizePx >= LARGE_BOLD_TEXT_PX && fontWeight >= BOLD_WEIGHT);
  return {
    ratio: (lighter + 0.05) / (darker + 0.05),
    required: isLarge ? AA_LARGE : AA_NORMAL,
  };
}
