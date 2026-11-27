import type {
  StyleDeclaration,
  StyledRule,
  StyleEdit,
  StyleScope,
} from "../../../electron/ipcContract.cts";
import type { LengthUnit } from "./styleProperties.ts";

export type StyleFieldStatus = {
  isSet: boolean;
  inheritedFrom: string | null;
};

export type ParsedLength = {
  amount: number;
  unit: LengthUnit;
};

export type NudgeKeys = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
};

const ROOT_FONT_SIZE_PX = 16;
const nudgeDirections = new Map([
  ["ArrowUp", 1],
  ["ArrowDown", -1],
]);
const lengthPattern = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|%)?$/i;
const knownUnits: LengthUnit[] = ["px", "rem", "em", "%", ""];

export function nudgeDirectionOf(key: string): number | null {
  return nudgeDirections.get(key) ?? null;
}

function unitOf(text: string): LengthUnit {
  return knownUnits.find((unit) => unit === text.toLowerCase()) ?? "";
}

export function parseLength(text: string): ParsedLength | null {
  const match = lengthPattern.exec(text.trim());
  return match === null
    ? null
    : { amount: Number(match[1]), unit: unitOf(match[2] ?? "") };
}

export function formatAmount(amount: number): string {
  return String(Math.round(amount * 1000) / 1000);
}

export function withUnit(text: string, unit: LengthUnit): string {
  const trimmed = text.trim();
  const parsed = parseLength(trimmed);
  if (parsed === null || trimmed === "") {
    return trimmed;
  }
  return lengthPattern.exec(trimmed)?.[2] === undefined
    ? `${formatAmount(parsed.amount)}${unit}`
    : trimmed;
}

function stepFor(unit: LengthUnit, keys: NudgeKeys): number {
  const base = unit === "rem" || unit === "em" || unit === "" ? 0.1 : 1;
  if (keys.shiftKey) {
    return base * 10;
  }
  return keys.altKey ? base / 10 : base;
}

function startingAmount(
  current: string,
  fallback: string,
  unit: LengthUnit,
): number {
  const parsed = parseLength(current);
  if (parsed !== null) {
    return parsed.amount;
  }
  const computed = parseLength(fallback);
  if (computed === null) {
    return 0;
  }
  if (computed.unit === unit) {
    return computed.amount;
  }
  return computed.unit === "px" && (unit === "rem" || unit === "em")
    ? computed.amount / ROOT_FONT_SIZE_PX
    : 0;
}

export function nudgedLength(
  current: string,
  fallback: string,
  unit: LengthUnit,
  keys: NudgeKeys,
  isNegativeAllowed: boolean,
): string | null {
  const direction = nudgeDirectionOf(keys.key);
  if (direction === null) {
    return null;
  }
  const parsed = parseLength(current);
  if (current.trim() !== "" && parsed === null) {
    return null;
  }
  const nextUnit =
    parsed?.unit === "" && unit !== "" ? unit : (parsed?.unit ?? unit);
  const next =
    startingAmount(current, fallback, nextUnit) +
    direction * stepFor(nextUnit, keys);
  const bounded = isNegativeAllowed ? next : Math.max(0, next);
  return `${formatAmount(bounded)}${nextUnit}`;
}

export function isLengthAccepted(
  property: string,
  text: string,
  unit: LengthUnit,
): boolean {
  return CSS.supports(property, withUnit(text, unit));
}

export function shownUnit(text: string, preferred: LengthUnit): LengthUnit {
  const parsed = parseLength(text);
  if (parsed === null || lengthPattern.exec(text.trim())?.[2] === undefined) {
    return preferred;
  }
  return parsed.unit;
}

export function statusBadgeText(status: StyleFieldStatus): string | null {
  if (status.isSet) {
    return status.inheritedFrom === null
      ? "Set"
      : `Overrides ${status.inheritedFrom}`;
  }
  return status.inheritedFrom === null ? null : `From ${status.inheritedFrom}`;
}

export function declaredIn(
  rules: StyledRule[],
  selector: string,
  scope: StyleScope,
): Map<string, string> {
  const declared = new Map<string, string>();
  for (const rule of rules) {
    if (rule.key !== selector || rule.scope !== scope) {
      continue;
    }
    for (const declaration of rule.declarations) {
      declared.set(declaration.property, declaration.value);
    }
  }
  return declared;
}

function editedDeclarations(
  declarations: StyleDeclaration[],
  edit: StyleEdit,
): StyleDeclaration[] {
  const removed = new Set([
    ...edit.remove,
    ...edit.set.map((value) => value.property),
  ]);
  return [
    ...declarations.filter((declaration) => !removed.has(declaration.property)),
    ...edit.set.map((value) => ({
      property: value.property,
      value: value.value,
      isImportant: false,
    })),
  ];
}

export function rulesWithEdit(
  rules: StyledRule[],
  edit: StyleEdit,
): StyledRule[] {
  const isTarget = (rule: StyledRule) =>
    rule.key === edit.selector && rule.scope === edit.scope;
  const hasTarget = rules.some(isTarget);
  const edited = rules.map((rule) =>
    isTarget(rule)
      ? { ...rule, declarations: editedDeclarations(rule.declarations, edit) }
      : rule,
  );
  const added: StyledRule[] =
    hasTarget || edit.set.length === 0
      ? []
      : [
          {
            selector: edit.selector,
            key: edit.selector,
            scope: edit.scope,
            line: 0,
            declarations: editedDeclarations([], edit),
          },
        ];
  return [...edited, ...added].filter(
    (rule) => rule.declarations.length > 0 || !isTarget(rule),
  );
}

export type FontStack = {
  label: string;
  value: string;
};

export const systemFontStacks: FontStack[] = [
  {
    label: "System sans-serif",
    value: "system-ui, sans-serif",
  },
  {
    label: "Transitional serif",
    value: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
  },
  {
    label: "Old-style serif",
    value:
      "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif",
  },
  {
    label: "Humanist sans",
    value:
      "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
  },
  {
    label: "Geometric sans",
    value:
      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
  },
  {
    label: "Rounded sans",
    value:
      "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, source-sans-pro, sans-serif",
  },
  {
    label: "Condensed",
    value:
      "Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Nimbus Sans Narrow', sans-serif-condensed, sans-serif",
  },
  {
    label: "Monospace",
    value:
      "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  },
];
