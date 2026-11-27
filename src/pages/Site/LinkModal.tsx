import { useId, useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import { isRouteOrUrl } from "./addressRules.ts";
import BlockLinkField from "./BlockLinkField.tsx";
import type { LinkDraft } from "./formatting/linkEditing.ts";
import {
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";
import type { LinkOptions } from "./siteSettingsModel.ts";

type LinkModalProps = {
  draft: LinkDraft;
  linkOptions: LinkOptions;
  onSubmitted: (text: string, url: string) => void;
  onRemoved: () => void;
  onClose: () => void;
};

type LinkProblems = { text?: string; url?: string };

const bareDomainPattern = /^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/;

const inputClasses =
  "bg-field text-ink border-transparent focus:ring-primary w-full rounded-md border px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none";

function normalizedLinkAddress(value: string): string {
  const trimmed = value.trim();
  return bareDomainPattern.test(trimmed) ? `https://${trimmed}` : trimmed;
}

function linkProblems(text: string, url: string): LinkProblems {
  const address = normalizedLinkAddress(url);
  return {
    ...(text.trim() === "" ? { text: "Write the words people click." } : {}),
    ...(address === ""
      ? { url: "Choose where the link goes." }
      : isRouteOrUrl(address) || address.startsWith("#")
        ? {}
        : {
            url: "Use a full web address like https://example.com, or choose one of your pages.",
          }),
  };
}

const LinkModal = ({
  draft,
  linkOptions,
  onSubmitted,
  onRemoved,
  onClose,
}: LinkModalProps) => {
  const textId = useId();
  const textErrorId = useId();
  const urlId = useId();
  const urlErrorId = useId();
  const [text, setText] = useState(draft.text);
  const [url, setUrl] = useState(draft.url);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const isEditing = draft.existing !== null;
  const problems: LinkProblems = hasTriedSubmit ? linkProblems(text, url) : {};

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = linkProblems(text, url);
    if (found.text === undefined && found.url === undefined) {
      onSubmitted(text, normalizedLinkAddress(url));
      return;
    }
    setHasTriedSubmit(true);
    document.getElementById(found.text === undefined ? urlId : textId)?.focus();
  };

  return (
    <ModalDialog
      title={isEditing ? "Edit link" : "Add a link"}
      onClose={onClose}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={textId}
            className="text-ink-secondary text-sm font-medium"
          >
            Text to show
          </label>
          <input
            id={textId}
            type="text"
            value={text}
            aria-invalid={problems.text === undefined ? undefined : true}
            aria-describedby={
              problems.text === undefined ? undefined : textErrorId
            }
            onChange={(event) => setText(event.target.value)}
            className={classNames(
              inputClasses,
              problems.text !== undefined && "ring-danger ring-1",
            )}
          />
          {problems.text !== undefined && (
            <p id={textErrorId} className="text-danger text-xs">
              {problems.text}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={urlId}
            className="text-ink-secondary text-sm font-medium"
          >
            Goes to
          </label>
          <BlockLinkField
            id={urlId}
            label="Goes to"
            describedBy={problems.url === undefined ? undefined : urlErrorId}
            value={url}
            linkOptions={linkOptions}
            isRequired
            isInvalid={problems.url !== undefined}
            onChange={setUrl}
          />
          {problems.url !== undefined && (
            <p id={urlErrorId} className="text-danger text-xs">
              {problems.url}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className={modalPrimaryButtonClasses}>
            {isEditing ? "Save link" : "Add link"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={onRemoved}
              className={modalSecondaryButtonClasses}
            >
              Remove link
            </button>
          )}
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

export default LinkModal;
