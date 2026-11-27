import { useId } from "react";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import StyleTextInput from "./StyleTextInput.tsx";
import {
  formatAmount,
  nudgeDirectionOf,
  type StyleFieldStatus,
} from "./styleValues.ts";

type StyleOpacityFieldProps = {
  value: string;
  computed: string;
  status: StyleFieldStatus;
  onChange: (value: string | null) => void;
};

const percentPattern = /^(\d+(?:\.\d+)?|\.\d+)%?$/;

function percentOf(opacity: string): string {
  const trimmed = opacity.trim();
  if (trimmed === "") {
    return "";
  }
  const amount = trimmed.endsWith("%")
    ? Number(trimmed.slice(0, -1))
    : Number(trimmed) * 100;
  return Number.isFinite(amount) ? formatAmount(amount) : trimmed;
}

function opacityFromPercent(text: string): string {
  return formatAmount(Number(text.replace("%", "")) / 100);
}

function isPercent(text: string): boolean {
  const match = percentPattern.exec(text.trim());
  return match !== null && Number(match[1]) <= 100;
}

const StyleOpacityField = ({
  value,
  computed,
  status,
  onChange,
}: StyleOpacityFieldProps) => {
  const baseId = useId();
  const controlId = `${baseId}-control`;

  const nudge = (text: string, key: string, isLarge: boolean) => {
    const direction = nudgeDirectionOf(key);
    if (direction === null) {
      return null;
    }
    const start = Number(text === "" ? percentOf(computed) : text) || 0;
    const next = Math.min(
      100,
      Math.max(0, start + direction * (isLarge ? 10 : 1)),
    );
    return formatAmount(next);
  };

  return (
    <StyleFieldFrame
      label="Opacity"
      resetLabel="opacity"
      labelId={`${baseId}-label`}
      controlId={controlId}
      status={status}
      onReset={() => onChange(null)}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 grow flex-col gap-1">
          <StyleTextInput
            id={controlId}
            value={percentOf(value)}
            placeholder={percentOf(computed)}
            inputMode="decimal"
            errorMessage="Use a number from 0, see-through, to 100, solid."
            isValid={isPercent}
            onCommit={(text) =>
              onChange(text === "" ? null : opacityFromPercent(text))
            }
            onNudge={(text, keys) => nudge(text, keys.key, keys.shiftKey)}
            className="w-full"
          />
        </div>
        <span className="text-ink-secondary py-1.5 text-sm">%</span>
      </div>
    </StyleFieldFrame>
  );
};

export default StyleOpacityField;
