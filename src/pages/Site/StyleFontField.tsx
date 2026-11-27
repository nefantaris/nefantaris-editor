import { useId, useState } from "react";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import StyleTextInput from "./StyleTextInput.tsx";
import {
  systemFontStacks,
  type FontStack,
  type StyleFieldStatus,
} from "./styleValues.ts";

type StyleFontFieldProps = {
  value: string;
  computed: string;
  themeFonts: FontStack[];
  status: StyleFieldStatus;
  onChange: (value: string | null) => void;
};

const CUSTOM_CHOICE = "custom";

function sameStack(first: string, second: string): boolean {
  const normalized = (stack: string) =>
    stack
      .replaceAll("'", '"')
      .replaceAll(/\s*,\s*/g, ",")
      .trim();
  return normalized(first) === normalized(second);
}

function firstFamilyOf(stack: string): string {
  return (stack.split(",", 1)[0] ?? "").replaceAll(/["']/g, "").trim();
}

const StyleFontField = ({
  value,
  computed,
  themeFonts,
  status,
  onChange,
}: StyleFontFieldProps) => {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const [isCustomChosen, setIsCustomChosen] = useState(false);

  const offered = [...themeFonts, ...systemFontStacks].find((stack) =>
    sameStack(stack.value, value),
  );
  const choice =
    value === ""
      ? isCustomChosen
        ? CUSTOM_CHOICE
        : ""
      : (offered?.value ?? CUSTOM_CHOICE);
  const computedFamily = firstFamilyOf(computed);

  const choose = (next: string) => {
    setIsCustomChosen(next === CUSTOM_CHOICE);
    if (next !== CUSTOM_CHOICE) {
      onChange(next === "" ? null : next);
    }
  };

  return (
    <StyleFieldFrame
      label="Font"
      resetLabel="font"
      labelId={`${baseId}-label`}
      controlId={controlId}
      status={status}
      onReset={() => {
        setIsCustomChosen(false);
        onChange(null);
      }}
    >
      <select
        id={controlId}
        value={choice}
        onChange={(event) => choose(event.target.value)}
        className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
      >
        <option value="">
          {computedFamily === ""
            ? "Theme default"
            : `Theme default (${computedFamily})`}
        </option>
        {themeFonts.length > 0 && (
          <optgroup label="Your theme">
            {themeFonts.map((stack) => (
              <option key={stack.value} value={stack.value}>
                {stack.label}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Fonts every computer has">
          {systemFontStacks.map((stack) => (
            <option key={stack.value} value={stack.value}>
              {stack.label}
            </option>
          ))}
        </optgroup>
        <option value={CUSTOM_CHOICE}>Something else…</option>
      </select>
      {choice === CUSTOM_CHOICE && (
        <StyleTextInput
          aria-label="Font names"
          value={offered === undefined ? value : ""}
          placeholder={computed}
          errorMessage="Use font names separated by commas, like Georgia, serif."
          isValid={(text) => CSS.supports("font-family", text)}
          onCommit={(text) => onChange(text === "" ? null : text)}
          className="w-full"
        />
      )}
    </StyleFieldFrame>
  );
};

export default StyleFontField;
