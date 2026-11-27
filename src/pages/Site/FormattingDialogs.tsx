import type { BlockSchema } from "../../../electron/ipcContract.cts";
import { initialBlockValues, insertedAttributes } from "./blockOptionsModel.ts";
import CodeBlockModal from "./CodeBlockModal.tsx";
import { blockInsertionSpec } from "./directiveInsert.ts";
import type { PickedImage } from "./formatting/blockMarkdown.ts";
import {
  imageSource,
  insertCodeBlock,
  insertImage,
  insertTable,
} from "./formatting/blockMarkdown.ts";
import type { EditBuilder, ReplacedText } from "./formatting/editorEdits.ts";
import type { LinkDraft } from "./formatting/linkEditing.ts";
import { applyLink, removeLink } from "./formatting/linkEditing.ts";
import type { ImageListBlock } from "./GalleryModal.tsx";
import GalleryModal from "./GalleryModal.tsx";
import InsertImageModal from "./InsertImageModal.tsx";
import LinkModal from "./LinkModal.tsx";
import type { LinkOptions } from "./siteSettingsModel.ts";
import TableModal from "./TableModal.tsx";

export type FormattingDialog = { trigger: ReplacedText | null } & (
  | { kind: "link"; draft: LinkDraft }
  | { kind: "table" }
  | { kind: "codeBlock" }
  | { kind: "image" }
  | { kind: "gallery"; blockName: string }
);

type FormattingDialogsProps = {
  dialog: FormattingDialog;
  sitePath: string;
  linkOptions: LinkOptions;
  imageBlocks: ImageListBlock[];
  directiveSchemas: Record<string, BlockSchema> | null;
  onApplied: (build: EditBuilder) => void;
  onClose: () => void;
};

function galleryBuilder(
  blockName: string,
  schema: BlockSchema | undefined,
  images: PickedImage[],
): EditBuilder {
  return (state) =>
    blockInsertionSpec(state, {
      name: blockName,
      body: "images",
      attributes:
        schema === undefined
          ? ""
          : insertedAttributes(schema, initialBlockValues(schema)),
      content: images.map((image) => imageSource(image)).join("\n"),
    });
}

const FormattingDialogs = ({
  dialog,
  sitePath,
  linkOptions,
  imageBlocks,
  directiveSchemas,
  onApplied,
  onClose,
}: FormattingDialogsProps) => {
  switch (dialog.kind) {
    case "link": {
      const existing = dialog.draft.existing;
      return (
        <LinkModal
          draft={dialog.draft}
          linkOptions={linkOptions}
          onSubmitted={(text, url) =>
            onApplied(() => applyLink(dialog.draft, text, url))
          }
          onRemoved={() => {
            if (existing !== null) {
              onApplied((state) => removeLink(state, existing));
            }
          }}
          onClose={onClose}
        />
      );
    }
    case "table": {
      return (
        <TableModal
          onChosen={(columns, rows) =>
            onApplied((state) => insertTable(state, columns, rows))
          }
          onClose={onClose}
        />
      );
    }
    case "codeBlock": {
      return (
        <CodeBlockModal
          onSubmitted={(language) =>
            onApplied((state) => insertCodeBlock(state, language))
          }
          onClose={onClose}
        />
      );
    }
    case "image": {
      return (
        <InsertImageModal
          sitePath={sitePath}
          onSubmitted={(image) =>
            onApplied((state) => insertImage(state, image))
          }
          onClose={onClose}
        />
      );
    }
    case "gallery": {
      return (
        <GalleryModal
          sitePath={sitePath}
          blocks={imageBlocks}
          initialBlockName={dialog.blockName}
          onSubmitted={(blockName, images) =>
            onApplied(
              galleryBuilder(blockName, directiveSchemas?.[blockName], images),
            )
          }
          onClose={onClose}
        />
      );
    }
  }
};

export default FormattingDialogs;
