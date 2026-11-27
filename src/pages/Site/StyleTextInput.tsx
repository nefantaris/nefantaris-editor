import {
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { classNames } from "../../utils/classNames.ts";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import type { NudgeKeys } from "./styleValues.ts";

type StyleTextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown" | "defaultValue"
> & {
  value: string;
  errorMessage: string;
  isErrorTextShown?: boolean;
  isValid: (text: string) => boolean;
  onCommit: (text: string) => void;
  onNudge?: (text: string, keys: NudgeKeys) => string | null;
  onInvalidChanged?: (isInvalid: boolean) => void;
};

const TYPING_COMMIT_DELAY_MS = 600;
const NUDGE_COMMIT_DELAY_MS = 250;

const StyleTextInput = ({
  value,
  errorMessage,
  isErrorTextShown = true,
  isValid,
  onCommit,
  onNudge,
  onInvalidChanged,
  className,
  ...inputProps
}: StyleTextInputProps) => {
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [isInvalid, setIsInvalid] = useState(false);

  const shown = draft ?? value;

  const changeInvalid = (next: boolean) => {
    setIsInvalid(next);
    onInvalidChanged?.(next);
  };

  const commit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed !== "" && !isValid(trimmed)) {
      changeInvalid(true);
      return;
    }
    changeInvalid(false);
    setDraft(null);
    if (trimmed !== value.trim()) {
      onCommit(trimmed);
    }
  };

  const typingCommit = useDebouncedCallback(commit, TYPING_COMMIT_DELAY_MS);
  const nudgeCommit = useDebouncedCallback(commit, NUDGE_COMMIT_DELAY_MS);

  const changeDraft = (text: string) => {
    setDraft(text);
    nudgeCommit.cancel();
    typingCommit.schedule(text);
  };

  const flush = () => {
    typingCommit.flush();
    nudgeCommit.flush();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      flush();
      return;
    }
    if (event.key === "Escape" && draft !== null) {
      event.preventDefault();
      typingCommit.cancel();
      nudgeCommit.cancel();
      setDraft(null);
      changeInvalid(false);
      return;
    }
    const nudged = onNudge?.(shown, {
      key: event.key,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    });
    if (nudged === null || nudged === undefined) {
      return;
    }
    event.preventDefault();
    setDraft(nudged);
    typingCommit.cancel();
    nudgeCommit.schedule(nudged);
  };

  return (
    <>
      <input
        {...inputProps}
        type="text"
        spellCheck={false}
        autoComplete="off"
        value={shown}
        aria-invalid={isInvalid || undefined}
        aria-describedby={
          isInvalid && isErrorTextShown
            ? errorId
            : inputProps["aria-describedby"]
        }
        onChange={(event) => changeDraft(event.target.value)}
        onBlur={flush}
        onKeyDown={handleKeyDown}
        className={classNames(
          "bg-field text-ink focus:ring-primary placeholder:text-ink-muted min-w-0 rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none",
          isInvalid && "ring-danger ring-1",
          className,
        )}
      />
      {isInvalid && isErrorTextShown && (
        <p id={errorId} className="text-danger text-xs">
          {errorMessage}
        </p>
      )}
    </>
  );
};

export default StyleTextInput;
