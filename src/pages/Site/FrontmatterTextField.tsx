import { useEffect, useId, useRef, useState } from "react";
import { classNames } from "../../utils/classNames.ts";

const COMMIT_DELAY_MS = 300;

type FrontmatterTextFieldProps = {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  inputType?: "text" | "date";
  isMultiline?: boolean;
  requiredMessage?: string;
  className?: string;
};

const inputClasses =
  "bg-brand-white text-brand-black border-brand-border focus:ring-brand-primary w-full rounded-md border px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none";

const FrontmatterTextField = ({
  label,
  value,
  onCommit,
  inputType = "text",
  isMultiline = false,
  requiredMessage,
  className,
}: FrontmatterTextFieldProps) => {
  const fieldId = useId();
  const timerRef = useRef<number | null>(null);
  const pendingCommitRef = useRef<(() => void) | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const shownValue = draft ?? value;
  const invalidMessage =
    requiredMessage !== undefined && shownValue.trim() === ""
      ? requiredMessage
      : null;
  const errorId = `${fieldId}-error`;

  const clearTimer = () => {
    if (timerRef.current === null) {
      return;
    }
    globalThis.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const runPendingCommit = () => {
    const commit = pendingCommitRef.current;
    pendingCommitRef.current = null;
    commit?.();
  };

  const handleChange = (nextValue: string) => {
    setDraft(nextValue);
    pendingCommitRef.current = () => onCommit(nextValue);
    clearTimer();
    timerRef.current = globalThis.setTimeout(() => {
      timerRef.current = null;
      runPendingCommit();
    }, COMMIT_DELAY_MS);
  };

  const handleBlur = () => {
    clearTimer();
    runPendingCommit();
    setDraft(null);
  };

  useEffect(
    () => () => {
      clearTimer();
      runPendingCommit();
    },
    [],
  );

  const sharedProps = {
    id: fieldId,
    value: shownValue,
    "aria-invalid": invalidMessage !== null || undefined,
    "aria-describedby": invalidMessage === null ? undefined : errorId,
    className: classNames(
      inputClasses,
      invalidMessage !== null && "border-brand-danger",
    ),
  };

  return (
    <div className={classNames("flex min-w-0 flex-col gap-1", className)}>
      <label
        htmlFor={fieldId}
        className="text-brand-grayDark text-xs font-medium"
      >
        {label}
      </label>
      {isMultiline ? (
        <textarea
          {...sharedProps}
          rows={2}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <input
          {...sharedProps}
          type={inputType}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
        />
      )}
      {invalidMessage !== null && (
        <p id={errorId} className="text-brand-danger text-xs">
          {invalidMessage}
        </p>
      )}
    </div>
  );
};

export default FrontmatterTextField;
