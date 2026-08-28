import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import type {
  ConflictChoice,
  ConflictFileView,
  ContentMutationFailure,
  ContentTree,
  GitSyncSnapshot,
  PageTreeNode,
  PreviewStatus,
  SiteInspection,
  SyncActionOutcome,
  SyncPurpose,
} from "../../../electron/ipcContract.cts";
import SignInModal from "../../components/SignInModal.tsx";
import { classNames } from "../../utils/classNames.ts";
import ConflictModal from "./ConflictModal.tsx";
import type { ContentTarget, EditorPaneControl } from "./contentTypes.ts";
import CreateContentModal, {
  type FolderOption,
} from "./CreateContentModal.tsx";
import DeleteContentModal from "./DeleteContentModal.tsx";
import EditorPane from "./EditorPane.tsx";
import PreviewPane from "./PreviewPane.tsx";
import { previewTargetForFile } from "./previewRoute.ts";
import PublishModal from "./PublishModal.tsx";
import RenameContentModal from "./RenameContentModal.tsx";
import Sidebar from "./Sidebar.tsx";
import SiteStatusBar from "./SiteStatusBar.tsx";
import UpdateBanner from "./UpdateBanner.tsx";
import VersionsModal from "./VersionsModal.tsx";

type SiteProps = {
  siteName: string;
  sitePath: string;
};

type OpenFile = {
  relativePath: string;
  diskText: string;
};

type ModalState =
  | { type: "create"; contentKind: "page" | "post" }
  | { type: "rename"; target: ContentTarget }
  | { type: "delete"; target: ContentTarget }
  | null;

function collectFolderOptions(
  nodes: PageTreeNode[],
  prefix: string,
): FolderOption[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "folder") {
      return [];
    }
    const value = prefix === "" ? node.name : `${prefix}/${node.name}`;
    return [
      { value, label: value },
      ...collectFolderOptions(node.children, value),
    ];
  });
}

const FRONTMATTER_FORM_OPEN_KEY = "nefantaris.frontmatterFormOpen";

function loadFrontmatterFormOpen(): boolean {
  try {
    const stored = globalThis.localStorage.getItem(FRONTMATTER_FORM_OPEN_KEY);
    return stored !== "collapsed";
  } catch {
    return true;
  }
}

function saveFrontmatterFormOpen(isOpen: boolean): void {
  try {
    globalThis.localStorage.setItem(
      FRONTMATTER_FORM_OPEN_KEY,
      isOpen ? "expanded" : "collapsed",
    );
  } catch {
    return;
  }
}

function describeMutationFailure(
  reason: ContentMutationFailure,
  noun: string,
): string {
  switch (reason) {
    case "invalid-name":
      return "That name doesn't work. Use some letters or numbers.";
    case "already-exists":
      return `A ${noun} with that name already exists.`;
    case "not-found":
      return `The ${noun} no longer exists on disk.`;
  }
}

function describeSyncFailure(
  outcome: SyncActionOutcome,
  purpose: SyncPurpose,
): string {
  const verb = purpose === "publish" ? "publish" : "update";
  switch (outcome.status) {
    case "offline":
      return "You're offline. Your edits are saved on this computer — try again when you're back online.";
    case "auth-needed":
      return `You need to sign in before you can ${verb}. Use the Sign in button in the bar below.`;
    case "not-connected":
      return "This site isn't connected to online publishing yet.";
    case "nothing-to-publish":
      return "Everything is already live.";
    default:
      return `Something went wrong while trying to ${verb}. Your edits are safe on this computer.`;
  }
}

const MIN_SPLIT_PANE_PX = 280;

