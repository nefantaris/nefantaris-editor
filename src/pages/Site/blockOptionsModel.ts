import type {
  BlockAttribute,
  BlockSchema,
  BlockText,
  BlockTextAttribute,
} from "../../../electron/ipcContract.cts";
import { isRouteOrUrl, isSitePathOrHttpsUrl } from "./addressRules.ts";
import { attributeBlock, attributeSource, labelSource } from "./blockSyntax.ts";

export type BlockFieldValue = string | boolean;

export type BlockFormValues = Record<string, BlockFieldValue>;

export type WrittenBlockOptions = {
  values: BlockFormValues;
  writtenNames: Set<string>;
  text: string;
};

export type PairedAlt = {
  name: string;
  attribute: BlockTextAttribute;
};

export const REQUIRED_MESSAGE = "This is required.";

const LINK_MESSAGE =
  "Start with / for a page on this site, or https:// for another website.";

const IMAGE_MESSAGE =
  "Choose one of your images, or use an address that starts with https://.";

function defaultFieldValue(attribute: BlockAttribute): BlockFieldValue {
  return attribute.type === "boolean"
    ? (attribute.default ?? false)
    : (attribute.default ?? "");
}

function attributeEntries(schema: BlockSchema): [string, BlockAttribute][] {
  return Object.entries(schema.attributes);
}

export function examplePlaceholder(example: string | null): string | undefined {
  return example === null ? undefined : `For example: ${example}`;
}

export function leafTextOf(schema: BlockSchema): BlockText | null {
  return schema.body === "none" ? schema.text : null;
}

export function hasBlockOptions(schema: BlockSchema | undefined): boolean {
  return (
    schema !== undefined &&
    (attributeEntries(schema).length > 0 || leafTextOf(schema) !== null)
  );
}

export function pairedAltOf(
  schema: BlockSchema,
  attribute: BlockAttribute,
): PairedAlt | null {
  if (
    attribute.type !== "image" ||
    attribute.alt === null ||
    !Object.hasOwn(schema.attributes, attribute.alt)
  ) {
    return null;
  }
  const altAttribute = schema.attributes[attribute.alt];
  return altAttribute.type === "text"
    ? { name: attribute.alt, attribute: altAttribute }
    : null;
}

export function pairedAltNames(schema: BlockSchema): Set<string> {
  return new Set(
    attributeEntries(schema).flatMap(([, attribute]) => {
      const paired = pairedAltOf(schema, attribute);
      return paired === null ? [] : [paired.name];
    }),
  );
}

export function leafTextProblem(
  schema: BlockSchema,
  text: string,
): string | null {
  return leafTextOf(schema)?.required === true && text.trim() === ""
    ? REQUIRED_MESSAGE
    : null;
}

export function labelEdit(
  schema: BlockSchema,
  text: string,
  original: WrittenBlockOptions | null,
): string | null | undefined {
  if (
    leafTextOf(schema) === null ||
    (original !== null && original.text === text)
  ) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed === "" ? null : labelSource(trimmed);
}

export function initialBlockValues(schema: BlockSchema): BlockFormValues {
  return Object.fromEntries(
    attributeEntries(schema).map(([name, attribute]) => [
      name,
      defaultFieldValue(attribute),
    ]),
  );
}

export function writtenBlockOptions(
  schema: BlockSchema,
  written: Record<string, string>,
  label: string | null,
): WrittenBlockOptions {
  const values = Object.fromEntries(
    attributeEntries(schema).map(
      ([name, attribute]): [string, BlockFieldValue] => {
        if (!Object.hasOwn(written, name)) {
          return [name, defaultFieldValue(attribute)];
        }
        const value = written[name];
        return [name, attribute.type === "boolean" ? value !== "false" : value];
      },
    ),
  );
  return {
    values,
    writtenNames: new Set(
      Object.keys(written).filter((name) =>
        Object.hasOwn(schema.attributes, name),
      ),
    ),
    text: label ?? "",
  };
}

function fieldText(
  attribute: BlockAttribute,
  value: BlockFieldValue | undefined,
): string {
  const text = typeof value === "string" ? value : "";
  return attribute.type === "url" || attribute.type === "image"
    ? text.trim()
    : text;
}

export function attributeEntry(
  name: string,
  attribute: BlockAttribute,
  value: BlockFieldValue | undefined,
): string | null {
  if (attribute.type === "boolean") {
    const isOn = value === true;
    if (!attribute.required && isOn === (attribute.default ?? false)) {
      return null;
    }
    return attributeSource(name, isOn ? true : "false");
  }
  const text = fieldText(attribute, value);
  const isOmittable = text.trim() === "" || text === attribute.default;
  return !attribute.required && isOmittable
    ? null
    : attributeSource(name, text);
}

function isUnchanged(
  name: string,
  attribute: BlockAttribute,
  values: BlockFormValues,
  original: WrittenBlockOptions | null,
): boolean {
  if (original === null || original.values[name] !== values[name]) {
    return false;
  }
  return original.writtenNames.has(name) || !attribute.required;
}

function fieldProblem(
  attribute: BlockAttribute,
  value: BlockFieldValue | undefined,
  isChanged: boolean,
): string | null {
  if (attribute.type === "boolean") {
    return null;
  }
  const text = fieldText(attribute, value);
  if (text.trim() === "") {
    return attribute.required ? REQUIRED_MESSAGE : null;
  }
  if (!isChanged) {
    return null;
  }
  if (attribute.type === "url" && !isRouteOrUrl(text)) {
    return LINK_MESSAGE;
  }
  if (attribute.type === "image" && !isSitePathOrHttpsUrl(text)) {
    return IMAGE_MESSAGE;
  }
  return null;
}

export function blockFieldProblems(
  schema: BlockSchema,
  values: BlockFormValues,
  original: WrittenBlockOptions | null,
): Record<string, string> {
  return Object.fromEntries(
    attributeEntries(schema).flatMap(
      ([name, attribute]): [string, string][] => {
        const problem = fieldProblem(
          attribute,
          values[name],
          original === null || original.values[name] !== values[name],
        );
        return problem === null ? [] : [[name, problem]];
      },
    ),
  );
}

export function attributeReplacements(
  schema: BlockSchema,
  values: BlockFormValues,
  original: WrittenBlockOptions | null,
): Map<string, string | null> {
  return new Map(
    attributeEntries(schema).flatMap(
      ([name, attribute]): [string, string | null][] =>
        isUnchanged(name, attribute, values, original)
          ? []
          : [[name, attributeEntry(name, attribute, values[name])]],
    ),
  );
}

export function insertedAttributes(
  schema: BlockSchema,
  values: BlockFormValues,
): string {
  return attributeBlock(
    [...attributeReplacements(schema, values, null).values()].filter(
      (entry): entry is string => entry !== null,
    ),
  );
}
