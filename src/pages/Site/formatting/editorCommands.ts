import type { SlashItem } from "./slashMenu.ts";

export type EditorCommand =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "heading4"
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "link"
  | "bullet"
  | "numbered"
  | "task"
  | "quote"
  | "codeBlock"
  | "divider"
  | "table"
  | "image"
  | "gallery"
  | "insertBlock";

const commandNames: Record<EditorCommand, true> = {
  paragraph: true,
  heading2: true,
  heading3: true,
  heading4: true,
  bold: true,
  italic: true,
  strikethrough: true,
  code: true,
  link: true,
  bullet: true,
  numbered: true,
  task: true,
  quote: true,
  codeBlock: true,
  divider: true,
  table: true,
  image: true,
  gallery: true,
  insertBlock: true,
};

export const BLOCK_SLASH_PREFIX = "block:";

export function isEditorCommand(value: string): value is EditorCommand {
  return Object.keys(commandNames).includes(value);
}

export const builtInSlashItems: SlashItem[] = [
  {
    id: "heading2",
    label: "Heading 2",
    description: "A section heading",
    keywords: "title heading h2 large",
    section: "text",
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "A smaller heading inside a section",
    keywords: "subheading heading h3 medium",
    section: "text",
  },
  {
    id: "heading4",
    label: "Heading 4",
    description: "The smallest heading",
    keywords: "heading h4 small",
    section: "text",
  },
  {
    id: "bullet",
    label: "Bulleted list",
    description: "A list with bullet points",
    keywords: "unordered points dots",
    section: "text",
  },
  {
    id: "numbered",
    label: "Numbered list",
    description: "A list with numbers",
    keywords: "ordered steps",
    section: "text",
  },
  {
    id: "task",
    label: "Checklist",
    description: "A list with tick boxes",
    keywords: "task todo checkbox tick",
    section: "text",
  },
  {
    id: "quote",
    label: "Quote",
    description: "Words quoted from someone else",
    keywords: "blockquote citation",
    section: "text",
  },
  {
    id: "codeBlock",
    label: "Code block",
    description: "Code shown exactly as it is written",
    keywords: "program snippet monospace",
    section: "insert",
  },
  {
    id: "divider",
    label: "Divider",
    description: "A line across the page",
    keywords: "line rule separator break",
    section: "insert",
  },
  {
    id: "table",
    label: "Table",
    description: "Rows and columns",
    keywords: "grid columns rows",
    section: "insert",
  },
  {
    id: "image",
    label: "Image",
    description: "A picture from your site",
    keywords: "picture photo",
    section: "insert",
  },
  {
    id: "link",
    label: "Link",
    description: "Words that go to another page or address",
    keywords: "url address hyperlink",
    section: "insert",
  },
];
