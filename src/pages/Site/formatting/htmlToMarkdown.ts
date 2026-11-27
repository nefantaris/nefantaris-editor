import TurndownService from "turndown";
import { highlightedCodeBlock, taskListItems } from "turndown-plugin-gfm";

const officeMarkerPattern =
  /docs-internal-guid|urn:schemas-microsoft-com|mso-|class="?Mso/i;
const preformattedStylePattern = /white-space\s*:\s*pre\s*(?:;|$)/i;
const wordListPattern = /mso-list\s*:\s*l\d+\s+level(\d+)/i;
const wordListIdPattern = /mso-list\s*:\s*(l\d+)\s+level\d+/i;
const orderedMarkerPattern = /^(?:\d{1,3}|[a-z]{1,2}|[ivxlcdm]{1,6})[.)]$/i;
const headingSelector = "h1, h2, h3, h4, h5, h6";
const formattingSelector =
  "h1, h2, h3, h4, h5, h6, strong, b, em, i, a[href], ul, ol, blockquote, table, del, s, strike, pre, hr, img";
const textBlockSelector = "p, li, td, th, h1, h2, h3, h4, h5, h6, pre, div";
const strikeElementNames = new Set(["del", "s", "strike"]);
const blockElementNames = new Set([
  "p",
  "div",
  "ul",
  "ol",
  "table",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);
const removableSelector =
  "style, script, meta, link, title, xml, template, noscript, colgroup";
const keptWhenEmptySelector = "img, hr, table, input";
const emptyBlockSelector =
  "p, div, h1, h2, h3, h4, h5, h6, li, blockquote, ul, ol";

function removeComments(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_COMMENT,
  );
  const comments: Comment[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Comment) {
      comments.push(node);
    }
  }
  for (const comment of comments) {
    comment.remove();
  }
}

function unwrap(element: Element): void {
  element.replaceWith(...element.childNodes);
}

function rename(element: Element, tagName: string): Element {
  const replacement = element.ownerDocument.createElement(tagName);
  replacement.append(...element.childNodes);
  element.replaceWith(replacement);
  return replacement;
}

function removeOfficeOnlyElements(root: HTMLElement): void {
  for (const element of root.querySelectorAll("*")) {
    const name = element.localName;
    if (name === "o:p" || name.startsWith("v:")) {
      element.remove();
    } else if (name.includes(":")) {
      unwrap(element);
    }
  }
  for (const element of root.querySelectorAll(removableSelector)) {
    element.remove();
  }
  for (const image of root.querySelectorAll("img")) {
    if (!/^https?:\/\//i.test(image.getAttribute("src") ?? "")) {
      image.remove();
    }
  }
}

function styleOf(element: Element): string {
  return element.getAttribute("style") ?? "";
}

function isBoldWeight(style: string): boolean {
  const weight = /font-weight\s*:\s*([\w-]+)/i.exec(style)?.[1].toLowerCase();
  return (
    weight === "bold" ||
    weight === "bolder" ||
    (weight !== undefined && Number(weight) >= 600)
  );
}

function isNormalWeight(style: string): boolean {
  const weight = /font-weight\s*:\s*([\w-]+)/i.exec(style)?.[1].toLowerCase();
  return weight === "normal" || (weight !== undefined && Number(weight) < 600);
}

function unwrapFalseEmphasis(root: HTMLElement): void {
  for (const element of root.querySelectorAll("b, strong")) {
    if (
      isNormalWeight(styleOf(element)) ||
      element.id.startsWith("docs-internal-guid") ||
      element.closest(headingSelector) !== null
    ) {
      unwrap(element);
    }
  }
  for (const element of root.querySelectorAll("i, em")) {
    if (/font-style\s*:\s*normal/i.test(styleOf(element))) {
      unwrap(element);
    }
  }
}

function semanticTagsFor(element: Element): string[] {
  const style = styleOf(element);
  const isInHeading = element.closest(headingSelector) !== null;
  return [
    ...(isBoldWeight(style) && !isInHeading ? ["strong"] : []),
    ...(/font-style\s*:\s*italic/i.test(style) ? ["em"] : []),
    ...(/text-decoration[\w-]*\s*:[^;]*line-through/i.test(style)
      ? ["del"]
      : []),
  ];
}

function convertStyledSpans(root: HTMLElement): void {
  for (const element of root.querySelectorAll("span, font")) {
    const tags = semanticTagsFor(element);
    if (tags.length === 0) {
      unwrap(element);
      continue;
    }
    const outer = element.ownerDocument.createElement(tags[0]);
    let inner = outer;
    for (const tag of tags.slice(1)) {
      const next = element.ownerDocument.createElement(tag);
      inner.append(next);
      inner = next;
    }
    inner.append(...element.childNodes);
    element.replaceWith(outer);
  }
}

