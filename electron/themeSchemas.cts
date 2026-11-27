import type {
  BlockAttribute,
  BlockBody,
  BlockSchema,
  BlockText,
  ChoiceOption,
  InspectedTheme,
  PluginHeadTag,
  ThemeColorPair,
  ThemePart,
  ThemeSettingDefinition,
  ThemeSettingOption,
  ThemeSettingValue,
} from "./ipcContract.cjs";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function choiceOptionsFrom(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown): ChoiceOption[] =>
    isRecord(item) &&
    typeof item.value === "string" &&
    typeof item.label === "string"
      ? [{ value: item.value, label: item.label }]
      : [],
  );
}

function settingOptionsFrom(value: unknown): ThemeSettingOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown): ThemeSettingOption[] =>
    isRecord(item) &&
    typeof item.value === "string" &&
    typeof item.label === "string"
      ? [{ value: item.value, label: item.label, css: textOrNull(item.css) }]
      : [],
  );
}

function colorPairFrom(value: unknown): ThemeColorPair | null {
  if (typeof value === "string") {
    return { light: value, dark: value };
  }
  if (
    isRecord(value) &&
    typeof value.light === "string" &&
    typeof value.dark === "string"
  ) {
    return { light: value.light, dark: value.dark };
  }
  return null;
}

function settingDefinitionFrom(source: unknown): ThemeSettingDefinition | null {
  if (!isRecord(source) || typeof source.label !== "string") {
    return null;
  }
  const common = {
    label: source.label,
    description: textOrNull(source.description),
    group: textOrNull(source.group),
  };
  const fallback = source.default;
  switch (source.type) {
    case "color": {
      const pair = colorPairFrom(fallback);
      return pair === null
        ? null
        : {
            type: "color",
            ...common,
            css: textOrNull(source.css),
            default: pair,
          };
    }
    case "select": {
      const options = settingOptionsFrom(source.options);
      return typeof fallback === "string" && options.length > 0
        ? {
            type: "select",
            ...common,
            css: textOrNull(source.css),
            options,
            default: fallback,
          }
        : null;
    }
    case "boolean": {
      return typeof fallback === "boolean"
        ? { type: "boolean", ...common, default: fallback }
        : null;
    }
    case "text": {
      return typeof fallback === "string"
        ? {
            type: "text",
            ...common,
            multiline: source.multiline === true,
            default: fallback,
          }
        : null;
    }
    case "image": {
      return { type: "image", ...common, default: textOrNull(fallback) };
    }
    default: {
      return null;
    }
  }
}

function blockAttributeFrom(source: unknown): BlockAttribute | null {
  if (!isRecord(source) || typeof source.label !== "string") {
    return null;
  }
  const common = {
    label: source.label,
    description: textOrNull(source.description),
    required: source.required === true,
  };
  const fallback = source.default;
  const example = textOrNull(source.example);
  switch (source.type) {
    case "text": {
      return {
        type: "text",
        ...common,
        multiline: source.multiline === true,
        default: textOrNull(fallback),
        example,
      };
    }
    case "select": {
      const options = choiceOptionsFrom(source.options);
      return options.length === 0
        ? null
        : { type: "select", ...common, options, default: textOrNull(fallback) };
    }
    case "boolean": {
      return {
        type: "boolean",
        ...common,
        default: typeof fallback === "boolean" ? fallback : null,
      };
    }
    case "image": {
      return {
        type: "image",
        ...common,
        alt: textOrNull(source.alt),
        default: textOrNull(fallback),
        example,
      };
    }
    case "url": {
      return { type: "url", ...common, default: textOrNull(fallback), example };
    }
    default: {
      return null;
    }
  }
}

function blockAttributesFrom(value: unknown): Record<string, BlockAttribute> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(
      ([name, source]): [string, BlockAttribute][] => {
        const attribute = blockAttributeFrom(source);
        return attribute === null ? [] : [[name, attribute]];
      },
    ),
  );
}

function blockTextFrom(value: unknown): BlockText | null {
  if (!isRecord(value) || typeof value.label !== "string") {
    return null;
  }
  return {
    label: value.label,
    description: textOrNull(value.description),
    required: value.required === true,
  };
}

function blockSchemaFrom(name: string, source: unknown): BlockSchema | null {
  if (!isRecord(source)) {
    return null;
  }
  const body: BlockBody =
    source.body === "none" || source.body === "images"
      ? source.body
      : "markdown";
  return {
    label:
      typeof source.label === "string" && source.label !== ""
        ? source.label
        : name,
    description: textOrNull(source.description),
    body,
    placeholder: body === "markdown" ? textOrNull(source.placeholder) : null,
    text: body === "none" ? blockTextFrom(source.text) : null,
    attributes: blockAttributesFrom(source.attributes),
    plugin: textOrNull(source.plugin),
  };
}

export function directiveSchemasFrom(
  value: unknown,
): Record<string, BlockSchema> | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, source]): [string, BlockSchema][] => {
      const schema = blockSchemaFrom(name, source);
      return schema === null ? [] : [[name, schema]];
    }),
  );
}

export function settingDefinitionsFrom(
  value: unknown,
): Record<string, ThemeSettingDefinition> | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(
      ([name, source]): [string, ThemeSettingDefinition][] => {
        const definition = settingDefinitionFrom(source);
        return definition === null ? [] : [[name, definition]];
      },
    ),
  );
}

function settingValueFrom(value: unknown): ThemeSettingValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return colorPairFrom(value) ?? undefined;
}

export function settingValuesFrom(
  value: unknown,
): Record<string, ThemeSettingValue> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(
      ([name, source]): [string, ThemeSettingValue][] => {
        const settingValue = settingValueFrom(source);
        return settingValue === undefined ? [] : [[name, settingValue]];
      },
    ),
  );
}

function headAttributesFrom(value: unknown): Record<string, string | boolean> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "boolean",
    ),
  );
}

export function pluginHeadTagsFrom(value: unknown): PluginHeadTag[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown): PluginHeadTag[] =>
    isRecord(item) && typeof item.tag === "string"
      ? [
          {
            tag: item.tag,
            attributes: headAttributesFrom(item.attributes),
            when: textOrNull(item.when),
            active: item.active === true,
          },
        ]
      : [],
  );
}

export function themePartsFrom(
  value: unknown,
): Record<string, ThemePart> | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, source]): [string, ThemePart][] =>
      isRecord(source) && typeof source.label === "string"
        ? [
            [
              name,
              {
                label: source.label,
                description: textOrNull(source.description),
              },
            ],
          ]
        : [],
    ),
  );
}

function stringListFrom(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function inspectedThemeFrom(value: unknown): InspectedTheme | null {
  if (
    !isRecord(value) ||
    typeof value.dir !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  return {
    name: value.name,
    source: textOrNull(value.source),
    version: textOrNull(value.version),
    dir: value.dir,
    files: stringListFrom(value.files),
    overrides: stringListFrom(value.overrides),
  };
}
