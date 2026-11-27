import type { Extension } from "@codemirror/state";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  BlockSchema,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import type { BlockChoice } from "./blockGroups.ts";
import { blockChoicesFrom, blockGroupsFrom } from "./blockGroups.ts";
import BlockOptionsModal from "./BlockOptionsModal.tsx";
import type {
  BlockFormValues,
  WrittenBlockOptions,
} from "./blockOptionsModel.ts";
import {
  attributeReplacements,
  hasBlockOptions,
  initialBlockValues,
  insertedAttributes,
  labelEdit,
  writtenBlockOptions,
} from "./blockOptionsModel.ts";
import type { EditorPaneControl, RevealRequest } from "./contentTypes.ts";
import {
  blockAtLine,
  blockInsertionSpec,
  rewriteBlock,
  type BlockAtLine,
} from "./directiveInsert.ts";
import {
  createEditorExtensions,
  detectLineSeparator,
} from "./editorExtensions.ts";
import { insertDivider } from "./formatting/blockMarkdown.ts";
import type { EditorCommand } from "./formatting/editorCommands.ts";
import {
  BLOCK_SLASH_PREFIX,
  builtInSlashItems,
  isEditorCommand,
} from "./formatting/editorCommands.ts";
import type { EditBuilder, ReplacedText } from "./formatting/editorEdits.ts";
import { dispatchEdit, removeTrigger } from "./formatting/editorEdits.ts";
import type { FormattingState } from "./formatting/formattingState.ts";
import {
  formattingStateOf,
  isSameFormatting,
  unavailableFormatting,
} from "./formatting/formattingState.ts";
import type { InlineStyle } from "./formatting/inlineFormatting.ts";
import { toggleInlineStyle } from "./formatting/inlineFormatting.ts";
import type { HeadingLevel, ListOrQuote } from "./formatting/lineFormatting.ts";
import {
  setHeadingLevel,
  toggleLineFormat,
} from "./formatting/lineFormatting.ts";
import { linkDraftFor } from "./formatting/linkEditing.ts";
import { isFormattingBlocked } from "./formatting/markdownContext.ts";
import { revealLine } from "./formatting/revealLine.ts";
import type { SlashItem } from "./formatting/slashMenu.ts";
import {
  FIRST_BLOCK_SECTION_RANK,
  slashItemsFacet,
} from "./formatting/slashMenu.ts";
import type { FormattingDialog } from "./FormattingDialogs.tsx";
import FormattingDialogs from "./FormattingDialogs.tsx";
import FormattingToolbar from "./FormattingToolbar.tsx";
import type { ContentFileKind, FrontmatterEdit } from "./frontmatterEditing.ts";
import {
  applyFrontmatterEdit,
  frontmatterYamlFromState,
  frontmatterYamlFromText,
  isFrontmatterEditable,
} from "./frontmatterEditing.ts";
import {
  frontmatterBodyStart,
  frontmatterHiding,
  trustedDocChange,
} from "./frontmatterHiding.ts";
import FrontmatterPanel from "./FrontmatterPanel.tsx";
import type { ImageListBlock } from "./GalleryModal.tsx";
import InsertDirectiveModal from "./InsertDirectiveModal.tsx";
import type { BlockSchemas } from "./livePreview/blockFacets.ts";
import { blockSchemasFacet } from "./livePreview/blockFacets.ts";
import { computeFrontmatter } from "./livePreview/documentRegions.ts";
import type { LinkOptions } from "./siteSettingsModel.ts";

const AUTOSAVE_DELAY_MS = 500;

type EditorPaneProps = {
  sitePath: string;
  relativePath: string;
  diskText: string;
  inspection: SiteInspection | null;
  linkOptions: LinkOptions;
  isFrontmatterFormOpen: boolean;
  onFrontmatterFormOpenChanged: (isOpen: boolean) => void;
  controlRef: RefObject<EditorPaneControl | null>;
  revealRequest: RevealRequest | null;
  onDirtyChanged: (isDirty: boolean) => void;
};

