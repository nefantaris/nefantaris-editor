import { useId } from "react";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import type { ChoiceSpec } from "./styleProperties.ts";
import type { StyleFieldStatus } from "./styleValues.ts";

type StyleChoiceFieldProps = {
  spec: ChoiceSpec;
  value: string;
  computed: string;
  status: StyleFieldStatus;
  onChange: (value: string | null) => void;
};

const StyleChoiceField = ({
  spec,
  value,
  computed,
  status,
  onChange,
}: StyleChoiceFieldProps) => {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const computedChoice = spec.choices.find(
    (choice) => choice.value === computed,
  );
  const isOffered = value === "" || spec.choices.some((c) => c.value === value);
  const defaultLabel =
    computed === ""
      ? "Theme default"
      : `Theme default (${computedChoice?.label ?? computed})`;

  return (
    <StyleFieldFrame
      label={spec.label}
      resetLabel={spec.label.toLowerCase()}
      labelId={`${baseId}-label`}
      controlId={controlId}
      status={status}
      onReset={() => onChange(null)}
    >
      <select
        id={controlId}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : event.target.value)
        }
        className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
      >
        <option value="">{defaultLabel}</option>
        {spec.choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
        {!isOffered && <option value={value}>{value}</option>}
      </select>
    </StyleFieldFrame>
  );
};

export default StyleChoiceField;
