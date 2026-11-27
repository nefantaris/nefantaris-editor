import type {
  JsonObject,
  JsonValue,
  SiteConfigEdit,
  SiteConfigPath,
  SiteMode,
  ThemeColorPair,
  ThemeColorSetting,
  ThemeSettingDefinition,
  ThemeSettingValue,
} from "../../../electron/ipcContract.cts";
import { isSitePathOrHttpsUrl } from "./addressRules.ts";
import { isJsonObject } from "./siteSettingsModel.ts";

export type SettingDefinitions = Record<string, ThemeSettingDefinition>;

export type SettingGroup = {
  title: string | null;
  names: string[];
};

export type StoredSettings =
  { status: "ok"; values: JsonObject } | { status: "unreadable" };

export type SettingStatus = {
  isStored: boolean;
  isRejected: boolean;
};

export const COLOR_MODES: SiteMode[] = ["light", "dark"];

const SETTINGS_PATH: SiteConfigPath = ["theme", "settings"];
const FONT_PROPERTY_PREFIX = "--font-";
const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const shortHexPattern = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && hexColorPattern.test(value);
}

export function hexWithHash(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function expandedHex(value: string): string {
  return value
    .toLowerCase()
    .replace(shortHexPattern, (_match, red, green, blue) =>
      [red, red, green, green, blue, blue].reduce(
        (hex: string, digit: string) => hex + digit,
        "#",
      ),
    );
}

function isSameColor(first: string, second: string): boolean {
  return expandedHex(first) === expandedHex(second);
}

export function isFontSetting(definition: ThemeSettingDefinition): boolean {
  return (
    definition.type === "select" &&
    definition.css !== null &&
    definition.css.startsWith(FONT_PROPERTY_PREFIX)
  );
}

export function settingGroupsFrom(
  settings: SettingDefinitions,
): SettingGroup[] {
  const grouped = new Map<string | null, string[]>();
  for (const [name, definition] of Object.entries(settings)) {
    grouped.set(definition.group, [
      ...(grouped.get(definition.group) ?? []),
      name,
    ]);
  }
  const named = [...grouped]
    .filter(([title]) => title !== null)
    .map(([title, names]) => ({ title, names }));
  const ungrouped = grouped.get(null);
  return ungrouped === undefined
    ? named
    : [...named, { title: null, names: ungrouped }];
}

export function storedSettingsFrom(config: JsonObject): StoredSettings {
  const theme = config.theme;
  const settings = isJsonObject(theme) ? theme.settings : undefined;
  if (settings === undefined) {
    return { status: "ok", values: {} };
  }
  return isJsonObject(settings)
    ? { status: "ok", values: settings }
    : { status: "unreadable" };
}

export function hasStoredSettings(config: JsonObject): boolean {
  const theme = config.theme;
  return isJsonObject(theme) && theme.settings !== undefined;
}

function isAcceptedColor(value: JsonValue): boolean {
  if (isHexColor(value)) {
    return true;
  }
  return (
    isJsonObject(value) &&
    Object.entries(value).every(
      ([mode, modeValue]) =>
        (mode === "light" || mode === "dark") && isHexColor(modeValue),
    )
  );
}

export function isAcceptedSettingValue(
  definition: ThemeSettingDefinition,
  value: JsonValue,
): boolean {
  switch (definition.type) {
    case "color": {
      return isAcceptedColor(value);
    }
    case "select": {
      return definition.options.some((option) => option.value === value);
    }
    case "boolean": {
      return typeof value === "boolean";
    }
    case "text": {
      return typeof value === "string";
    }
    case "image": {
      return (
        value === null ||
        (typeof value === "string" && isSitePathOrHttpsUrl(value))
      );
    }
  }
}

export function settingStatus(
  definition: ThemeSettingDefinition,
  stored: JsonValue | undefined,
): SettingStatus {
  return {
    isStored: stored !== undefined,
    isRejected:
      stored !== undefined && !isAcceptedSettingValue(definition, stored),
  };
}

export function unknownSettingNames(
  stored: JsonObject,
  settings: SettingDefinitions,
): string[] {
  return Object.keys(stored).filter((name) => !Object.hasOwn(settings, name));
}

function isColorPair(
  value: ThemeSettingValue | undefined,
): value is ThemeColorPair {
  return (
    typeof value === "object" &&
    value !== null &&
    isHexColor(value.light) &&
    isHexColor(value.dark)
  );
}

function hexOr(value: JsonValue | undefined, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

export function colorInForce(
  definition: ThemeColorSetting,
  stored: JsonValue | undefined,
  reported: ThemeSettingValue | undefined,
): ThemeColorPair {
  if (stored === undefined) {
    return definition.default;
  }
  if (isHexColor(stored)) {
    return { light: stored, dark: stored };
  }
  if (isJsonObject(stored) && isAcceptedColor(stored)) {
    return {
      light: hexOr(stored.light, definition.default.light),
      dark: hexOr(stored.dark, definition.default.dark),
    };
  }
  return isColorPair(reported) ? reported : definition.default;
}

export function textInForce(
  definition: ThemeSettingDefinition & { default: string },
  stored: JsonValue | undefined,
  reported: ThemeSettingValue | undefined,
): string {
  if (stored === undefined) {
    return definition.default;
  }
  if (
    typeof stored === "string" &&
    isAcceptedSettingValue(definition, stored)
  ) {
    return stored;
  }
  return typeof reported === "string" ? reported : definition.default;
}

export function booleanInForce(
  definition: ThemeSettingDefinition & { default: boolean },
  stored: JsonValue | undefined,
  reported: ThemeSettingValue | undefined,
): boolean {
  if (typeof stored === "boolean") {
    return stored;
  }
  if (stored === undefined) {
    return definition.default;
  }
  return typeof reported === "boolean" ? reported : definition.default;
}

export function imageInForce(
  definition: ThemeSettingDefinition & { default: string | null },
  stored: JsonValue | undefined,
  reported: ThemeSettingValue | undefined,
): string | null {
  if (stored === undefined) {
    return definition.default;
  }
  if (
    (stored === null || typeof stored === "string") &&
    isAcceptedSettingValue(definition, stored)
  ) {
    return stored;
  }
  return typeof reported === "string" || reported === null
    ? reported
    : definition.default;
}

export function isSplitColorStored(
  definition: ThemeColorSetting,
  stored: JsonValue | undefined,
): boolean {
  if (isJsonObject(stored)) {
    return true;
  }
  if (typeof stored === "string") {
    return false;
  }
  return !isSameColor(definition.default.light, definition.default.dark);
}

export function colorChoice(
  definition: ThemeColorSetting,
  pair: ThemeColorPair,
  isSplit: boolean,
  hasDarkLook: boolean,
): JsonValue | undefined {
  if (!isSplit) {
    const modesToMatch = hasDarkLook ? COLOR_MODES : ["light" as const];
    return modesToMatch.every((mode) =>
      isSameColor(pair.light, definition.default[mode]),
    )
      ? undefined
      : pair.light;
  }
  const changed = Object.fromEntries(
    COLOR_MODES.filter(
      (mode) => !isSameColor(pair[mode], definition.default[mode]),
    ).map((mode) => [mode, pair[mode]]),
  );
  return Object.keys(changed).length === 0 ? undefined : changed;
}

export function scalarChoice<Value extends string | boolean | null>(
  definition: { default: Value },
  value: Value,
): Value | undefined {
  return value === definition.default ? undefined : value;
}

export function settingValueEdits(
  stored: JsonObject,
  name: string,
  value: JsonValue | undefined,
): SiteConfigEdit[] {
  if (value !== undefined) {
    return [{ kind: "set", path: [...SETTINGS_PATH, name], value }];
  }
  if (!Object.hasOwn(stored, name)) {
    return [];
  }
  const hasOthers = Object.keys(stored).some((key) => key !== name);
  return [
    {
      kind: "remove",
      path: hasOthers ? [...SETTINGS_PATH, name] : SETTINGS_PATH,
    },
  ];
}

export function resetAllEdits(config: JsonObject): SiteConfigEdit[] {
  return hasStoredSettings(config)
    ? [{ kind: "remove", path: SETTINGS_PATH }]
    : [];
}
