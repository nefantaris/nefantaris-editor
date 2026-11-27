const choice = (value: string, label: string) => ({ value, label });

export const fakeThemeSettings = {
  inkColor: {
    type: "color",
    label: "Text colour",
    description: null,
    group: "Colours",
    css: "--color-ink",
    default: { light: "#171717", dark: "#171717" },
  },
  linkColor: {
    type: "color",
    label: "Link colour",
    description: null,
    group: "Colours",
    css: "--color-link",
    default: { light: "#1d4ed8", dark: "#93c5fd" },
  },
  font: {
    type: "select",
    label: "Font",
    description: null,
    group: "Typography",
    css: "--font-sans",
    options: [
      {
        ...choice("system", "System"),
        css: "ui-sans-serif, system-ui, sans-serif",
      },
      { ...choice("serif", "Serif"), css: 'Georgia, "Times New Roman", serif' },
    ],
    default: "system",
  },
  width: {
    type: "select",
    label: "Page width",
    description: null,
    group: "Layout",
    css: null,
    options: [
      { ...choice("narrow", "Narrow"), css: null },
      { ...choice("wide", "Wide"), css: null },
    ],
    default: "narrow",
  },
  showRouteList: {
    type: "boolean",
    label: "List every page in the footer",
    description: null,
    group: "Layout",
    default: true,
  },
  tagline: {
    type: "text",
    label: "Tagline",
    description: "A line under the site name.",
    group: null,
    multiline: false,
    default: "",
  },
  logo: {
    type: "image",
    label: "Logo",
    description: null,
    group: null,
    default: null,
  },
};

export const columnsPlaceholder =
  ':::column{heading="Left"}\nThe left column.\n:::\n\n:::column{heading="Right"}\nThe right column.\n:::';

export const fakeDirectiveSchemas = {
  gallery: {
    label: "gallery",
    description: null,
    body: "markdown",
    placeholder: null,
    attributes: {},
  },
  columns: {
    label: "Columns",
    description: "Blocks of content side by side.",
    body: "markdown",
    placeholder: columnsPlaceholder,
    attributes: {
      gap: {
        type: "select",
        label: "Gap",
        description: null,
        required: false,
        options: [choice("narrow", "Narrow"), choice("wide", "Wide")],
        default: "narrow",
      },
    },
  },
  column: {
    label: "Column",
    description: null,
    body: "markdown",
    placeholder: null,
    attributes: {
      heading: {
        type: "text",
        label: "Heading",
        description: null,
        required: true,
        multiline: false,
        default: null,
      },
    },
  },
  badge: {
    label: "Badge",
    description: "A short highlighted link.",
    body: "none",
    placeholder: null,
    attributes: {
      href: {
        type: "url",
        label: "Link",
        description: null,
        required: true,
        default: null,
      },
      caption: {
        type: "text",
        label: "Caption",
        description: null,
        required: false,
        multiline: false,
        default: null,
      },
      icon: {
        type: "image",
        label: "Icon",
        description: null,
        required: false,
        default: null,
      },
      tone: {
        type: "select",
        label: "Tone",
        description: null,
        required: false,
        options: [choice("calm", "Calm"), choice("loud", "Loud")],
        default: "calm",
      },
      highlighted: {
        type: "boolean",
        label: "Highlighted",
        description: null,
        required: false,
        default: false,
      },
    },
  },
};

export const fakeThemeEnv: Record<string, string> = {
  FAKE_CORE_SETTINGS: JSON.stringify(fakeThemeSettings),
  FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify(fakeDirectiveSchemas),
  FAKE_CORE_THEME_MODES: '["light","dark"]',
};
