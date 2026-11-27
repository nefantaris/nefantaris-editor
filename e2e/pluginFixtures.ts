import { fakeDirectiveSchemas } from "./themeFixtures.ts";

export const FORMS = "nefantaris-plugin-forms";
export const GREETER = "nefantaris-plugin-greeter";
export const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

const choice = (value: string, label: string) => ({ value, label, css: null });

export const formsSettings = {
  turnstileSiteKey: {
    type: "text",
    label: "Turnstile site key",
    description: "Turns on Cloudflare Turnstile for every form.",
    group: null,
    multiline: false,
    default: "",
  },
  tone: {
    type: "select",
    label: "Tone",
    description: null,
    group: null,
    css: null,
    options: [choice("warm", "Warm"), choice("brisk", "Brisk")],
    default: "warm",
  },
  showLabels: {
    type: "boolean",
    label: "Show field labels",
    description: null,
    group: null,
    default: true,
  },
  accent: {
    type: "color",
    label: "Accent colour",
    description: null,
    group: null,
    css: null,
    default: { light: "#1d4ed8", dark: "#1d4ed8" },
  },
  badge: {
    type: "image",
    label: "Badge",
    description: null,
    group: null,
    default: null,
  },
};

export const formsPluginDetails = {
  [FORMS]: {
    blocks: ["contact-form"],
    settings: formsSettings,
    head: [
      {
        tag: "script",
        attributes: { src: TURNSTILE_SCRIPT, async: true, defer: true },
        when: "turnstileSiteKey",
      },
    ],
    functions: ["/api/forms/submit"],
  },
};

export const pluginBlockSchemas = {
  badge: fakeDirectiveSchemas.badge,
  gallery: fakeDirectiveSchemas.gallery,
  "contact-form": {
    label: "Contact form",
    description: "A form visitors can send you a message with.",
    body: "none",
    placeholder: null,
    text: null,
    attributes: {
      subject: {
        type: "text",
        label: "Notification subject",
        description: null,
        required: false,
        multiline: false,
        default: "New message from your website",
      },
    },
    plugin: FORMS,
  },
  greeter: {
    label: "Greeter",
    description: "Greets someone by name.",
    body: "none",
    placeholder: null,
    text: null,
    attributes: {
      to: {
        type: "text",
        label: "Who",
        description: null,
        required: true,
        multiline: false,
        default: null,
      },
      size: {
        type: "select",
        label: "Size",
        description: null,
        required: false,
        options: [
          { value: "small", label: "Small" },
          { value: "large", label: "Large" },
        ],
        default: "small",
      },
    },
    plugin: GREETER,
  },
};
