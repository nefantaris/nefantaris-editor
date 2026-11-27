import type { PropsWithChildren } from "react";
import { ChevronRightIcon } from "../../components/Icons.tsx";
import type { BridgeStyles } from "./previewBridge.ts";
import StyleAlignField from "./StyleAlignField.tsx";
import StyleChoiceField from "./StyleChoiceField.tsx";
import StyleColorField from "./StyleColorField.tsx";
import type { ContrastCheck, SemanticSwatch } from "./styleColors.ts";
import StyleFontField from "./StyleFontField.tsx";
import StyleLengthField from "./StyleLengthField.tsx";
import StyleOpacityField from "./StyleOpacityField.tsx";
import {
  borderRadius,
  borderStyle,
  borderWidth,
  boxSides,
  computedValueOf,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  sizeFields,
  textTransform,
  type ChoiceSpec,
  type LengthSpec,
} from "./styleProperties.ts";
import StyleSpacingBox from "./StyleSpacingBox.tsx";
import type { FontStack, StyleFieldStatus } from "./styleValues.ts";

type StylePropertyGroupsProps = {
  declared: Map<string, string>;
  computed: BridgeStyles | null;
  statusOf: (property: string) => StyleFieldStatus;
  swatches: SemanticSwatch[];
  themeFonts: FontStack[];
  contrast: ContrastCheck | null;
  onChange: (property: string, value: string | null) => void;
};

type StyleGroupProps = PropsWithChildren<{
  title: string;
  properties: string[];
  declared: Map<string, string>;
}>;

const typographyProperties = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "color",
];
const spacingProperties = ["margin", "padding"].flatMap((kind) =>
  boxSides.map((side) => `${kind}-${side}`),
);
const borderProperties = [
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
];

const StyleGroup = ({
  title,
  properties,
  declared,
  children,
}: StyleGroupProps) => {
  const setCount = properties.filter((property) =>
    declared.has(property),
  ).length;
  return (
    <details open className="border-line group border-t pt-3">
      <summary className="text-ink flex cursor-pointer items-center gap-2 text-sm font-medium">
        <ChevronRightIcon className="text-ink-muted transition-transform duration-100 group-open:rotate-90" />
        <h3>{title}</h3>
        {setCount > 0 && (
          <span className="text-ink-muted text-xs font-normal">
            {`${String(setCount)} set here`}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-4 pt-3">{children}</div>
    </details>
  );
};

const StylePropertyGroups = ({
  declared,
  computed,
  statusOf,
  swatches,
  themeFonts,
  contrast,
  onChange,
}: StylePropertyGroupsProps) => {
  const valueOf = (property: string) => declared.get(property) ?? "";
  const computedOf = (property: string) => computedValueOf(property, computed);

  const lengthField = (spec: LengthSpec) => (
    <StyleLengthField
      key={spec.property}
      spec={spec}
      value={valueOf(spec.property)}
      computed={computedOf(spec.property)}
      status={statusOf(spec.property)}
      onChange={(value) => onChange(spec.property, value)}
    />
  );

  const choiceField = (spec: ChoiceSpec) => (
    <StyleChoiceField
      key={spec.property}
      spec={spec}
      value={valueOf(spec.property)}
      computed={computedOf(spec.property)}
      status={statusOf(spec.property)}
      onChange={(value) => onChange(spec.property, value)}
    />
  );

  const colorField = (
    property: string,
    label: string,
    fieldContrast: ContrastCheck | null,
  ) => (
    <StyleColorField
      key={property}
      label={label}
      value={valueOf(property)}
      computed={computedOf(property)}
      swatches={swatches}
      contrast={fieldContrast}
      status={statusOf(property)}
      onChange={(value) => onChange(property, value)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <StyleGroup
        title="Typography"
        properties={typographyProperties}
        declared={declared}
      >
        <StyleFontField
          value={valueOf("font-family")}
          computed={computedOf("font-family")}
          themeFonts={themeFonts}
          status={statusOf("font-family")}
          onChange={(value) => onChange("font-family", value)}
        />
        {lengthField(fontSize)}
        {choiceField(fontWeight)}
        {lengthField(lineHeight)}
        {lengthField(letterSpacing)}
        {choiceField(textTransform)}
        <StyleAlignField
          value={valueOf("text-align")}
          computed={computedOf("text-align")}
          status={statusOf("text-align")}
          onChange={(value) => onChange("text-align", value)}
        />
        {colorField("color", "Text colour", contrast)}
      </StyleGroup>
      <StyleGroup
        title="Spacing"
        properties={spacingProperties}
        declared={declared}
      >
        <StyleSpacingBox
          declared={declared}
          computed={computed}
          statusOf={statusOf}
          onChange={onChange}
        />
      </StyleGroup>
      <StyleGroup
        title="Size"
        properties={sizeFields.map((spec) => spec.property)}
        declared={declared}
      >
        {sizeFields.map(lengthField)}
      </StyleGroup>
      <StyleGroup
        title="Background"
        properties={["background-color"]}
        declared={declared}
      >
        {colorField("background-color", "Background colour", null)}
      </StyleGroup>
      <StyleGroup
        title="Border"
        properties={borderProperties}
        declared={declared}
      >
        {lengthField(borderWidth)}
        {choiceField(borderStyle)}
        {colorField("border-color", "Border colour", null)}
        {lengthField(borderRadius)}
      </StyleGroup>
      <StyleGroup title="Opacity" properties={["opacity"]} declared={declared}>
        <StyleOpacityField
          value={valueOf("opacity")}
          computed={computedOf("opacity")}
          status={statusOf("opacity")}
          onChange={(value) => onChange("opacity", value)}
        />
      </StyleGroup>
    </div>
  );
};

export default StylePropertyGroups;
