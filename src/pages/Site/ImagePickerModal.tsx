import { useState } from "react";
import type { SiteImage } from "../../../electron/ipcContract.cts";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import { siteAssetUrl } from "./livePreview/assetUrl.ts";
import {
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

type ImagePickerModalProps = {
  title: string;
  sitePath: string;
  images: SiteImage[] | null;
  selectedPaths: string[];
  isMultiple?: boolean;
  onPicked: (assetPaths: string[]) => void;
  onClose: () => void;
};

const ImagePickerModal = ({
  title,
  sitePath,
  images,
  selectedPaths,
  isMultiple = false,
  onPicked,
  onClose,
}: ImagePickerModalProps) => {
  const [chosenPaths, setChosenPaths] = useState<string[]>([]);
  const markedPaths = isMultiple ? chosenPaths : selectedPaths;

  const toggle = (assetPath: string) => {
    if (!isMultiple) {
      onPicked([assetPath]);
      return;
    }
    setChosenPaths((current) =>
      current.includes(assetPath)
        ? current.filter((path) => path !== assetPath)
        : [...current, assetPath],
    );
  };

  return (
    <ModalDialog title={title} size="wide" onClose={onClose}>
      {images === null && (
        <p className="text-ink-muted text-sm">Looking for your images…</p>
      )}
      {images?.length === 0 && (
        <p className="text-ink-muted text-sm">
          Your site has no images yet. Close this and use &ldquo;Add a new
          image&rdquo; instead.
        </p>
      )}
      {!!images?.length && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.assetPath}>
              <button
                type="button"
                aria-pressed={markedPaths.includes(image.assetPath)}
                onClick={() => toggle(image.assetPath)}
                className={classNames(
                  "hover:bg-raised flex w-full flex-col items-center gap-2 rounded-md border p-2 text-sm transition-colors duration-100",
                  markedPaths.includes(image.assetPath)
                    ? "border-primary"
                    : "border-line",
                )}
              >
                <img
                  src={siteAssetUrl(sitePath, image.assetPath)}
                  alt=""
                  className="bg-sunken h-24 w-full rounded-md object-contain"
                />
                <span className="text-ink-secondary w-full truncate">
                  {image.fileName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {isMultiple && (
          <button
            type="button"
            disabled={chosenPaths.length === 0}
            onClick={() => onPicked(chosenPaths)}
            className={modalPrimaryButtonClasses}
          >
            {chosenPaths.length === 1
              ? "Add 1 image"
              : `Add ${chosenPaths.length} images`}
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
    </ModalDialog>
  );
};

export default ImagePickerModal;
