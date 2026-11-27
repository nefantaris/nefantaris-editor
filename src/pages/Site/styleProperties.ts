import type { BridgeStyles } from "./previewBridge.ts";

export type StyleChoice = {
  value: string;
  label: string;
};

export type LengthUnit = "px" | "rem" | "em" | "%" | "";

export type LengthSpec = {
  property: string;
  label: string;
  units: LengthUnit[];
  keywords: string[];
};

export type ChoiceSpec = {
  property: string;
  label: string;
  choices: StyleChoice[];
};

export type BoxSide = "top" | "right" | "bottom" | "left";

export const boxSides: BoxSide[] = ["top", "right", "bottom", "left"];

export const sideLabels: Record<BoxSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

export const fontSize: LengthSpec = {
  property: "font-size",
  label: "Font size",
  units: ["px", "rem", "em", "%"],
  keywords: [],
};

export const lineHeight: LengthSpec = {
  property: "line-height",
  label: "Line height",
  units: ["", "px", "rem", "em", "%"],
  keywords: ["normal"],
};

export const letterSpacing: LengthSpec = {
  property: "letter-spacing",
  label: "Letter spacing",
  units: ["em", "px", "rem"],
  keywords: ["normal"],
};

export const fontWeight: ChoiceSpec = {
  property: "font-weight",
  label: "Font weight",
  choices: [
    { value: "100", label: "Thin" },
    { value: "200", label: "Extra light" },
    { value: "300", label: "Light" },
    { value: "400", label: "Regular" },
    { value: "500", label: "Medium" },
    { value: "600", label: "Semibold" },
    { value: "700", label: "Bold" },
    { value: "800", label: "Extra bold" },
    { value: "900", label: "Black" },
  ],
};

export const textTransform: ChoiceSpec = {
  property: "text-transform",
  label: "Case",
  choices: [
    { value: "none", label: "As written" },
    { value: "uppercase", label: "UPPERCASE" },
    { value: "lowercase", label: "lowercase" },
    { value: "capitalize", label: "Capitalized Words" },
  ],
};

export const textAlignChoices: StyleChoice[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
];

export const sizeFields: LengthSpec[] = [
  {
    property: "width",
    label: "Width",
    units: ["px", "rem", "em", "%"],
    keywords: ["auto"],
  },
  {
    property: "max-width",
    label: "Max width",
    units: ["px", "rem", "em", "%"],
    keywords: ["none"],
  },
  {
    property: "height",
    label: "Height",
    units: ["px", "rem", "em", "%"],
    keywords: ["auto"],
  },
];

export const borderWidth: LengthSpec = {
  property: "border-width",
  label: "Border width",
  units: ["px", "rem", "em"],
  keywords: [],
};

export const borderStyle: ChoiceSpec = {
  property: "border-style",
  label: "Border style",
  choices: [
    { value: "none", label: "None" },
    { value: "solid", label: "Solid" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" },
    { value: "double", label: "Double" },
  ],
};

export const borderRadius: LengthSpec = {
  property: "border-radius",
  label: "Corner radius",
  units: ["px", "rem", "em", "%"],
  keywords: [],
};

export const boxLengthUnits: LengthUnit[] = ["px", "rem", "em", "%"];

export const propertyLabels: Record<string, string> = {
  "font-family": "Font",
  "font-size": "Font size",
  "font-weight": "Font weight",
  "line-height": "Line height",
  "letter-spacing": "Letter spacing",
  "text-transform": "Case",
  "text-align": "Alignment",
  color: "Text colour",
  ...Object.fromEntries(
    boxSides.flatMap((side) => [
      [`margin-${side}`, `Margin ${side}`],
      [`padding-${side}`, `Padding ${side}`],
    ]),
  ),
  width: "Width",
  "max-width": "Max width",
  height: "Height",
  "background-color": "Background colour",
  "border-width": "Border width",
  "border-style": "Border style",
  "border-color": "Border colour",
  "border-radius": "Corner radius",
  opacity: "Opacity",
};

const shorthandParts: Record<string, string[]> = {
  "border-width": boxSides.map((side) => `border-${side}-width`),
  "border-style": boxSides.map((side) => `border-${side}-style`),
  "border-color": boxSides.map((side) => `border-${side}-color`),
  "border-radius": [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ],
};

function shorthandOf(values: string[]): string {
  const [top, right, bottom, left] = values;
  if (values.every((value) => value === top)) {
    return top;
  }
  if (top === bottom && right === left) {
    return `${top} ${right}`;
  }
  return right === left
    ? `${top} ${right} ${bottom}`
    : `${top} ${right} ${bottom} ${left}`;
}

export function computedValueOf(
  property: string,
  styles: BridgeStyles | null,
): string {
  if (styles === null) {
    return "";
  }
  const longhands = shorthandParts[property];
  if (longhands === undefined) {
    return styles[property] ?? "";
  }
  const values = longhands.map((longhand) => styles[longhand] ?? "");
  return values.includes("") ? "" : shorthandOf(values);
}

export function propertyLabel(property: string): string {
  return propertyLabels[property] ?? property;
}
