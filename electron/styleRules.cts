import postcss from "postcss";
import type {
  StyledRule,
  StyleEdit,
  StyleEditResult,
  StyleMediaWidths,
  StyleRulesState,
  StyleScope,
  StyleValue,
} from "./ipcContract.cjs";
import { readSiteStylesheet, writeSiteStylesheet } from "./siteStylesheet.cjs";

type Root = postcss.Root;
type Rule = postcss.Rule;
type AtRule = postcss.AtRule;
type ChildNode = postcss.ChildNode;

type BreakpointScope = Exclude<StyleScope, "all">;

type ScopedRule = {
  rule: Rule;
  scope: StyleScope;
};

type SurgeryOutcome =
  | { status: "ok"; text: string }
  | { status: "unparseable"; line: number | null }
  | { status: "rejected" };

const MEDIA_AT_RULE = "media";
const DEFAULT_INDENT = "  ";
const MAX_SELECTOR_LENGTH = 500;
const MAX_VALUE_LENGTH = 500;
const MAX_MEDIA_WIDTH = 100_000;
const breakpointScopes: BreakpointScope[] = ["tablet", "phone"];

export const STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "color",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "width",
  "max-width",
  "height",
  "background-color",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "opacity",
]);

const attributeSelectorPattern =
  /\[\s*([\w-]+)\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*\]/g;

export function normalizedSelector(selector: string): string {
  return selector
    .replaceAll(
      attributeSelectorPattern,
      (_match, name: string, operator: string, ...values: unknown[]) => {
        const value = values.slice(0, 3).find((item) => item !== undefined);
        return `[${name}${operator}"${String(value)}"]`;
      },
    )
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s*([>+~])\s*(?![^[]*\])/g, " $1 ")
    .replaceAll(/\s*,\s*/g, ", ")
    .trim();
}

function mediaQueryFor(maxWidth: number): string {
  return `(max-width: ${String(maxWidth)}px)`;
}

function normalizedMediaParams(params: string): string {
  return params.toLowerCase().replaceAll(/\s+/g, "");
}

function areWidthsValid(widths: StyleMediaWidths): boolean {
  return [widths.tablet, widths.phone].every(
    (width) => Number.isFinite(width) && width > 0 && width < MAX_MEDIA_WIDTH,
  );
}

function queriesFor(widths: StyleMediaWidths): Record<BreakpointScope, string> {
  return {
    tablet: mediaQueryFor(widths.tablet),
    phone: mediaQueryFor(widths.phone),
  };
}

function breakpointScopeOf(
  node: ChildNode,
  queries: Record<BreakpointScope, string>,
): BreakpointScope | null {
  if (node.type !== "atrule" || node.name.toLowerCase() !== MEDIA_AT_RULE) {
    return null;
  }
  const params = normalizedMediaParams(node.params);
  return (
    breakpointScopes.find(
      (scope) => normalizedMediaParams(queries[scope]) === params,
    ) ?? null
  );
}

function scopedRulesIn(
  root: Root,
  queries: Record<BreakpointScope, string>,
): ScopedRule[] {
  return (root.nodes ?? []).flatMap((node): ScopedRule[] => {
    if (node.type === "rule") {
      return [{ rule: node, scope: "all" }];
    }
    const scope = breakpointScopeOf(node, queries);
    if (scope === null || node.type !== "atrule") {
      return [];
    }
    return (node.nodes ?? []).flatMap((child): ScopedRule[] =>
      child.type === "rule" ? [{ rule: child, scope }] : [],
    );
  });
}

function styledRuleFrom({ rule, scope }: ScopedRule): StyledRule {
  return {
    selector: rule.selector,
    key: normalizedSelector(rule.selector),
    scope,
    line: rule.source?.start?.line ?? 1,
    declarations: rule.nodes.flatMap((node) =>
      node.type === "decl"
        ? [
            {
              property: node.prop.toLowerCase(),
              value: node.value,
              isImportant: node.important === true,
            },
          ]
        : [],
    ),
  };
}