type OpenList = { level: number; list: HTMLElement };

function wordListLevel(element: Element): number | null {
  const match = wordListPattern.exec(styleOf(element));
  return match === null ? null : Number(match[1]);
}

function takeWordListMarker(paragraph: Element): string {
  const marker = [...paragraph.querySelectorAll("span")].find((span) =>
    /mso-list\s*:\s*ignore/i.test(styleOf(span)),
  );
  const text = (marker?.textContent ?? "").replaceAll(/\s/g, "");
  marker?.remove();
  return text;
}

function wordListId(element: Element): string | null {
  return wordListIdPattern.exec(styleOf(element))?.[1].toLowerCase() ?? null;
}

function convertWordListRun(run: Element[]): void {
  const document = run[0].ownerDocument;
  const roots: HTMLElement[] = [];
  const stack: OpenList[] = [];
  for (const paragraph of run) {
    const level = wordListLevel(paragraph) ?? 1;
    const tag = orderedMarkerPattern.test(takeWordListMarker(paragraph))
      ? "ol"
      : "ul";
    while (stack.length > 0 && (stack.at(-1)?.level ?? 0) > level) {
      stack.pop();
    }
    const sameLevel = stack.at(-1);
    if (sameLevel?.level === level && sameLevel.list.localName !== tag) {
      stack.pop();
    }
    let current = stack.at(-1);
    if (current === undefined || current.level < level) {
      const list = document.createElement(tag);
      const parentItem = current?.list.lastElementChild;
      if (parentItem) {
        parentItem.append(list);
      } else if (current) {
        current.list.append(list);
      } else {
        roots.push(list);
      }
      current = { level, list };
      stack.push(current);
    }
    const item = document.createElement("li");
    item.append(...paragraph.childNodes);
    current.list.append(item);
  }
  run[0].before(...roots);
  for (const paragraph of run) {
    paragraph.remove();
  }
}

function convertWordLists(root: HTMLElement): void {
  const handled = new Set<Element>();
  for (const paragraph of root.querySelectorAll("p")) {
    const listId = wordListId(paragraph);
    if (handled.has(paragraph) || listId === null) {
      continue;
    }
    const run: Element[] = [];
    for (
      let current: Element | null = paragraph;
      current !== null && wordListId(current) === listId;
      current = current.nextElementSibling
    ) {
      run.push(current);
      handled.add(current);
    }
    convertWordListRun(run);
  }
}

function nestStrayLists(root: HTMLElement): void {
  for (const list of root.querySelectorAll(
    "ul > ul, ul > ol, ol > ul, ol > ol",
  )) {
    const previous = list.previousElementSibling;
    if (previous?.localName === "li") {
      previous.append(list);
    }
  }
}

function convertChecklistItems(root: HTMLElement): void {
  for (const item of root.querySelectorAll('li[role="checkbox"]')) {
    const box = item.ownerDocument.createElement("input");
    box.type = "checkbox";
    box.checked = item.getAttribute("aria-checked") === "true";
    item.prepend(box);
  }
}

function unwrapListParagraphs(root: HTMLElement): void {
  for (const item of root.querySelectorAll("li")) {
    const paragraphs = [...item.children].filter(
      (child) => child.localName === "p",
    );
    if (paragraphs.length === 1) {
      unwrap(paragraphs[0]);
    }
  }
}

function cleanLinks(root: HTMLElement): void {
  for (const link of root.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (href === "" || /^\s*javascript:/i.test(href) || href.startsWith("#")) {
      unwrap(link);
      continue;
    }
    if (href.startsWith("https://www.google.com/url?")) {
      const target = new URL(href).searchParams.get("q");
      if (target !== null) {
        link.setAttribute("href", target);
      }
    }
  }
}

function demoteTopHeadings(root: HTMLElement): void {
  for (const heading of root.querySelectorAll("h1")) {
    rename(heading, "h2");
  }
}

function replaceNonBreakingSpaces(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.nodeValue?.includes(" ")) {
      node.nodeValue = node.nodeValue.replaceAll(" ", " ");
    }
  }
}

function isLastInBlock(lineBreak: Element): boolean {
  for (
    let next = lineBreak.nextSibling;
    next !== null;
    next = next.nextSibling
  ) {
    if (next.nodeType !== Node.TEXT_NODE || next.textContent?.trim() !== "") {
      return false;
    }
  }
  return lineBreak.parentElement?.matches(textBlockSelector) ?? false;
}