type BlockFormState =
  | {
      mode: "insert";
      name: string;
      schema: BlockSchema;
      trigger: ReplacedText | null;
    }
  | {
      mode: "edit";
      block: BlockAtLine;
      schema: BlockSchema;
      original: WrittenBlockOptions;
    };

const headingCommands: Partial<Record<EditorCommand, HeadingLevel>> = {
  paragraph: 0,
  heading2: 2,
  heading3: 3,
  heading4: 4,
};

const inlineCommands: Partial<Record<EditorCommand, InlineStyle>> = {
  bold: "bold",
  italic: "italic",
  strikethrough: "strikethrough",
  code: "code",
};

const lineCommands: Partial<Record<EditorCommand, ListOrQuote>> = {
  bullet: "bullet",
  numbered: "numbered",
  task: "task",
  quote: "quote",
};

function formattingEditFor(command: EditorCommand): EditBuilder | null {
  const headingLevel = headingCommands[command];
  if (headingLevel !== undefined) {
    return (state) => setHeadingLevel(state, headingLevel);
  }
  const inlineStyle = inlineCommands[command];
  if (inlineStyle !== undefined) {
    return (state) => toggleInlineStyle(state, inlineStyle);
  }
  const lineFormat = lineCommands[command];
  if (lineFormat !== undefined) {
    return (state) => toggleLineFormat(state, lineFormat);
  }
  return command === "divider" ? insertDivider : null;
}

function imageBlocksOf(schemas: BlockSchemas | null): ImageListBlock[] {
  return Object.entries(schemas ?? {}).flatMap(([name, schema]) =>
    schema.body === "images" ? [{ name, label: schema.label }] : [],
  );
}

function slashItemsFor(blocks: BlockChoice[]): SlashItem[] {
  return [
    ...builtInSlashItems,
    ...blockGroupsFrom(blocks).flatMap((group, groupIndex) =>
      group.blocks.map((block): SlashItem => ({
        id: `${BLOCK_SLASH_PREFIX}${block.name}`,
        label: block.label,
        description: block.description,
        keywords: `${block.name} block`,
        section: {
          name: group.title,
          rank: FIRST_BLOCK_SECTION_RANK + groupIndex,
        },
      })),
    ),
  ];
}

function editorConfiguration(
  schemas: BlockSchemas | null,
  blocks: BlockChoice[],
): Extension {
  return [
    blockSchemasFacet.of(schemas),
    slashItemsFacet.of(slashItemsFor(blocks)),
  ];
}

function baseNameForImage(file: File): string {
  const stem = file.name.replace(/\.[^.]*$/, "");
  return stem === "" || stem.toLowerCase() === "image" ? "pasted-image" : stem;
}

