import type { ThemePart } from "../../../electron/ipcContract.cts";

export type StyleTarget = {
  selector: string;
  label: string;
};

export type StyleSelection = {
  target: StyleTarget;
  choices: string[] | null;
  chain: string[] | null;
};

type TagWords = {
  one: string;
  many: string;
};

type Parts = Record<string, ThemePart>;

const CONTENT_PART = "content";
const BUTTONS_PART = "buttons";
const BUTTON_PART = "button";

const headingWords = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((level) => [
    `h${String(level)}`,
    { one: `Heading ${String(level)}`, many: `Heading ${String(level)}s` },
  ]),
);

const tagWords: Record<string, TagWords> = {
  ...headingWords,
  p: { one: "Paragraph", many: "Paragraphs" },
  a: { one: "Link", many: "Links" },
  button: { one: "Button", many: "Buttons" },
  ul: { one: "Bulleted list", many: "Bulleted lists" },
  ol: { one: "Numbered list", many: "Numbered lists" },
  li: { one: "List item", many: "List items" },
  blockquote: { one: "Quote", many: "Quotes" },
  code: { one: "Piece of code", many: "Pieces of code" },
  pre: { one: "Code block", many: "Code blocks" },
  table: { one: "Table", many: "Tables" },
  thead: { one: "Table head", many: "Table heads" },
  tbody: { one: "Table body", many: "Table bodies" },
  tr: { one: "Table row", many: "Table rows" },
  th: { one: "Table heading cell", many: "Table heading cells" },
  td: { one: "Table cell", many: "Table cells" },
  img: { one: "Image", many: "Images" },
  picture: { one: "Picture", many: "Pictures" },
  figure: { one: "Figure", many: "Figures" },
  figcaption: { one: "Caption", many: "Captions" },
  section: { one: "Section", many: "Sections" },
  div: { one: "Box", many: "Boxes" },
  span: { one: "Stretch of text", many: "Stretches of text" },
  strong: { one: "Bold text", many: "Bold text" },
  b: { one: "Bold text", many: "Bold text" },
  em: { one: "Italic text", many: "Italic text" },
  i: { one: "Italic text", many: "Italic text" },
  small: { one: "Small text", many: "Small text" },
  mark: { one: "Highlight", many: "Highlights" },
  nav: { one: "Menu", many: "Menus" },
  header: { one: "Header area", many: "Header areas" },
  footer: { one: "Footer area", many: "Footer areas" },
  main: { one: "Main area", many: "Main areas" },
  article: { one: "Article", many: "Articles" },
  aside: { one: "Side panel", many: "Side panels" },
  hr: { one: "Divider", many: "Dividers" },
  time: { one: "Date", many: "Dates" },
  svg: { one: "Icon", many: "Icons" },
  form: { one: "Form", many: "Forms" },
  label: { one: "Field label", many: "Field labels" },
  input: { one: "Field", many: "Fields" },
  textarea: { one: "Text box", many: "Text boxes" },
  select: { one: "Dropdown", many: "Dropdowns" },
  video: { one: "Video", many: "Videos" },
  iframe: { one: "Embed", many: "Embeds" },
  dl: { one: "Definition list", many: "Definition lists" },
  dt: { one: "Term", many: "Terms" },
  dd: { one: "Definition", many: "Definitions" },
  details: { one: "Disclosure", many: "Disclosures" },
  summary: { one: "Disclosure title", many: "Disclosure titles" },
};

const ownPartPattern = /^\[data-part="([a-z][a-z0-9-]*)"\]$/;
const tagInPartPattern = /^\[data-part="([a-z][a-z0-9-]*)"\] ([a-z][a-z0-9]*)$/;
const bareTagPattern = /^[a-z][a-z0-9]*$/;

export function partSelector(part: string): string {
  return `[data-part="${part}"]`;
}

function wordsFor(tag: string): TagWords {
  return tagWords[tag] ?? { one: `${tag} element`, many: `${tag} elements` };
}

function partLabel(part: string, parts: Parts): string {
  return parts[part]?.label ?? part;
}

export function elementTypeTargets(parts: Parts): StyleTarget[] {
  const scope = Object.hasOwn(parts, CONTENT_PART)
    ? `${partSelector(CONTENT_PART)} `
    : "";
  const buttonSelectors = [
    `${scope}button`,
    ...(Object.hasOwn(parts, BUTTONS_PART)
      ? [`${partSelector(BUTTONS_PART)} a`]
      : []),
    ...(Object.hasOwn(parts, BUTTON_PART) ? [partSelector(BUTTON_PART)] : []),
  ];
  return [
    { label: "Body text", selector: `${scope}p` },
    ...[1, 2, 3, 4].map((level) => ({
      label: `Heading ${String(level)}`,
      selector: `${scope}h${String(level)}`,
    })),
    { label: "Links", selector: `${scope}a` },
    { label: "Buttons", selector: buttonSelectors.join(", ") },
    { label: "Lists", selector: `${scope}ul, ${scope}ol` },
    { label: "Quotes", selector: `${scope}blockquote` },
    { label: "Code blocks", selector: `${scope}pre` },
    { label: "Code in a sentence", selector: `${scope}:not(pre) > code` },
    { label: "Tables", selector: `${scope}table` },
    { label: "Images", selector: `${scope}img` },
  ];
}

export function partTargets(parts: Parts): StyleTarget[] {
  return Object.entries(parts).map(([name, part]) => ({
    label: part.label,
    selector: partSelector(name),
  }));
}

export function describeSelector(
  selector: string,
  parts: Parts,
): string | null {
  const ownPart = ownPartPattern.exec(selector);
  if (ownPart !== null) {
    return `The whole ${partLabel(ownPart[1], parts)}`;
  }
  const tagInPart = tagInPartPattern.exec(selector);
  if (tagInPart !== null) {
    const words = wordsFor(tagInPart[2]);
    return tagInPart[1] === CONTENT_PART
      ? `Every ${words.one} in page content`
      : `${words.many} in the ${partLabel(tagInPart[1], parts)}`;
  }
  if (bareTagPattern.test(selector)) {
    return `Every ${wordsFor(selector).one} on the site`;
  }
  return (
    elementTypeTargets(parts).find((target) => target.selector === selector)
      ?.label ?? null
  );
}

export function targetFor(selector: string, parts: Parts): StyleTarget {
  return {
    selector,
    label: describeSelector(selector, parts) ?? "Your own selector",
  };
}
