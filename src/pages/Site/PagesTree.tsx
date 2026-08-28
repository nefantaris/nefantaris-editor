import { useState } from "react";
import type {
  PageTreeFile,
  PageTreeFolder,
  PageTreeNode,
} from "../../../electron/ipcContract.cts";
import { ChevronRightIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { ContentTarget } from "./contentTypes.ts";
import RowActions from "./RowActions.tsx";

type TreeHandlers = {
  selectedPath: string | null;
  onFileSelected: (relativePath: string) => void;
  onRenameRequested: (target: ContentTarget) => void;
  onDeleteRequested: (target: ContentTarget) => void;
};

type PagesTreeProps = TreeHandlers & {
  nodes: PageTreeNode[];
};

type PageItemProps = TreeHandlers & {
  page: PageTreeFile;
};

type FolderItemProps = TreeHandlers & {
  folder: PageTreeFolder;
};

const PageItem = ({ page, ...handlers }: PageItemProps) => {
  const isSelected = handlers.selectedPath === page.relativePath;
  const target: ContentTarget = {
    relativePath: page.relativePath,
    fileName: page.fileName,
    title: page.title,
    kind: "page",
  };

  return (
    <li className="group relative">
      <button
        onClick={() => handlers.onFileSelected(page.relativePath)}
        aria-current={isSelected ? "true" : undefined}
        className={classNames(
          "w-full truncate rounded-md px-2 py-1.5 pr-14 text-left text-sm transition-colors duration-100",
          isSelected
            ? "bg-brand-grayLight text-brand-black font-medium"
            : "text-brand-grayDark hover:bg-brand-grayLight",
        )}
      >
        {page.title}
      </button>
      <RowActions
        target={target}
        onRenameRequested={handlers.onRenameRequested}
        onDeleteRequested={handlers.onDeleteRequested}
      />
    </li>
  );
};

const FolderItem = ({ folder, ...handlers }: FolderItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <li>
      <button
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-brand-grayDark hover:bg-brand-grayLight flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors duration-100"
      >
        <ChevronRightIcon
          className={classNames(
            "shrink-0 transition-transform duration-100",
            isExpanded && "rotate-90",
          )}
        />
        <span className="truncate">{folder.name}</span>
      </button>
      {isExpanded && (
        <ul className="border-brand-grayLight ml-3 flex flex-col gap-0.5 border-l pl-1.5">
          {folder.children.length === 0 ? (
            <li className="text-brand-gray px-2 py-1.5 text-sm">Empty</li>
          ) : (
            folder.children.map((child) =>
              child.kind === "folder" ? (
                <FolderItem
                  key={child.relativePath}
                  folder={child}
                  {...handlers}
                />
              ) : (
                <PageItem key={child.relativePath} page={child} {...handlers} />
              ),
            )
          )}
        </ul>
      )}
    </li>
  );
};

const PagesTree = ({ nodes, ...handlers }: PagesTreeProps) => {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <FolderItem key={node.relativePath} folder={node} {...handlers} />
        ) : (
          <PageItem key={node.relativePath} page={node} {...handlers} />
        ),
      )}
    </ul>
  );
};

export default PagesTree;
