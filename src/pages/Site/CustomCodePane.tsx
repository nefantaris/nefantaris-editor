import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type {
  PreviewProblem,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import { CloseIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import ComponentsTab from "./ComponentsTab.tsx";
import type { EditorPaneControl } from "./contentTypes.ts";
import PreviewProblemNotice from "./PreviewProblemNotice.tsx";
import { iconButtonClasses } from "./settingsStyles.ts";
import StylesTab from "./StylesTab.tsx";

type CustomCodeTab = "css" | "components";

type CustomCodePaneProps = {
  sitePath: string;
  inspection: SiteInspection | null;
  previewProblem: PreviewProblem | null;
  controlRef: RefObject<EditorPaneControl | null>;
  cssDraftRef: RefObject<string | null>;
  onDirtyChanged: (isDirty: boolean) => void;
  onCssDraftHeld: (isHeld: boolean) => void;
  onCloseRequested: () => void;
};

const tabs: { tab: CustomCodeTab; label: string }[] = [
  { tab: "css", label: "CSS" },
  { tab: "components", label: "Components" },
];

const tabKeySteps: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

const CustomCodePane = ({
  sitePath,
  inspection,
  previewProblem,
  controlRef,
  cssDraftRef,
  onDirtyChanged,
  onCssDraftHeld,
  onCloseRequested,
}: CustomCodePaneProps) => {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState<CustomCodeTab>("css");

  const tabId = (tab: CustomCodeTab) => `${baseId}-${tab}-tab`;
  const panelId = `${baseId}-panel`;

  const selectTab = async (tab: CustomCodeTab) => {
    if (tab === activeTab) {
      return;
    }
    await controlRef.current?.flush();
    setActiveTab(tab);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const step = tabKeySteps[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const target = step(index, tabs.length);
    tabRefs.current[target]?.focus();
    void selectTab(tabs[target].tab);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-ink text-xl font-semibold">Custom code</h1>
            <p className="text-ink-muted text-sm">
              Go further than your theme&rsquo;s design choices: add your own
              CSS, or change your theme&rsquo;s components themselves.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close custom code"
            onClick={onCloseRequested}
            className={iconButtonClasses}
          >
            <CloseIcon />
          </button>
        </div>
        <div
          role="tablist"
          aria-label="Custom code"
          className="border-line flex gap-1 border-b"
        >
          {tabs.map(({ tab, label }, index) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={tabId(tab)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => void selectTab(tab)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={classNames(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-100",
                  isActive
                    ? "border-primary text-ink"
                    : "text-ink-muted hover:text-ink border-transparent",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {previewProblem !== null && (
          <PreviewProblemNotice problem={previewProblem} />
        )}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        className="flex min-h-0 grow flex-col"
      >
        {activeTab === "css" ? (
          <StylesTab
            sitePath={sitePath}
            inspection={inspection}
            controlRef={controlRef}
            cssDraftRef={cssDraftRef}
            onDirtyChanged={onDirtyChanged}
            onCssDraftHeld={onCssDraftHeld}
          />
        ) : (
          <ComponentsTab
            sitePath={sitePath}
            inspection={inspection}
            controlRef={controlRef}
            onDirtyChanged={onDirtyChanged}
          />
        )}
      </div>
    </div>
  );
};

export default CustomCodePane;
