import { useId, useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { PickedImage } from "./formatting/blockMarkdown.ts";
import ImageChooser from "./ImageChooser.tsx";
import {
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

type InsertImageModalProps = {
  sitePath: string;
  onSubmitted: (image: PickedImage) => void;
  onClose: () => void;
};

type ImageProblems = { image?: string; alt?: string };

export const ALT_TEXT_HELP =
  "Say what the image shows in a few words. People who can’t see it hear this read aloud, and it appears if the image doesn’t load.";

export const ALT_TEXT_REQUIRED =
  "Describe the image so everyone knows what it shows.";

const InsertImageModal = ({
  sitePath,
  onSubmitted,
  onClose,
}: InsertImageModalProps) => {
  const altId = useId();
  const altHelpId = useId();
  const altErrorId = useId();
  const imageErrorId = useId();
  const [assetPath, setAssetPath] = useState("");
  const [alt, setAlt] = useState("");
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const foundProblems: ImageProblems = {
    ...(assetPath === "" ? { image: "Choose an image to show." } : {}),
    ...(alt.trim() === "" ? { alt: ALT_TEXT_REQUIRED } : {}),
  };
  const problems = hasTriedSubmit ? foundProblems : {};

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (foundProblems.image === undefined && foundProblems.alt === undefined) {
      onSubmitted({ assetPath, alt: alt.trim() });
      return;
    }
    setHasTriedSubmit(true);
    if (foundProblems.image === undefined) {
      document.getElementById(altId)?.focus();
    }
  };

  return (
    <ModalDialog title="Add an image" onClose={onClose}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="Image"
          aria-describedby={
            problems.image === undefined ? undefined : imageErrorId
          }
          className="flex flex-col gap-1.5"
        >
          <span className="text-ink-secondary text-sm font-medium">Image</span>
          <ImageChooser
            sitePath={sitePath}
            image={assetPath}
            noun="image"
            emptyText="No image chosen yet"
            pickerTitle="Choose an image"
            fileInputTestId="insert-image-file"
            onImageChanged={setAssetPath}
          />
          {problems.image !== undefined && (
            <p id={imageErrorId} className="text-danger text-xs">
              {problems.image}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor={altId}
              className="text-ink-secondary text-sm font-medium"
            >
              Image description
            </label>
            <span className="text-ink-muted text-xs">Required</span>
          </div>
          <p id={altHelpId} className="text-ink-muted text-xs">
            {ALT_TEXT_HELP}
          </p>
          <input
            id={altId}
            type="text"
            value={alt}
            aria-required="true"
            aria-invalid={problems.alt === undefined ? undefined : true}
            aria-describedby={
              problems.alt === undefined
                ? altHelpId
                : `${altHelpId} ${altErrorId}`
            }
            onChange={(event) => setAlt(event.target.value)}
            className={classNames(
              "bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none",
              problems.alt !== undefined && "ring-danger ring-1",
            )}
          />
          {problems.alt !== undefined && (
            <p id={altErrorId} className="text-danger text-xs">
              {problems.alt}
            </p>
          )}
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

export default InsertImageModal;