const EditorPane = ({
  sitePath,
  relativePath,
  diskText,
  inspection,
  linkOptions,
  isFrontmatterFormOpen,
  onFrontmatterFormOpenChanged,
  controlRef,
  revealRequest,
  onDirtyChanged,
}: EditorPaneProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const savedTextRef = useRef(diskText);
  const saveTimerRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);
  const hidingCompartmentRef = useRef(new Compartment());
  const schemasCompartmentRef = useRef(new Compartment());
  const appliedRevealIdRef = useRef<number | null>(null);
  const [frontmatterYaml, setFrontmatterYaml] = useState<string | null>(() =>
    frontmatterYamlFromText(diskText),
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState | null>(null);
  const [formattingDialog, setFormattingDialog] =
    useState<FormattingDialog | null>(null);
  const [formatting, setFormatting] = useState<FormattingState>(
    unavailableFormatting,
  );

  const fileKind: ContentFileKind = relativePath.startsWith("content/posts/")
    ? "post"
    : "page";
  const isHidingActive =
    isFrontmatterFormOpen && isFrontmatterEditable(frontmatterYaml);
  const directiveSchemas = inspection?.directiveSchemas ?? null;
  const blockChoices = blockChoicesFrom(inspection);
  const imageBlocks = imageBlocksOf(directiveSchemas);

  const handleFieldEdit = (edit: FrontmatterEdit) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const nextYaml = applyFrontmatterEdit(
      frontmatterYamlFromState(view.state),
      edit,
    );
    if (nextYaml === null) {
      return;
    }
    const separator = view.state.lineBreak;
    const yamlLines =
      nextYaml === "" ? [] : nextYaml.replace(/\n$/, "").split("\n");
    const block = ["---", ...yamlLines, "---"].join(separator);
    const region = computeFrontmatter(view.state.doc);
    view.dispatch({
      changes: region
        ? { from: region.from, to: region.to, insert: block }
        : { from: 0, insert: block + separator },
      annotations: trustedDocChange.of(true),
    });
  };

  const focusEditorAfterPaletteCloses = () => {
    globalThis.setTimeout(() => viewRef.current?.focus(), 0);
  };

  const pickBlock = (name: string, trigger: ReplacedText | null) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const schema = view.state.facet(blockSchemasFacet)?.[name];
    if (schema?.body === "images") {
      setFormattingDialog({ kind: "gallery", blockName: name, trigger });
      return;
    }
    if (schema !== undefined && hasBlockOptions(schema)) {
      setBlockForm({ mode: "insert", name, schema, trigger });
      return;
    }
    dispatchEdit(
      view,
      (state) =>
        blockInsertionSpec(state, {
          name,
          body: schema?.body ?? "markdown",
          attributes: "",
          content: schema?.placeholder ?? null,
        }),
      trigger,
    );
    focusEditorAfterPaletteCloses();
  };

  const handleDirectivePicked = (name: string) => {
    setIsPaletteOpen(false);
    pickBlock(name, null);
  };

  const openDialogUnlessBlocked = (
    view: EditorView,
    dialog: FormattingDialog,
  ) => {
    if (dialog.trigger === null && isFormattingBlocked(view.state)) {
      return;
    }
    setFormattingDialog(dialog);
  };

  const openLinkDialog = (view: EditorView, trigger: ReplacedText | null) => {
    openDialogUnlessBlocked(view, {
      kind: "link",
      trigger,
      draft:
        trigger === null
          ? linkDraftFor(view.state)
          : {
              text: "",
              url: "",
              range: { from: trigger.from, to: trigger.from },
              existing: null,
            },
    });
  };

  const openGalleryDialog = (
    view: EditorView,
    trigger: ReplacedText | null,
  ) => {
    const [first] = imageBlocksOf(view.state.facet(blockSchemasFacet));
    if (first !== undefined) {
      openDialogUnlessBlocked(view, {
        kind: "gallery",
        blockName: first.name,
        trigger,
      });
    }
  };

  const runCommand = (
    command: EditorCommand,
    trigger: ReplacedText | null = null,
  ) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const build = formattingEditFor(command);
    if (build !== null) {
      dispatchEdit(view, build, trigger);
      view.focus();
      return;
    }
    switch (command) {
      case "insertBlock": {
        setIsPaletteOpen(true);
        break;
      }
      case "link": {
        openLinkDialog(view, trigger);
        break;
      }
      case "gallery": {
        openGalleryDialog(view, trigger);
        break;
      }
      case "table":
      case "codeBlock":
      case "image": {
        openDialogUnlessBlocked(view, { kind: command, trigger });
        break;
      }
    }
  };

  const chooseHeading = (level: HeadingLevel) => {
    const view = viewRef.current;
    if (view) {
      dispatchEdit(view, (state) => setHeadingLevel(state, level));
      view.focus();
    }
  };

  const handleSlashPicked = (id: string, trigger: ReplacedText) => {
    if (id.startsWith(BLOCK_SLASH_PREFIX)) {
      pickBlock(id.slice(BLOCK_SLASH_PREFIX.length), trigger);
    } else if (isEditorCommand(id)) {
      runCommand(id, trigger);
    }
  };

  const applyFormattingDialog = (build: EditBuilder) => {
    const view = viewRef.current;
    const trigger = formattingDialog?.trigger ?? null;
    setFormattingDialog(null);
    if (view) {
      dispatchEdit(view, build, trigger);
    }
    focusEditorAfterPaletteCloses();
  };

  const closeFormattingDialog = () => {
    const view = viewRef.current;
    const trigger = formattingDialog?.trigger ?? null;
    setFormattingDialog(null);
    if (view && trigger !== null) {
      removeTrigger(view, trigger);
    }
    focusEditorAfterPaletteCloses();
  };

  const openBlockOptions = (lineFrom: number) => {
    const view = viewRef.current;
    const block = view ? blockAtLine(view.state, lineFrom) : null;
    if (!view || block === null) {
      return;
    }
    const schema = view.state.facet(blockSchemasFacet)?.[block.name];
    if (schema === undefined || !hasBlockOptions(schema)) {
      return;
    }
    setBlockForm({
      mode: "edit",
      block,
      schema,
      original: writtenBlockOptions(schema, block.attributes, block.label),
    });
  };

  const submitBlockForm = (values: BlockFormValues, text: string) => {
    const view = viewRef.current;
    const form = blockForm;
    setBlockForm(null);
    if (!view || form === null) {
      return;
    }
    if (form.mode === "insert") {
      dispatchEdit(
        view,
        (state) =>
          blockInsertionSpec(state, {
            name: form.name,
            body: form.schema.body,
            attributes: insertedAttributes(form.schema, values),
            content: form.schema.placeholder,
            label: labelEdit(form.schema, text, null) ?? null,
          }),
        form.trigger,
      );
    } else {
      rewriteBlock(view, form.block, {
        attributes: attributeReplacements(form.schema, values, form.original),
        label: labelEdit(form.schema, text, form.original),
      });
    }
    focusEditorAfterPaletteCloses();
  };

  const closeBlockForm = () => {
    const view = viewRef.current;
    const trigger = blockForm?.mode === "insert" ? blockForm.trigger : null;
    setBlockForm(null);
    if (view && trigger !== null) {
      removeTrigger(view, trigger);
    }
    focusEditorAfterPaletteCloses();
  };

  const closePalette = () => {
    setIsPaletteOpen(false);
    focusEditorAfterPaletteCloses();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const currentText = () =>
      viewRef.current?.state.sliceDoc() ?? savedTextRef.current;

    const reportDirty = () => {
      onDirtyChanged(currentText() !== savedTextRef.current);
    };

    const clearSaveTimer = () => {
      if (saveTimerRef.current === null) {
        return;
      }
      globalThis.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };

    const flush = async () => {
      clearSaveTimer();
      if (isCancelledRef.current) {
        return;
      }
      const text = currentText();
      if (text === savedTextRef.current) {
        return;
      }
      savedTextRef.current = text;
      await globalThis.nefantaris.invoke(
        "content:writeFile",
        sitePath,
        relativePath,
        text,
      );
      reportDirty();
    };

    const scheduleSave = () => {
      clearSaveTimer();
      saveTimerRef.current = globalThis.setTimeout(() => {
        saveTimerRef.current = null;
        void flush();
      }, AUTOSAVE_DELAY_MS);
    };

    const refreshFrontmatter = () => {
      const state = viewRef.current?.state;
      if (state) {
        setFrontmatterYaml(frontmatterYamlFromState(state));
      }
    };

    const insertImage = async (view: EditorView, file: File, pos: number) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await globalThis.nefantaris.invoke(
        "content:saveAsset",
        sitePath,
        file.type,
        baseNameForImage(file),
        bytes,
      );
      if (result.status !== "saved") {
        return;
      }
      const insertAt = Math.min(pos, view.state.doc.length);
      const reference = `![](${result.markdownPath})`;
      view.dispatch({
        changes: { from: insertAt, insert: reference },
        selection: { anchor: insertAt + reference.length },
      });
      view.focus();
    };

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: diskText,
        extensions: [
          createEditorExtensions({
            sitePath,
            lineSeparator: detectLineSeparator(diskText),
            onDocChanged: () => {
              reportDirty();
              scheduleSave();
              refreshFrontmatter();
            },
            onSelectionOrDocChanged: (changedView) => {
              const next = formattingStateOf(changedView.state);
              setFormatting((current) =>
                isSameFormatting(current, next) ? current : next,
              );
            },
            onImageFile: (imageView, file, pos) => {
              void insertImage(imageView, file, pos);
            },
            onInsertDirectiveRequested: () => setIsPaletteOpen(true),
            onBlockOptionsRequested: openBlockOptions,
            onCommandRequested: (command) => runCommand(command),
            onSlashPicked: (_slashView, id, trigger) =>
              handleSlashPicked(id, trigger),
          }),
          hidingCompartmentRef.current.of(
            isHidingActive ? frontmatterHiding : [],
          ),
          schemasCompartmentRef.current.of(
            editorConfiguration(directiveSchemas, blockChoices),
          ),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    view.dispatch({
      selection: {
        anchor: isHidingActive ? frontmatterBodyStart(view.state) : 0,
      },
    });

    const flushOnWindowEvent = () => {
      void flush();
    };
    globalThis.addEventListener("blur", flushOnWindowEvent);
    globalThis.addEventListener("beforeunload", flushOnWindowEvent);

    controlRef.current = {
      flush,
      cancelPendingSave: () => {
        isCancelledRef.current = true;
        clearSaveTimer();
      },
    };

    return () => {
      globalThis.removeEventListener("blur", flushOnWindowEvent);
      globalThis.removeEventListener("beforeunload", flushOnWindowEvent);
      controlRef.current = null;
      void flush();
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: hidingCompartmentRef.current.reconfigure(
        isHidingActive ? frontmatterHiding : [],
      ),
    });
    if (isHidingActive) {
      const bodyStart = frontmatterBodyStart(view.state);
      if (view.state.selection.main.from < bodyStart) {
        view.dispatch({ selection: { anchor: bodyStart } });
      }
    }
  }, [isHidingActive]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: schemasCompartmentRef.current.reconfigure(
        editorConfiguration(directiveSchemas, blockChoices),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection]);

  useEffect(() => {
    const view = viewRef.current;
    if (
      !view ||
      revealRequest === null ||
      revealRequest.relativePath !== relativePath ||
      appliedRevealIdRef.current === revealRequest.id
    ) {
      return;
    }
    appliedRevealIdRef.current = revealRequest.id;
    revealLine(view, revealRequest.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealRequest]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || diskText === savedTextRef.current) {
      return;
    }
    if (view.state.sliceDoc() !== savedTextRef.current) {
      return;
    }
    savedTextRef.current = diskText;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: diskText },
      annotations: trustedDocChange.of(true),
    });
    onDirtyChanged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskText]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FrontmatterPanel
        fileKind={fileKind}
        frontmatterYaml={frontmatterYaml}
        templates={inspection ? inspection.templates : null}
        isOpen={isFrontmatterFormOpen}
        onOpenChanged={onFrontmatterFormOpenChanged}
        onEdit={handleFieldEdit}
      />
      <FormattingToolbar
        formatting={formatting}
        hasGallery={imageBlocks.length > 0}
        hasBlocks={blockChoices.length > 0}
        onCommand={(command) => runCommand(command)}
        onHeadingChosen={chooseHeading}
      />
      <div ref={hostRef} className="min-h-0 grow" />
      {isPaletteOpen && (
        <InsertDirectiveModal
          blocks={blockChoices}
          onPicked={handleDirectivePicked}
          onClose={closePalette}
        />
      )}
      {formattingDialog !== null && (
        <FormattingDialogs
          dialog={formattingDialog}
          sitePath={sitePath}
          linkOptions={linkOptions}
          imageBlocks={imageBlocks}
          directiveSchemas={directiveSchemas}
          onApplied={applyFormattingDialog}
          onClose={closeFormattingDialog}
        />
      )}
      {blockForm !== null && (
        <BlockOptionsModal
          key={
            blockForm.mode === "insert"
              ? `insert:${blockForm.name}`
              : `edit:${blockForm.block.lineFrom}`
          }
          sitePath={sitePath}
          schema={blockForm.schema}
          mode={blockForm.mode}
          initialValues={
            blockForm.mode === "insert"
              ? initialBlockValues(blockForm.schema)
              : blockForm.original.values
          }
          initialText={
            blockForm.mode === "insert" ? "" : blockForm.original.text
          }
          original={blockForm.mode === "insert" ? null : blockForm.original}
          linkOptions={linkOptions}
          onSubmit={submitBlockForm}
          onClose={closeBlockForm}
        />
      )}
    </div>
  );
};

export default EditorPane;