function isBetweenBlocks(lineBreak: Element): boolean {
  const parent = lineBreak.parentElement;
  return (
    parent === null ||
    parent.localName === "body" ||
    [...parent.children].some((child) => blockElementNames.has(child.localName))
  );
}

function removeStrayLineBreaks(root: HTMLElement): void {
  for (const lineBreak of root.querySelectorAll("br")) {
    if (isBetweenBlocks(lineBreak) || isLastInBlock(lineBreak)) {
      lineBreak.remove();
    }
  }
}

function removeEmptyBlocks(root: HTMLElement): void {
  for (const block of [
    ...root.querySelectorAll(emptyBlockSelector),
  ].toReversed()) {
    const text = (block.textContent ?? "").replaceAll(/\s/g, "");
    if (text === "" && block.querySelector(keptWhenEmptySelector) === null) {
      block.remove();
    }
  }
}

function cleanUp(root: HTMLElement): void {
  removeComments(root);
  removeOfficeOnlyElements(root);
  convertWordLists(root);
  unwrapFalseEmphasis(root);
  convertStyledSpans(root);
  nestStrayLists(root);
  convertChecklistItems(root);
  unwrapListParagraphs(root);
  cleanLinks(root);
  demoteTopHeadings(root);
  replaceNonBreakingSpaces(root);
  removeStrayLineBreaks(root);
  removeEmptyBlocks(root);
}

function isPreformatted(root: HTMLElement): boolean {
  return [root, ...root.querySelectorAll("*")].some((element) =>
    preformattedStylePattern.test(styleOf(element)),
  );
}

function columnCount(table: HTMLTableElement): number {
  return Math.max(
    1,
    ...[...table.rows].map((row) =>
      [...row.cells].reduce((total, cell) => total + cell.colSpan, 0),
    ),
  );
}

function rowCellCount(row: HTMLTableRowElement): number {
  return [...row.cells].reduce((total, cell) => total + cell.colSpan, 0);
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  service.use([highlightedCodeBlock, taskListItems]);
  service.addRule("strikethrough", {
    filter: (node) => strikeElementNames.has(node.localName),
    replacement: (content) =>
      content.trim() === "" ? content : `~~${content}~~`,
  });
  service.addRule("listItem", {
    filter: "li",
    replacement: (content, node) => {
      const parent = node.parentElement;
      const index = parent ? [...parent.children].indexOf(node) : 0;
      const start = Number(parent?.getAttribute("start") ?? "1") || 1;
      const prefix = parent?.localName === "ol" ? `${start + index}. ` : "- ";
      const isParagraph = content.endsWith("\n");
      const body =
        content.replaceAll(/^\n+|\n+$/g, "") + (isParagraph ? "\n" : "");
      return `${prefix}${body.replaceAll("\n", `\n${" ".repeat(prefix.length)}`)}${node.nextSibling ? "\n" : ""}`;
    },
  });
  service.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      const text = content
        .replaceAll(/\s*\n+\s*/g, " ")
        .trim()
        .replaceAll("|", String.raw`\|`);
      const span = node instanceof HTMLTableCellElement ? node.colSpan : 1;
      return ` ${text} |${" |".repeat(Math.max(0, span - 1))}`;
    },
  });
  service.addRule("tableRow", {
    filter: "tr",
    replacement: (content, node) => {
      const table = node.closest("table");
      if (!(node instanceof HTMLTableRowElement) || table === null) {
        return content;
      }
      const columns = columnCount(table);
      const padding = " |".repeat(Math.max(0, columns - rowCellCount(node)));
      const delimiter =
        table.rows[0] === node ? `\n|${" --- |".repeat(columns)}` : "";
      return `\n|${content}${padding}${delimiter}`;
    },
  });
  service.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: (content) => content,
  });
  service.addRule("table", {
    filter: "table",
    replacement: (content) =>
      `\n\n${content.replaceAll(/\n{2,}/g, "\n").trim()}\n\n`,
  });
  return service;
}

let turndownService: TurndownService | null = null;

export function htmlToMarkdown(html: string): string | null {
  const isOffice = officeMarkerPattern.test(html);
  const root = new DOMParser().parseFromString(html, "text/html").body;
  if (!isOffice && isPreformatted(root)) {
    return null;
  }
  cleanUp(root);
  if (!isOffice && root.querySelector(formattingSelector) === null) {
    return null;
  }
  turndownService ??= createTurndownService();
  const markdown = turndownService
    .turndown(root)
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
  return markdown === "" ? null : markdown;
}