function parseStylesheet(
  text: string,
):
  | { status: "ok"; root: Root }
  | { status: "unparseable"; line: number | null } {
  try {
    return { status: "ok", root: postcss.parse(text) };
  } catch (error) {
    if (error instanceof postcss.CssSyntaxError) {
      return { status: "unparseable", line: error.line ?? null };
    }
    throw error;
  }
}

function isSafeSelector(selector: string): boolean {
  const trimmed = selector.trim();
  if (
    trimmed === "" ||
    trimmed.length > MAX_SELECTOR_LENGTH ||
    trimmed.includes("/*")
  ) {
    return false;
  }
  try {
    const root = postcss.parse(`${trimmed}{}`);
    const rule = root.first;
    return (
      root.nodes.length === 1 &&
      rule?.type === "rule" &&
      rule.selector === trimmed
    );
  } catch {
    return false;
  }
}

function isSafeValue({ property, value }: StyleValue): boolean {
  const trimmed = value.trim();
  if (
    !STYLE_PROPERTIES.has(property) ||
    trimmed === "" ||
    trimmed.length > MAX_VALUE_LENGTH ||
    trimmed.includes("/*") ||
    trimmed.includes("!")
  ) {
    return false;
  }
  try {
    const root = postcss.parse(`a{${property}:${trimmed}}`);
    const rule = root.first;
    const declaration = rule?.type === "rule" ? rule.first : undefined;
    return (
      root.nodes.length === 1 &&
      rule?.type === "rule" &&
      rule.nodes.length === 1 &&
      declaration?.type === "decl" &&
      declaration.prop === property &&
      declaration.value === trimmed &&
      !declaration.important
    );
  } catch {
    return false;
  }
}

function isEditSafe(edit: StyleEdit): boolean {
  return (
    isSafeSelector(edit.selector) &&
    edit.set.every(isSafeValue) &&
    edit.remove.every((property) => STYLE_PROPERTIES.has(property))
  );
}

function indentUnitOf(root: Root): string {
  for (const node of root.nodes ?? []) {
    if (node.type !== "rule") {
      continue;
    }
    const declaration = node.nodes.find((child) => child.type === "decl");
    const before = declaration?.raws.before ?? "";
    const indent = before.slice(before.lastIndexOf("\n") + 1);
    if (before.includes("\n") && indent !== "" && indent.trim() === "") {
      return indent;
    }
  }
  return DEFAULT_INDENT;
}

function removeNode(node: ChildNode): void {
  const next = node.next();
  if (next !== undefined && node.parent?.first === node) {
    next.raws.before = node.raws.before ?? "";
  }
  node.remove();
}

function blockBefore(container: Root | AtRule, indent: string): string {
  if ((container.nodes ?? []).length > 0) {
    return `\n\n${indent}`;
  }
  return container.type === "root" ? "" : `\n${indent}`;
}

function insertBeforeNode(anchor: ChildNode, node: ChildNode): void {
  const before = anchor.raws.before ?? "";
  anchor.before(node);
  node.raws.before = before;
  anchor.raws.before = "\n\n";
}

function insertAfterNode(anchor: ChildNode, node: ChildNode): void {
  anchor.after(node);
  node.raws.before = "\n\n";
}

function appendToRoot(root: Root, node: ChildNode): void {
  const wasEmpty = (root.nodes ?? []).length === 0;
  const before = blockBefore(root, "");
  root.append(node);
  node.raws.before = before;
  if (wasEmpty) {
    root.raws.after = "\n";
  }
}

function newRule(selector: string, indent: string): Rule {
  const rule = postcss.rule({ selector });
  rule.raws.between = " ";
  rule.raws.after = `\n${indent}`;
  rule.raws.semicolon = true;
  return rule;
}

function newMediaBlock(query: string): AtRule {
  const media = postcss.atRule({ name: MEDIA_AT_RULE, params: query });
  media.raws.afterName = " ";
  media.raws.between = " ";
  media.raws.after = "\n";
  return media;
}

