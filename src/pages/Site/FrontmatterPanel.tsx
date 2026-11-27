import { useId } from "react";
import { ChevronRightIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import AutosaveTextField from "./AutosaveTextField.tsx";
import type { ContentFileKind, FrontmatterEdit } from "./frontmatterEditing.ts";
import { deriveFrontmatterFields } from "./frontmatterEditing.ts";

type FrontmatterPanelProps = {
  fileKind: ContentFileKind;
  frontmatterYaml: string | null;
  templates: string[] | null;
  isOpen: boolean;
  onOpenChanged: (isOpen: boolean) => void;
  onEdit: (edit: FrontmatterEdit) => void;
};

const FrontmatterPanel = ({
  fileKind,
  frontmatterYaml,
  templates,
  isOpen,
  onOpenChanged,
  onEdit,
}: FrontmatterPanelProps) => {
  const templateFieldId = useId();
  const fields = deriveFrontmatterFields(frontmatterYaml, fileKind);
  const noun = fileKind === "page" ? "Page" : "Post";

  const templateOptions = (templates ?? []).filter(
    (name) => name !== "notFound",
  );
  if (fields.template !== "" && !templateOptions.includes(fields.template)) {
    templateOptions.push(fields.template);
  }

  return (
    <section
      aria-label={`${noun} details`}
      className="border-line bg-surface border-b"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
        <button
          aria-expanded={isOpen}
          onClick={() => onOpenChanged(!isOpen)}
          className="text-ink-secondary hover:text-ink flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium transition-colors duration-100"
        >
          <ChevronRightIcon
            className={classNames(
              "transition-transform duration-100",
              isOpen && "rotate-90",
            )}
          />
          {noun} details
        </button>
      </div>
      {isOpen &&
        (fields.isReadable ? (
          <div className="grid grid-cols-1 gap-3 px-4 pt-1 pb-4 sm:grid-cols-2">
            <AutosaveTextField
              label="Title"
              value={fields.title}
              requiredMessage={`Every ${noun.toLowerCase()} needs a title.`}
              onCommit={(value) => onEdit({ key: "title", value })}
            />
            {fileKind === "page" ? (
              <div className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor={templateFieldId}
                  className="text-ink-secondary text-xs font-medium"
                >
                  Template
                </label>
                <select
                  id={templateFieldId}
                  value={fields.template}
                  onChange={(event) =>
                    onEdit({ key: "template", value: event.target.value })
                  }
                  className="bg-field text-ink focus:ring-primary w-full rounded-md border border-transparent px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
                >
                  <option value="">Default</option>
                  {templateOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <AutosaveTextField
                label="Date"
                inputType="date"
                value={fields.date}
                requiredMessage="Every post needs a date."
                onCommit={(value) => onEdit({ key: "date", value })}
              />
            )}
            <AutosaveTextField
              label="Description"
              isMultiline
              value={fields.description}
              onCommit={(value) => onEdit({ key: "description", value })}
              className="sm:col-span-2"
            />
            <AutosaveTextField
              label="Slug"
              value={fields.slug}
              onCommit={(value) => onEdit({ key: "slug", value })}
            />
            <label className="text-ink-secondary flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={fields.isDraft}
                onChange={(event) =>
                  onEdit({ key: "draft", value: event.target.checked })
                }
                className="accent-primary h-4 w-4"
              />
              Draft
            </label>
            {fields.unknownEntries.length > 0 && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <h3 className="text-ink-muted text-xs font-medium">
                  Also saved in this file
                </h3>
                <dl className="flex flex-col gap-0.5">
                  {fields.unknownEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="text-ink-muted flex gap-2 text-xs"
                    >
                      <dt className="shrink-0 font-medium">{entry.key}</dt>
                      <dd className="truncate">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ) : (
          <p className="text-ink-muted px-4 pt-1 pb-4 text-sm">
            The details at the top of this file couldn't be read as settings, so
            they're shown as text in the editor instead.
          </p>
        ))}
    </section>
  );
};

export default FrontmatterPanel;
