import type { ContentTree } from "../../../electron/ipcContract.cts";
import { PlusIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { ContentTarget } from "./contentTypes.ts";
import PagesTree from "./PagesTree.tsx";
import RowActions from "./RowActions.tsx";

type SidebarProps = {
  tree: ContentTree | null;
  selectedPath: string | null;
  onFileSelected: (relativePath: string) => void;
  onCreateRequested: (kind: "page" | "post") => void;
  onRenameRequested: (target: ContentTarget) => void;
  onDeleteRequested: (target: ContentTarget) => void;
};

const Sidebar = ({
  tree,
  selectedPath,
  onFileSelected,
  onCreateRequested,
  onRenameRequested,
  onDeleteRequested,
}: SidebarProps) => {
  return (
    <aside
      aria-label="Site content"
      className="border-brand-border bg-brand-background flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r p-3"
    >
      <section aria-labelledby="pages-heading" className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          <h2
            id="pages-heading"
            className="text-brand-gray text-xs font-semibold tracking-wide uppercase"
          >
            Pages
          </h2>
          <button
            aria-label="New page"
            onClick={() => onCreateRequested("page")}
            className="text-brand-gray hover:text-brand-black hover:bg-brand-grayLight rounded-md p-1 transition-colors duration-100"
          >
            <PlusIcon />
          </button>
        </div>
        {tree && tree.pages.length === 0 ? (
          <p className="text-brand-gray px-2 py-1.5 text-sm">No pages yet.</p>
        ) : (
          tree && (
            <PagesTree
              nodes={tree.pages}
              selectedPath={selectedPath}
              onFileSelected={onFileSelected}
              onRenameRequested={onRenameRequested}
              onDeleteRequested={onDeleteRequested}
            />
          )
        )}
      </section>
      <section aria-labelledby="posts-heading" className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          <h2
            id="posts-heading"
            className="text-brand-gray text-xs font-semibold tracking-wide uppercase"
          >
            Posts
          </h2>
          <button
            aria-label="New post"
            onClick={() => onCreateRequested("post")}
            className="text-brand-gray hover:text-brand-black hover:bg-brand-grayLight rounded-md p-1 transition-colors duration-100"
          >
            <PlusIcon />
          </button>
        </div>
        {tree && tree.posts.length === 0 ? (
          <p className="text-brand-gray px-2 py-1.5 text-sm">No posts yet.</p>
        ) : (
          tree && (
            <ul className="flex flex-col gap-0.5">
              {tree.posts.map((post) => {
                const isSelected = selectedPath === post.relativePath;
                return (
                  <li key={post.relativePath} className="group relative">
                    <button
                      onClick={() => onFileSelected(post.relativePath)}
                      aria-current={isSelected ? "true" : undefined}
                      className={classNames(
                        "w-full rounded-md px-2 py-1.5 pr-14 text-left text-sm transition-colors duration-100",
                        isSelected
                          ? "bg-brand-grayLight text-brand-black font-medium"
                          : "text-brand-grayDark hover:bg-brand-grayLight",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate">{post.title}</span>
                        {post.isDraft && (
                          <span className="bg-brand-grayLight text-brand-gray shrink-0 rounded-md px-1.5 py-0.5 text-xs">
                            Draft
                          </span>
                        )}
                      </span>
                      {post.date && (
                        <span className="text-brand-gray block text-xs">
                          {post.date}
                        </span>
                      )}
                    </button>
                    <RowActions
                      target={{
                        relativePath: post.relativePath,
                        fileName: post.fileName,
                        title: post.title,
                        kind: "post",
                      }}
                      onRenameRequested={onRenameRequested}
                      onDeleteRequested={onDeleteRequested}
                    />
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>
    </aside>
  );
};

export default Sidebar;