function blocksFor(
  root: Root,
  queries: Record<BreakpointScope, string>,
  scope: BreakpointScope,
): AtRule[] {
  return (root.nodes ?? []).flatMap((node) =>
    node.type === "atrule" && breakpointScopeOf(node, queries) === scope
      ? [node]
      : [],
  );
}

function firstBreakpointBlock(
  root: Root,
  queries: Record<BreakpointScope, string>,
): ChildNode | undefined {
  return (root.nodes ?? []).find(
    (node) => breakpointScopeOf(node, queries) !== null,
  );
}

function placeTopLevelRule(
  root: Root,
  queries: Record<BreakpointScope, string>,
  rule: Rule,
): void {
  const firstBlock = firstBreakpointBlock(root, queries);
  const nodes = root.nodes ?? [];
  const limit =
    firstBlock === undefined ? nodes.length : nodes.indexOf(firstBlock);
  const anchor = nodes.slice(0, limit).findLast((node) => node.type === "rule");
  if (anchor !== undefined) {
    insertAfterNode(anchor, rule);
    return;
  }
  if (firstBlock !== undefined) {
    insertBeforeNode(firstBlock, rule);
    return;
  }
  appendToRoot(root, rule);
}

function blockForWriting(
  root: Root,
  queries: Record<BreakpointScope, string>,
  scope: BreakpointScope,
): AtRule {
  const existing = blocksFor(root, queries, scope).at(-1);
  if (existing !== undefined) {
    return existing;
  }
  const block = newMediaBlock(queries[scope]);
  const firstPhone = blocksFor(root, queries, "phone")[0];
  if (scope === "tablet" && firstPhone !== undefined) {
    insertBeforeNode(firstPhone, block);
  } else {
    appendToRoot(root, block);
  }
  return block;
}

function ruleForWriting(
  root: Root,
  queries: Record<BreakpointScope, string>,
  matching: ScopedRule[],
  edit: StyleEdit,
  indent: string,
): Rule {
  const existing = matching.at(-1);
  if (existing !== undefined) {
    return existing.rule;
  }
  const selector = edit.selector.trim();
  if (edit.scope === "all") {
    const rule = newRule(selector, "");
    placeTopLevelRule(root, queries, rule);
    return rule;
  }
  const block = blockForWriting(root, queries, edit.scope);
  const rule = newRule(selector, indent);
  const before = blockBefore(block, indent);
  block.append(rule);
  rule.raws.before = before;
  return rule;
}

function declarationRaws(
  rule: Rule,
  indent: string,
): { before: string; between: string } {
  const last = rule.nodes.findLast((node) => node.type === "decl");
  if (last?.type === "decl") {
    return {
      before: last.raws.before ?? `\n${indent}`,
      between: last.raws.between ?? ": ",
    };
  }
  const ruleIndent = rule.parent?.type === "root" ? "" : indent;
  return { before: `\n${ruleIndent}${indent}`, between: ": " };
}

function setDeclaration(
  rule: Rule,
  { property, value }: StyleValue,
  indent: string,
): void {
  const existing = rule.nodes.findLast(
    (node) => node.type === "decl" && node.prop.toLowerCase() === property,
  );
  if (existing?.type === "decl") {
    existing.value = value.trim();
    return;
  }
  const declaration = postcss.decl({ prop: property, value: value.trim() });
  const raws = declarationRaws(rule, indent);
  if (rule.nodes.length === 0) {
    rule.raws.semicolon = true;
    rule.raws.after = rule.parent?.type === "root" ? "\n" : `\n${indent}`;
  }
  rule.append(declaration);
  declaration.raws.before = raws.before;
  declaration.raws.between = raws.between;
}

function removeDeclarations(rule: Rule, properties: string[]): void {
  const wanted = new Set(properties);
  for (const node of rule.nodes.filter(
    (child) => child.type === "decl" && wanted.has(child.prop.toLowerCase()),
  )) {
    removeNode(node);
  }
}

function pruneEmpty(rules: Rule[]): void {
  for (const rule of rules) {
    const parent = rule.parent;
    if (rule.nodes.length > 0 || parent === undefined) {
      continue;
    }
    removeNode(rule);
    if (parent.type === "atrule" && (parent.nodes ?? []).length === 0) {
      removeNode(parent);
    }
  }
}

