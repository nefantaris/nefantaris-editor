import { useId } from "react";
import { classNames } from "../../utils/classNames.ts";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import { textAlignChoices } from "./styleProperties.ts";
import type { StyleFieldStatus } from "./styleValues.ts";

type StyleAlignFieldProps = {
  value: string;
  computed: string;
  status: StyleFieldStatus;
  onChange: (value: string | null) => void;
};

const computedAliases: Record<string, string> = {
  start: "left",
  end: "right",
};

const StyleAlignField = ({
  value,
  computed,
  status,
  onChange,
}: StyleAlignFieldProps) => {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const shownComputed = computedAliases[computed] ?? computed;

  return (
    <StyleFieldFrame
      label="Alignment"
      resetLabel="alignment"
      labelId={labelId}
      controlId={null}
      status={status}
      onReset={() => onChange(null)}
    >
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="border-line flex overflow-hidden rounded-md border"
      >
        {textAlignChoices.map((choice) => {
          const isChosen = choice.value === value;
          const isComputed = value === "" && choice.value === shownComputed;
          return (
            <label
              key={choice.value}
              className={classNames(
                "has-focus-visible:ring-primary grow cursor-pointer px-2 py-1.5 text-center text-sm transition-colors duration-100 has-focus-visible:ring-2 has-focus-visible:ring-inset",
                isChosen
                  ? "bg-primary text-on-primary"
                  : "text-ink-secondary hover:bg-raised",
                isComputed && "bg-raised text-ink",
              )}
            >
              <input
                type="radio"
                name={baseId}
                value={choice.value}
                checked={isChosen}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </StyleFieldFrame>
  );
};

export default StyleAlignField;
