import { useEffect, useState, type RefObject } from "react";
import type {
  SiteInspection,
  StyleFinding,
  ThemePart,
  ThemeSettingDefinition,
  ThemeStyleToken,
} from "../../../electron/ipcContract.cts";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import { unfinishedCssLine } from "./codeEditor/codeLint.ts";
import type { SaveGuard } from "./codeEditor/useDocumentAutosave.ts";
import CodeFileEditor from "./CodeFileEditor.tsx";
import type { EditorPaneControl } from "./contentTypes.ts";

type StylesTabProps = {
  sitePath: string;
  inspection: SiteInspection | null;
  controlRef: RefObject<EditorPaneControl | null>;
  cssDraftRef: RefObject<string | null>;
  onDirtyChanged: (isDirty: boolean) => void;
  onCssDraftHeld: (isHeld: boolean) => void;
};

const FINDINGS_DELAY_MS = 800;
const noParts: Record<string, ThemePart> = {};
const noSettings: Record<string, ThemeSettingDefinition> = {};

const StylesTab = ({
  sitePath,
  inspection,
  controlRef,
  cssDraftRef,
  onDirtyChanged,
  onCssDraftHeld,
}: StylesTabProps) => {
  const [diskText, setDiskText] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ThemeStyleToken[]>([]);
  const [findings, setFindings] = useState<StyleFinding[]>([]);
  const [unfinishedLine, setUnfinishedLine] = useState<number | null>(null);
  const [draftAtOpen, setDraftAtOpen] = useState<string | null>(null);

  const styleVocabulary = {
    tokens,
    parts: inspection?.parts ?? noParts,
    settings: inspection?.settings ?? noSettings,
  };

  const loadFindings = async () => {
    setFindings(
      await globalThis.nefantaris.invoke("customCss:findings", sitePath),
    );
  };

  const refreshFindings = useDebouncedCallback(() => {
    void loadFindings();
  }, FINDINGS_DELAY_MS);

  const saveGuard: SaveGuard = {
    unfinishedLine: unfinishedCssLine,
    onHeldChanged: (held) => {
      cssDraftRef.current = held?.text ?? null;
      setUnfinishedLine(held?.line ?? null);
      onCssDraftHeld(held !== null);
    },
  };

  const save = async (text: string) => {
    await globalThis.nefantaris.invoke("customCss:write", sitePath, text);
    refreshFindings.schedule();
  };

  useEffect(() => {
    const loadStylesheet = async () => {
      const text = await globalThis.nefantaris.invoke(
        "customCss:read",
        sitePath,
      );
      setDraftAtOpen(cssDraftRef.current);
      setDiskText(text);
      setTokens(
        await globalThis.nefantaris.invoke("customCss:themeTokens", sitePath),
      );
      await loadFindings();
    };
    void loadStylesheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePath]);

  useEffect(() => {
    return globalThis.nefantaris.on("customCss:changed", (payload) => {
      if (payload.sitePath !== sitePath) {
        return;
      }
      void (async () => {
        setDiskText(
          await globalThis.nefantaris.invoke("customCss:read", sitePath),
        );
      })();
    });
  }, [sitePath]);

  return (
    <div className="flex min-h-0 grow flex-col gap-3 px-6 pt-4 pb-6">
      <p className="text-ink-muted text-sm">
        Your own CSS, added after your theme&rsquo;s styles so it wins. Changes
        show in the preview as you type, once each rule is finished. Type{" "}
        <code>[</code> to pick a part of your theme, or <code>var(--</code> to
        use one of its colours and sizes. Clear everything here to go back to
        your theme&rsquo;s look.
      </p>
      {unfinishedLine !== null && (
        <p role="status" className="text-danger text-sm font-medium">
          {`Not saved yet: finish the rule on line ${unfinishedLine}`}
        </p>
      )}
      <div className="border-line focus-within:ring-primary min-h-0 grow overflow-hidden rounded-md border focus-within:ring-2">
        {diskText === null ? (
          <p className="text-ink-muted p-4 text-sm">Opening your CSS…</p>
        ) : (
          <CodeFileEditor
            label="Custom CSS"
            language="css"
            diskText={diskText}
            initialDraft={draftAtOpen}
            saveGuard={saveGuard}
            styleVocabulary={styleVocabulary}
            notes={findings}
            controlRef={controlRef}
            onSave={save}
            onDirtyChanged={onDirtyChanged}
          />
        )}
      </div>
      {findings.length > 0 && (
        <ul
          aria-label="Notes about your CSS"
          className="flex flex-col gap-1 text-sm"
        >
          {findings.map((finding) => (
            <li
              key={`${finding.line ?? 0}:${finding.message}`}
              className="text-ink-secondary"
            >
              {finding.line === null ? "" : `Line ${finding.line}: `}
              {finding.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StylesTab;
