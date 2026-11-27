import { useId, useRef, useState, type FormEvent } from "react";
import type { SiteImage } from "../../../electron/ipcContract.cts";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  TrashIcon,
} from "../../components/Icons.tsx";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import ChoiceField from "./ChoiceField.tsx";
import type { PickedImage } from "./formatting/blockMarkdown.ts";
import ImagePickerModal from "./ImagePickerModal.tsx";
import { ALT_TEXT_HELP, ALT_TEXT_REQUIRED } from "./InsertImageModal.tsx";
import { siteAssetUrl } from "./livePreview/assetUrl.ts";
import {
  iconButtonClasses,
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

export type ImageListBlock = { name: string; label: string };

type GalleryModalProps = {
  sitePath: string;
  blocks: ImageListBlock[];
  initialBlockName: string;
  onSubmitted: (blockName: string, images: PickedImage[]) => void;
  onClose: () => void;
};

type GalleryEntry = PickedImage & { key: string };

const IMAGE_TYPES =
  "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif";

function fileNameOf(assetPath: string): string {
  return assetPath.split("/").at(-1) ?? assetPath;
}

function entryFor(assetPath: string): GalleryEntry {
  return { key: crypto.randomUUID(), assetPath, alt: "" };
}

function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const GalleryModal = ({
  sitePath,
  blocks,
  initialBlockName,
  onSubmitted,
  onClose,
}: GalleryModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const styleLabelId = useId();
  const altHelpId = useId();
  const [blockName, setBlockName] = useState(initialBlockName);
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [siteImages, setSiteImages] = useState<SiteImage[] | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const label = blocks.find((block) => block.name === blockName)?.label;
  const hasNoImages = entries.length === 0;

  const openPicker = async () => {
    setSiteImages(null);
    setIsPickerOpen(true);
    setSiteImages(
      await globalThis.nefantaris.invoke("siteFiles:listImages", sitePath),
    );
  };

  const addPicked = (assetPaths: string[]) => {
    setIsPickerOpen(false);
    setEntries((current) => [...current, ...assetPaths.map(entryFor)]);
  };

  const addFiles = async (files: File[]) => {
    const saved: string[] = [];
    for (const file of files) {
      const result = await globalThis.nefantaris.invoke(
        "content:saveAsset",
        sitePath,
        file.type,
        file.name.replace(/\.[^.]*$/, "") || "gallery-image",
        new Uint8Array(await file.arrayBuffer()),
      );
      if (result.status === "saved") {
        saved.push(result.markdownPath);
      }
    }
    setAddError(
      saved.length === files.length
        ? null
        : "Some files couldn’t be added. Choose PNG, JPEG, GIF, WebP, SVG, or AVIF pictures.",
    );
    setEntries((current) => [...current, ...saved.map(entryFor)]);
  };

  const updateAlt = (key: string, alt: string) => {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, alt } : entry)),
    );
  };

  const moveEntry = (from: number, to: number) => {
    setEntries((current) => moved(current, from, to));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstMissing = entries.findIndex((entry) => entry.alt.trim() === "");
    if (!hasNoImages && firstMissing === -1) {
      onSubmitted(
        blockName,
        entries.map((entry) => ({
          assetPath: entry.assetPath,
          alt: entry.alt.trim(),
        })),
      );
      return;
    }
    setHasTriedSubmit(true);
    listRef.current
      ?.querySelectorAll<HTMLInputElement>("input[type=text]")
      [firstMissing]?.focus();
  };

  return (
    <ModalDialog title={`Add ${label ?? "a gallery"}`} onClose={onClose}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {blocks.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span
              id={styleLabelId}
              className="text-ink-secondary text-sm font-medium"
            >
              Show the images as
            </span>
            <ChoiceField
              id={`${styleLabelId}-choice`}
              labelledBy={styleLabelId}
              options={blocks.map((block) => ({
                value: block.name,
                label: block.label,
                fontFamily: null,
              }))}
              value={blockName}
              emptyLabel={null}
              isFontPreview={false}
              onChange={setBlockName}
            />
          </div>
        )}
        <p id={altHelpId} className="text-ink-muted text-xs">
          Every image needs a description. {ALT_TEXT_HELP}
        </p>
        {!hasNoImages && (
          <ol ref={listRef} aria-label="Images" className="flex flex-col gap-2">
            {entries.map((entry, index) => {
              const fileName = fileNameOf(entry.assetPath);
              const isMissingAlt = hasTriedSubmit && entry.alt.trim() === "";
              return (
                <li
                  key={entry.key}
                  className="border-line flex items-start gap-3 rounded-md border p-2"
                >
                  <img
                    src={siteAssetUrl(sitePath, entry.assetPath)}
                    alt=""
                    className="bg-sunken h-14 w-20 shrink-0 rounded-md object-cover"
                  />
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <span className="text-ink-secondary truncate text-xs">
                      {fileName}
                    </span>
                    <input
                      type="text"
                      value={entry.alt}
                      aria-label={`Description of ${fileName}`}
                      aria-describedby={altHelpId}
                      aria-required="true"
                      aria-invalid={isMissingAlt || undefined}
                      onChange={(event) =>
                        updateAlt(entry.key, event.target.value)
                      }
                      className={classNames(
                        "bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1 text-sm focus:ring-2 focus:outline-none",
                        isMissingAlt && "ring-danger ring-1",
                      )}
                    />
                    {isMissingAlt && (
                      <p className="text-danger text-xs">{ALT_TEXT_REQUIRED}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Move ${fileName} up`}
                      disabled={index === 0}
                      onClick={() => moveEntry(index, index - 1)}
                      className={iconButtonClasses}
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${fileName} down`}
                      disabled={index === entries.length - 1}
                      onClick={() => moveEntry(index, index + 1)}
                      className={iconButtonClasses}
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${fileName}`}
                      onClick={() =>
                        setEntries((current) =>
                          current.filter((item) => item.key !== entry.key),
                        )
                      }
                      className={iconButtonClasses}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {hasNoImages && (
          <p
            className={classNames(
              "text-sm",
              hasTriedSubmit ? "text-danger" : "text-ink-muted",
            )}
          >
            {hasTriedSubmit ? "Add at least one image." : "No images yet"}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void openPicker()}
            className={secondaryButtonClasses}
          >
            Choose from your images
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={secondaryButtonClasses}
          >
            Add new images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={IMAGE_TYPES}
            tabIndex={-1}
            aria-hidden="true"
            data-testid="gallery-image-files"
            onChange={(event) => {
              void addFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
            className="hidden"
          />
        </div>
        {addError !== null && (
          <p role="alert" className="text-danger text-sm">
            {addError}
          </p>
        )}
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
      {isPickerOpen && (
        <ImagePickerModal
          title="Choose images"
          sitePath={sitePath}
          images={siteImages}
          selectedPaths={[]}
          isMultiple
          onPicked={addPicked}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </ModalDialog>
  );
};

export default GalleryModal;
