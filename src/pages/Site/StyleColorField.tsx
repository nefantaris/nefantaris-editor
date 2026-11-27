import { useId, useState } from "react";
import { classNames } from "../../utils/classNames.ts";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import {
  hexOf,
  parsedColor,
  semanticLabelOf,
  semanticNameOf,
  type ContrastCheck,
  type SemanticSwatch,
} from "./styleColors.ts";
import StyleFieldFrame from "./StyleFieldFrame.tsx";
import StyleTextInput from "./StyleTextInput.tsx";
import type { StyleFieldStatus } from "./styleValues.ts";

type StyleColorFieldProps = {
  label: string;
  value: string;
  computed: string;
  swatches: SemanticSwatch[];
  contrast: ContrastCheck | null;
  status: StyleFieldStatus;
  onChange: (value: string | null) => void;
};

const PICKER_COMMIT_DELAY_MS = 300;

function ratioText(ratio: number): string {
  return `${String(Math.floor(ratio * 10) / 10)}:1`;
}

const StyleColorField = ({
  label,
  value,
  computed,
  swatches,
  contrast,
  status,
  onChange,
}: StyleColorFieldProps) => {
  const baseId = useId();
  const [pickerDraft, setPickerDraft] = useState<string | null>(null);

  const labelId = `${baseId}-label`;
  const contrastId = `${baseId}-contrast`;
  const semanticName = semanticNameOf(value);
  const customValue = semanticName === null ? value : "";
  const pickerColor = parsedColor(customValue === "" ? computed : customValue);
  const pickerValue =
    pickerDraft ?? (pickerColor === null ? "#000000" : hexOf(pickerColor));
  const isContrastLow = contrast !== null && contrast.ratio < contrast.required;

  const pickerCommit = useDebouncedCallback((hex: string) => {
    setPickerDraft(null);
    onChange(hex);
  }, PICKER_COMMIT_DELAY_MS);

  const changePicker = (hex: string) => {
    setPickerDraft(hex);
    pickerCommit.schedule(hex);
  };

  return (
    <StyleFieldFrame
      label={label}
      resetLabel={label.toLowerCase()}
      labelId={labelId}
      controlId={null}
      status={status}
      onReset={() => onChange(null)}
    >
      <div
        role="group"
        aria-label={`${label}: your theme's colours`}
        className="flex flex-wrap gap-1.5"
      >
        {swatches.map((swatch) => {
          const isChosen = swatch.name === semanticName;
          return (
            <button
              key={swatch.name}
              type="button"
              aria-label={swatch.label}
              aria-pressed={isChosen}
              title={`${swatch.label}: ${swatch.use}`}
              onClick={() => onChange(swatch.value)}
              className={classNames(
                "border-line focus-visible:ring-primary size-7 rounded-md border transition-colors duration-100",
                isChosen && "ring-primary ring-2 ring-offset-1",
                swatch.shown === null && "bg-sunken",
              )}
              style={
                swatch.shown === null ? undefined : { background: swatch.shown }
              }
            />
          );
        })}
      </div>
      {semanticName !== null && (
        <p className="text-ink-secondary text-xs">
          Your theme&rsquo;s {semanticLabelOf(semanticName)} colour
        </p>
      )}
      <div className="flex items-start gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={pickerValue}
          onChange={(event) => changePicker(event.target.value)}
          onBlur={pickerCommit.flush}
          className="border-line bg-surface h-8 w-10 shrink-0 cursor-pointer rounded-md border p-0.5"
        />
        <div className="flex min-w-0 grow flex-col gap-1">
          <StyleTextInput
            aria-label={`${label} value`}
            aria-describedby={isContrastLow ? contrastId : undefined}
            value={customValue}
            placeholder={semanticName === null ? computed : ""}
            errorMessage="Use a colour like #1d4ed8, rgb(29 78 216), or a colour name."
            isValid={(text) => CSS.supports("color", text)}
            onCommit={(text) => onChange(text === "" ? null : text)}
            className="w-full font-mono"
          />
        </div>
      </div>
      {isContrastLow && (
        <p id={contrastId} role="status" className="text-danger text-xs">
          {`Hard to read: this text has a contrast of ${ratioText(contrast.ratio)} with its background. WCAG AA asks for at least ${String(contrast.required)}:1.`}
        </p>
      )}
    </StyleFieldFrame>
  );
};

export default StyleColorField;