const Site = ({ siteName, sitePath }: SiteProps) => {
  const editorControlRef = useRef<EditorPaneControl | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [tree, setTree] = useState<ContentTree | null>(null);
  const [inspection, setInspection] = useState<SiteInspection | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFrontmatterFormOpen, setIsFrontmatterFormOpen] = useState(
    loadFrontmatterFormOpen,
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({
    state: "stopped",
  });
  const [previewRoute, setPreviewRoute] = useState("/");
  const [previewRatio, setPreviewRatio] = useState(0.5);
  const [syncSnapshot, setSyncSnapshot] = useState<GitSyncSnapshot | null>(
    null,
  );
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [conflictState, setConflictState] = useState<{
    purpose: SyncPurpose;
    files: ConflictFileView[];
  } | null>(null);
  const [dismissedRemoteHead, setDismissedRemoteHead] = useState<string | null>(
    null,
  );
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSignInOffered, setIsSignInOffered] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  const folderOptions: FolderOption[] = [
    { value: "", label: "Top level" },
    ...collectFolderOptions(tree?.pages ?? [], ""),
  ];

  const isDraftFileOpen = openFile
    ? previewTargetForFile(openFile.relativePath, openFile.diskText).kind ===
      "draft"
    : false;

  const isUpdateBannerVisible =
    syncSnapshot !== null &&
    syncSnapshot.connection === "connected" &&
    syncSnapshot.isRemoteAhead &&
    (syncSnapshot.hasLocalEdits || syncSnapshot.isLocalAhead) &&
    syncSnapshot.remoteHead !== dismissedRemoteHead &&
    conflictState === null;

  const changeFrontmatterFormOpen = (isOpen: boolean) => {
    setIsFrontmatterFormOpen(isOpen);
    saveFrontmatterFormOpen(isOpen);
  };

  const refreshTree = async () => {
    setTree(await globalThis.nefantaris.invoke("content:getTree", sitePath));
  };

  const followFileInPreview = (relativePath: string, text: string) => {
    const target = previewTargetForFile(relativePath, text);
    if (target.kind === "route") {
      setPreviewRoute(target.route);
    }
  };

  const openContentFile = async (relativePath: string) => {
    if (openFile?.relativePath === relativePath) {
      return;
    }
    await editorControlRef.current?.flush();
    const result = await globalThis.nefantaris.invoke(
      "content:readFile",
      sitePath,
      relativePath,
    );
    if (result.status === "ok") {
      setOpenFile({ relativePath, diskText: result.text });
      setIsDirty(false);
      followFileInPreview(relativePath, result.text);
    }
  };

  const startPreview = async () => {
    setPreviewStatus(
      await globalThis.nefantaris.invoke("preview:start", sitePath),
    );
  };

  const togglePreview = () => {
    if (isPreviewOpen) {
      setIsPreviewOpen(false);
      return;
    }
    setIsPreviewOpen(true);
    void startPreview();
  };

  const clampPreviewRatio = (ratio: number): number => {
    const width = splitRef.current?.getBoundingClientRect().width ?? 0;
    const minPane = width > 0 ? Math.min(MIN_SPLIT_PANE_PX / width, 0.5) : 0.2;
    return Math.min(Math.max(ratio, minPane), 1 - minPane);
  };

  const resizeSplitFromPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    setPreviewRatio(
      clampPreviewRatio((rect.right - event.clientX) / rect.width),
    );
  };

  const resizeSplitFromKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? 0.05 : -0.05;
    setPreviewRatio(clampPreviewRatio(previewRatio + step));
  };

  const submitCreate = async (
    title: string,
    folder: string,
  ): Promise<string | null> => {
    if (modal?.type !== "create") {
      return null;
    }
    const result =
      modal.contentKind === "page"
        ? await globalThis.nefantaris.invoke(
            "content:createPage",
            sitePath,
            folder,
            title,
          )
        : await globalThis.nefantaris.invoke(
            "content:createPost",
            sitePath,
            title,
          );
    if (result.status === "failed") {
      return describeMutationFailure(result.reason, modal.contentKind);
    }
    setModal(null);
    await refreshTree();
    await openContentFile(result.relativePath);
    return null;
  };

  const submitRename = async (newName: string): Promise<string | null> => {
    if (modal?.type !== "rename") {
      return null;
    }
    const target = modal.target;
    const isOpenTarget = openFile?.relativePath === target.relativePath;
    if (isOpenTarget) {
      await editorControlRef.current?.flush();
    }
    const result = await globalThis.nefantaris.invoke(
      "content:renameFile",
      sitePath,
      target.relativePath,
      newName,
    );
    if (result.status === "failed") {
      return describeMutationFailure(result.reason, target.kind);
    }
    setModal(null);
    await refreshTree();
    if (isOpenTarget) {
      const read = await globalThis.nefantaris.invoke(
        "content:readFile",
        sitePath,
        result.relativePath,
      );
      if (read.status === "ok") {
        setOpenFile({
          relativePath: result.relativePath,
          diskText: read.text,
        });
        setIsDirty(false);
      }
    }
    return null;
  };

  const confirmDelete = async () => {
    if (modal?.type !== "delete") {
      return;
    }
    const target = modal.target;
    if (openFile?.relativePath === target.relativePath) {
      editorControlRef.current?.cancelPendingSave();
      setOpenFile(null);
      setIsDirty(false);
    }
    await globalThis.nefantaris.invoke(
      "content:deleteFile",
      sitePath,
      target.relativePath,
    );
    setModal(null);
    await refreshTree();
  };

  const submitPublish = async (note: string): Promise<string | null> => {
    await editorControlRef.current?.flush();
    const trimmedNote = note.trim();
    const outcome = await globalThis.nefantaris.invoke(
      "publish:run",
      sitePath,
      trimmedNote === "" ? null : trimmedNote,
    );
    if (outcome.status === "done") {
      setIsPublishModalOpen(false);
      return null;
    }
    if (outcome.status === "conflicts") {
      setIsPublishModalOpen(false);
      setConflictState({ purpose: outcome.purpose, files: outcome.files });
      return null;
    }
    if (outcome.status === "auth-needed") {
      setIsSignInOffered(true);
    }
    return describeSyncFailure(outcome, "publish");
  };

  const startUpdateFromOnline = async () => {
    setUpdateError(null);
    await editorControlRef.current?.flush();
    const outcome = await globalThis.nefantaris.invoke("sync:update", sitePath);
    if (outcome.status === "conflicts") {
      setConflictState({ purpose: outcome.purpose, files: outcome.files });
    } else if (outcome.status !== "done") {
      if (outcome.status === "auth-needed") {
        setIsSignInOffered(true);
      }
      setUpdateError(describeSyncFailure(outcome, "update"));
    }
  };

  const finishConflictResolution = async (
    choices: ConflictChoice[],
  ): Promise<string | null> => {
    const purpose = conflictState?.purpose ?? "publish";
    const outcome = await globalThis.nefantaris.invoke(
      "merge:complete",
      sitePath,
      choices,
    );
    if (outcome.status === "done") {
      setConflictState(null);
      return null;
    }
    if (outcome.status === "conflicts") {
      setConflictState({ purpose: outcome.purpose, files: outcome.files });
      return "Your site changed online again while you were choosing. Take another look.";
    }
    return describeSyncFailure(outcome, purpose);
  };

  const cancelConflictResolution = async () => {
    await globalThis.nefantaris.invoke("merge:cancel", sitePath);
    setConflictState(null);
  };

  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  useEffect(() => {
    const loadInitialData = async () => {
      setTree(await globalThis.nefantaris.invoke("content:getTree", sitePath));
      setPreviewStatus(
        await globalThis.nefantaris.invoke("preview:getStatus", sitePath),
      );
      setSyncSnapshot(await globalThis.nefantaris.invoke("sync:get", sitePath));
      setInspection(
        await globalThis.nefantaris.invoke("site:inspect", sitePath),
      );
    };
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return globalThis.nefantaris.on("preview:status", (payload) => {
      if (payload.sitePath === sitePath) {
        setPreviewStatus(payload.status);
      }
    });
  }, [sitePath]);

  useEffect(() => {
    return globalThis.nefantaris.on("sync:changed", (payload) => {
      if (payload.sitePath === sitePath) {
        setSyncSnapshot(payload.snapshot);
      }
    });
  }, [sitePath]);

  useEffect(() => {
    return globalThis.nefantaris.on("auth:statusChanged", () =>
      setIsSignInOffered(false),
    );
  }, []);

  useEffect(() => {
    const checkSyncOnFocus = () => {
      void globalThis.nefantaris.invoke("sync:check", sitePath);
    };
    globalThis.addEventListener("focus", checkSyncOnFocus);
    return () => globalThis.removeEventListener("focus", checkSyncOnFocus);
  }, [sitePath]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isToggleShortcut =
        event.key.toLowerCase() === "e" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey;
      if (!isToggleShortcut) {
        return;
      }
      event.preventDefault();
      togglePreview();
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewOpen]);

  useEffect(() => {
    const handleExternalChange = async () => {
      await refreshTree();
      if (!openFile) {
        return;
      }
      const result = await globalThis.nefantaris.invoke(
        "content:readFile",
        sitePath,
        openFile.relativePath,
      );
      if (result.status === "ok") {
        setOpenFile({
          relativePath: openFile.relativePath,
          diskText: result.text,
        });
        followFileInPreview(openFile.relativePath, result.text);
      } else if (!isDirty) {
        setOpenFile(null);
      }
    };
    return globalThis.nefantaris.on("content:changed", (payload) => {
      if (payload.sitePath !== sitePath) {
        return;
      }
      void globalThis.nefantaris.invoke("sync:get", sitePath);
      void handleExternalChange();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePath, openFile, isDirty]);

  return (
    <div className="bg-brand-white flex h-screen flex-col">
      <a
        href="#editor"
        className="bg-brand-primary text-brand-white sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to editor
      </a>
      {isUpdateBannerVisible && (
        <UpdateBanner
          error={updateError}
          isUpdating={syncSnapshot.activity === "updating"}
          onUpdateRequested={() => void startUpdateFromOnline()}
          onDismissed={() => setDismissedRemoteHead(syncSnapshot.remoteHead)}
        />
      )}
      <div className="flex min-h-0 grow">
        <Sidebar
          tree={tree}
          selectedPath={openFile?.relativePath ?? null}
          onFileSelected={(relativePath) => void openContentFile(relativePath)}
          onCreateRequested={(contentKind) =>
            setModal({ type: "create", contentKind })
          }
          onRenameRequested={(target) => setModal({ type: "rename", target })}
          onDeleteRequested={(target) => setModal({ type: "delete", target })}
        />
        <div ref={splitRef} className="flex min-w-0 grow">
          <main
            id="editor"
            className={classNames(
              "bg-brand-white min-w-0",
              isPreviewOpen ? "shrink-0" : "grow",
            )}
            style={
              isPreviewOpen
                ? { width: `${(1 - previewRatio) * 100}%` }
                : undefined
            }
          >
            {openFile ? (
              <EditorPane
                key={openFile.relativePath}
                sitePath={sitePath}
                relativePath={openFile.relativePath}
                diskText={openFile.diskText}
                inspection={inspection}
                isFrontmatterFormOpen={isFrontmatterFormOpen}
                onFrontmatterFormOpenChanged={changeFrontmatterFormOpen}
                controlRef={editorControlRef}
                onDirtyChanged={setIsDirty}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-brand-gray">
                  Select a page or post to start writing.
                </p>
              </div>
            )}
          </main>
          {isPreviewOpen && (
            <>
              <button
                aria-label="Resize preview"
                onPointerDown={(event) =>
                  event.currentTarget.setPointerCapture(event.pointerId)
                }
                onPointerMove={resizeSplitFromPointer}
                onKeyDown={resizeSplitFromKeyboard}
                className="bg-brand-border hover:bg-brand-primary w-1 shrink-0 cursor-col-resize rounded-none transition-colors duration-100"
              />
              <div className="min-w-0 grow">
                <PreviewPane
                  status={previewStatus}
                  route={previewRoute}
                  isDraftNoteVisible={isDraftFileOpen}
                  onCloseRequested={() => setIsPreviewOpen(false)}
                  onRetryRequested={() => void startPreview()}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <SiteStatusBar
        siteName={siteName}
        isFileOpen={openFile !== null}
        isDirty={isDirty}
        syncSnapshot={syncSnapshot}
        isPreviewOpen={isPreviewOpen}
        isSignInOffered={isSignInOffered}
        onTogglePreview={togglePreview}
        onPublishRequested={() => setIsPublishModalOpen(true)}
        onVersionsRequested={() => setIsVersionsOpen(true)}
        onSignInRequested={() => setIsSignInModalOpen(true)}
      />
      {modal?.type === "create" && (
        <CreateContentModal
          contentKind={modal.contentKind}
          folders={folderOptions}
          onSubmit={submitCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "rename" && (
        <RenameContentModal
          target={modal.target}
          onSubmit={submitRename}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteContentModal
          target={modal.target}
          onConfirm={confirmDelete}
          onClose={() => setModal(null)}
        />
      )}
      {isPublishModalOpen && (
        <PublishModal
          onSubmit={submitPublish}
          onClose={() => setIsPublishModalOpen(false)}
        />
      )}
      {isVersionsOpen && (
        <VersionsModal
          sitePath={sitePath}
          onClose={() => setIsVersionsOpen(false)}
        />
      )}
      {isSignInModalOpen && (
        <SignInModal onClose={() => setIsSignInModalOpen(false)} />
      )}
      {conflictState && (
        <ConflictModal
          key={conflictState.files.map((file) => file.relativePath).join("|")}
          purpose={conflictState.purpose}
          files={conflictState.files}
          onFinish={finishConflictResolution}
          onCancel={() => void cancelConflictResolution()}
        />
      )}
    </div>
  );
};

export default Site;
