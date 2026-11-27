import { useId, useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import {
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

type CodeBlockModalProps = {
  onSubmitted: (language: string) => void;
  onClose: () => void;
};

const suggestedLanguages = [
  "bash",
  "css",
  "html",
  "javascript",
  "json",
  "python",
  "typescript",
  "yaml",
];

const CodeBlockModal = ({ onSubmitted, onClose }: CodeBlockModalProps) => {
  const inputId = useId();
  const hintId = useId();
  const listId = useId();
  const [language, setLanguage] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitted(language);
  };

  return (
    <ModalDialog title="Add a code block" onClose={onClose}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={inputId}
            className="text-ink-secondary text-sm font-medium"
          >
            Language (optional)
          </label>
          <p id={hintId} className="text-ink-muted text-xs">
            Lets your site colour the code, for example javascript, python or
            html. Leave it empty for plain text.
          </p>
          <input
            id={inputId}
            type="text"
            list={listId}
            value={language}
            aria-describedby={hintId}
            onChange={(event) => setLanguage(event.target.value)}
            className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none"
          />
          <datalist id={listId}>
            {suggestedLanguages.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className={modalPrimaryButtonClasses}>
            Insert
          </button>
          <button
            type="button"
            onClick={onClose}
            className={modalSecondaryButtonClasses}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export default CodeBlockModal;
