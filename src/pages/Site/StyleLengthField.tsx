import { useId, useState } from "react";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import type { LengthSpec, LengthUnit } from "./styleProperties.ts";
import StyleTextInput from "./StyleTextInput.tsx";
import type { StyleFieldStatus } from "./styleValues.ts";
import {
  isLengthAccepted,
  nudgedLength,
  parseLength,
  shownUnit,
  withUnit,
} from "./styleValues.ts";

type StyleLengthFieldProps = {
  spec: LengthSpec;
  value: string;
  computed: string;
  status: StyleFieldStatus;
  isNegativeAllowed?: boolean;
  onChange: (value: string | null) => void;
};

const unitLabels: Record<LengthUnit, string> = {
  px: "px",
  rem: "rem",
  em: "em",
  "%": "%",
  "": "×",
};

const StyleLengthField = ({
  spec,
  value,
  computed,
  status,
  isNegativeAllowed = false,
  onChange,
}: StyleLengthFieldProps) => {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const [preferredUnit, setPreferredUnit] = useState<LengthUnit>(
    spec.units[0] ?? "px",
  );

  const unit = shownUnit(value, preferredUnit);
  const isKeyword = value !== "" && parseLength(value) === null;
  const resetLabel = spec.label.toLowerCase();

  const commit = (text: string) => {
    onChange(text === "" ? null : withUnit(text, unit));
  };

  const changeUnit = (next: LengthUnit) => {
    setPreferredUnit(next);
    const parsed = parseLength(value);
    if (parsed !== null) {
      onChange(`${String(parsed.amount)}${next}`);
    }
  };

  return (
    <StyleFieldFrame
      label={spec.label}
      resetLabel={resetLabel}
      labelId={`${baseId}-label`}
      controlId={controlId}
      status={status}
      onReset={() => onChange(null)}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 grow flex-col gap-1">
          <StyleTextInput
            id={controlId}
            value={value}
            placeholder={computed}
            inputMode="decimal"
            errorMessage={`Use a number like 16, 1.5${unit === "" ? "" : unit}${
              spec.keywords.length > 0
                ? `, or ${spec.keywords.join(" or ")}`
                : ""
            }.`}
            isValid={(text) => isLengthAccepted(spec.property, text, unit)}
            onCommit={commit}
            onNudge={(text, keys) =>
              nudgedLength(text, computed, unit, keys, isNegativeAllowed)
            }
            className="w-full"
          />
        </div>
        <select
          aria-label={`${spec.label} unit`}
          value={unit}
          disabled={isKeyword}
          onChange={(event) =>
            changeUnit(
              spec.units.find((option) => option === event.target.value) ??
                unit,
            )
          }
          className="bg-field text-ink focus:ring-primary disabled:text-ink-disabled shrink-0 rounded-md border border-transparent px-1.5 py-1.5 text-sm focus:ring-2 focus:outline-none"
        >
          {spec.units.map((option) => (
            <option key={option} value={option}>
              {unitLabels[option]}
            </option>
          ))}
        </select>
      </div>
    </StyleFieldFrame>
  );
};

export default StyleLengthField;
