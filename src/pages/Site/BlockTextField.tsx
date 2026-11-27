import { useId, type Ref } from "react";
import { classNames } from "../../utils/classNames.ts";
import { blockInputClasses, tagClasses } from "./settingsStyles.ts";

type BlockTextFieldProps = {
  fieldName: string;
  label: string;
  description: string | null;
  isRequired: boolean;
  value: string;
  placeholder?: string;
  problem: string | undefined;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
};

const BlockTextField = ({
  fieldName,
  label,
  description,
  isRequired,
  value,
  placeholder,
  problem,
  inputRef,
  onChange,
}: BlockTextFieldProps) => {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const describedBy =
    [
      description === null ? null : descriptionId,
      problem === undefined ? null : errorId,
    ]
      .filter((id) => id !== null)
      .join(" ") || undefined;

  return (
    <div data-field={fieldName} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className="text-ink-secondary text-sm font-medium"
        >
          {label}
        </label>
        {isRequired && <span className={tagClasses}>Required</span>}
      </div>
      {description !== null && (
        <p id={descriptionId} className="text-ink-muted text-xs">
          {description}
        </p>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-required={isRequired || undefined}
        aria-invalid={problem === undefined ? undefined : true}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={classNames(
          blockInputClasses,
          problem !== undefined && "ring-danger ring-1",
        )}
      />
      {problem !== undefined && (
        <p id={errorId} className="text-danger text-xs">
          {problem}
        </p>
      )}
    </div>
  );
};

export default BlockTextField;
