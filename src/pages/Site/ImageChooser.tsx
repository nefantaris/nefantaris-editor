import { useRef, useState } from "react";
import type { SiteImage } from "../../../electron/ipcContract.cts";
import ImagePickerModal from "./ImagePickerModal.tsx";
import { siteAssetUrl } from "./livePreview/assetUrl.ts";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type ImageChooserProps = {
  sitePath: string;
  image: string;
  noun: string;
  emptyText: string;
  pickerTitle: string;
  fileInputTestId?: string;
  onImageChanged: (image: string) => void;
};

const IMAGE_TYPES =
  "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif";

function baseNameFor(file: File, noun: string): string {
  const stem = file.name.replace(/\.[^.]*$/, "");
  return stem === "" ? noun.replaceAll(/\s+/g, "-") : stem;
}

const ImageChooser = ({
  sitePath,
  image,
  noun,
  emptyText,
  pickerTitle,
  fileInputTestId,
  onImageChanged,
}: ImageChooserProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [images, setImages] = useState<SiteImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSiteImage = image.startsWith("/");
  const fileName = image.split("/").at(-1) ?? image;

  const openPicker = async () => {
    setImages(null);
    setIsPickerOpen(true);
    setImages(
      await globalThis.nefantaris.invoke("siteFiles:listImages", sitePath),
    );
  };

  const pickImage = (assetPath: string) => {
    setIsPickerOpen(false);
    setError(null);
    onImageChanged(assetPath);
  };

  const addImage = async (file: File | undefined) => {
    if (file === undefined) {
      return;
    }
    const result = await globalThis.nefantaris.invoke(
      "content:saveAsset",
      sitePath,
      file.type,
      baseNameFor(file, noun),
      new Uint8Array(await file.arrayBuffer()),
    );
    if (result.status !== "saved") {
      setError(
        `That file can’t be used as the ${noun}. Choose a PNG, JPEG, GIF, WebP, SVG, or AVIF picture.`,
      );
      return;
    }
    setError(null);
    onImageChanged(result.markdownPath);
  };

  return (
    <div className="flex flex-col gap-3">
      {image === "" && <p className="text-ink-muted text-sm">{emptyText}</p>}
      {image !== "" && isSiteImage && (
        <div className="flex items-center gap-3">
          <img
            src={siteAssetUrl(sitePath, image)}
            alt=""
            className="bg-sunken border-line h-20 w-32 rounded-md border object-cover"
          />
          <span className="text-ink-secondary min-w-0 truncate text-sm">
            {fileName}
          </span>
        </div>
      )}
      {image !== "" && !isSiteImage && (
        <p className="text-ink-secondary text-sm break-all">
          Uses a picture from another website: {image}
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
          Add a new image
        </button>
        {image !== "" && (
          <button
            type="button"
            aria-label={`Remove ${noun}`}
            onClick={() => onImageChanged("")}
            className={secondaryButtonClasses}
          >
            Remove
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_TYPES}
          tabIndex={-1}
          aria-hidden="true"
          data-testid={fileInputTestId}
          onChange={(event) => {
            void addImage(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="hidden"
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {isPickerOpen && (
        <ImagePickerModal
          title={pickerTitle}
          sitePath={sitePath}
          images={images}
          selectedPaths={[image]}
          onPicked={(paths) => pickImage(paths[0] ?? image)}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageChooser;
