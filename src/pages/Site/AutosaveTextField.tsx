import { useEffect, useId, useRef, useState } from "react";
import { classNames } from "../../utils/classNames.ts";

const COMMIT_DELAY_MS = 300;

type AutosaveTextFieldProps = {
  label: string;
  labelledBy?: string;
  describedBy?: string;
  value: string;
  onCommit: (value: string) => void;
  inputType?: "text" | "date";
  isMultiline?: boolean;
  requiredMessage?: string;
  validate?: (value: string) => string | null;
  hint?: string;
  placeholder?: string;
  className?: string;
};

const inputClasses =
  "bg-field text-ink border-transparent focus:ring-primary w-full rounded-md border px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none";

const AutosaveTextField = ({
  label,
  labelledBy,
  describedBy: externalDescribedBy,
  value,
  onCommit,
  inputType = "text",
  isMultiline = false,
  requiredMessage,
  validate,
  hint,
  placeholder,
  className,
}: AutosaveTextFieldProps) => {
  const fieldId = useId();
  const timerRef = useRef<number | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const [draft, setDraft] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState(true);

  const shownValue = draft ?? value;
  const problemFor = (candidate: string): string | null => {
    if (requiredMessage !== undefined && candidate.trim() === "") {
      return requiredMessage;
    }
    return validate ? validate(candidate) : null;
  };
  const invalidMessage = isSettled ? problemFor(shownValue) : null;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [
    externalDescribedBy ?? null,
    hint === undefined ? null : hintId,
    invalidMessage === null ? null : errorId,
  ]
    .filter((id) => id !== null)
    .join(" ");

  const isSavable = (candidate: string): boolean =>
    validate === undefined || validate(candidate) === null;

  const clearTimer = () => {
    if (timerRef.current === null) {
      return;
    }
    globalThis.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const runPendingCommit = () => {
    const pendingValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (pendingValue !== null) {
      onCommitRef.current(pendingValue);
    }
  };

  const handleChange = (nextValue: string) => {
    setDraft(nextValue);
    setIsSettled(false);
    pendingValueRef.current = isSavable(nextValue) ? nextValue : null;
    clearTimer();
    timerRef.current = globalThis.setTimeout(() => {
      timerRef.current = null;
      setIsSettled(true);
      runPendingCommit();
    }, COMMIT_DELAY_MS);
  };

  const handleBlur = () => {
    clearTimer();
    runPendingCommit();
    setIsSettled(true);
    if (draft === null || isSavable(draft)) {
      setDraft(null);
    }
  };

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  useEffect(() => {
    globalThis.addEventListener("beforeunload", runPendingCommit);
    return () => {
      globalThis.removeEventListener("beforeunload", runPendingCommit);
      clearTimer();
      runPendingCommit();
    };
  }, []);

  const sharedProps = {
    id: fieldId,
    "aria-labelledby": labelledBy,
    value: shownValue,
    placeholder,
    "aria-invalid": invalidMessage !== null || undefined,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
    className: classNames(
      inputClasses,
      invalidMessage !== null && "ring-danger ring-1",
    ),
  };

  return (
    <div className={classNames("flex min-w-0 flex-col gap-1", className)}>
      {labelledBy === undefined && (
        <label
          htmlFor={fieldId}
          className="text-ink-secondary text-xs font-medium"
        >
          {label}
        </label>
      )}
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
      {hint !== undefined && (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      )}
      {invalidMessage !== null && (
        <p id={errorId} className="text-danger text-xs">
          {invalidMessage}
        </p>
      )}
    </div>
  );
};

export default AutosaveTextField;