export function editStylesheetText(
  text: string,
  widths: StyleMediaWidths,
  edit: StyleEdit,
): SurgeryOutcome {
  if (!areWidthsValid(widths) || !isEditSafe(edit)) {
    return { status: "rejected" };
  }
  const parsed = parseStylesheet(text);
  if (parsed.status === "unparseable") {
    return parsed;
  }
  const root = parsed.root;
  const queries = queriesFor(widths);
  const indent = indentUnitOf(root);
  const key = normalizedSelector(edit.selector);
  const matching = scopedRulesIn(root, queries).filter(
    (scoped) =>
      scoped.scope === edit.scope &&
      normalizedSelector(scoped.rule.selector) === key,
  );
  const setProperties = new Set(edit.set.map((value) => value.property));
  const removals = edit.remove.filter(
    (property) => !setProperties.has(property),
  );
  for (const { rule } of matching) {
    removeDeclarations(rule, removals);
  }
  const touched = matching.map((scoped) => scoped.rule);
  if (edit.set.length > 0) {
    const rule = ruleForWriting(root, queries, matching, edit, indent);
    for (const value of edit.set) {
      setDeclaration(rule, value, indent);
    }
    touched.push(rule);
  }
  pruneEmpty(touched);
  return { status: "ok", text: root.toString() };
}

export function resetStylesheetTarget(
  text: string,
  widths: StyleMediaWidths,
  selector: string,
): SurgeryOutcome {
  if (!areWidthsValid(widths) || !isSafeSelector(selector)) {
    return { status: "rejected" };
  }
  const parsed = parseStylesheet(text);
  if (parsed.status === "unparseable") {
    return parsed;
  }
  const key = normalizedSelector(selector);
  const matching = scopedRulesIn(parsed.root, queriesFor(widths))
    .filter((scoped) => normalizedSelector(scoped.rule.selector) === key)
    .map((scoped) => scoped.rule);
  for (const rule of matching) {
    for (const node of rule.nodes.filter((child) => child.type === "decl")) {
      removeNode(node);
    }
  }
  pruneEmpty(matching);
  return { status: "ok", text: parsed.root.toString() };
}

export function styledRulesOf(
  text: string,
  widths: StyleMediaWidths,
): StyleRulesState {
  if (!areWidthsValid(widths)) {
    return { status: "ok", rules: [] };
  }
  const parsed = parseStylesheet(text);
  if (parsed.status === "unparseable") {
    return parsed;
  }
  return {
    status: "ok",
    rules: scopedRulesIn(parsed.root, queriesFor(widths)).map(styledRuleFrom),
  };
}

function savedOutcome(
  sitePath: string,
  widths: StyleMediaWidths,
  outcome: SurgeryOutcome,
): StyleEditResult {
  if (outcome.status !== "ok") {
    return outcome;
  }
  if (outcome.text !== readSiteStylesheet(sitePath)) {
    writeSiteStylesheet(sitePath, outcome.text);
  }
  const state = styledRulesOf(outcome.text, widths);
  return state.status === "ok"
    ? { status: "saved", rules: state.rules }
    : { status: "unparseable", line: state.line };
}

export function readStyledRules(
  sitePath: string,
  widths: StyleMediaWidths,
): StyleRulesState {
  return styledRulesOf(readSiteStylesheet(sitePath), widths);
}

export function editStyledRule(
  sitePath: string,
  widths: StyleMediaWidths,
  edit: StyleEdit,
): StyleEditResult {
  return savedOutcome(
    sitePath,
    widths,
    editStylesheetText(readSiteStylesheet(sitePath), widths, edit),
  );
}

export function resetStyledTarget(
  sitePath: string,
  widths: StyleMediaWidths,
  selector: string,
): StyleEditResult {
  return savedOutcome(
    sitePath,
    widths,
    resetStylesheetTarget(readSiteStylesheet(sitePath), widths, selector),
  );
}
