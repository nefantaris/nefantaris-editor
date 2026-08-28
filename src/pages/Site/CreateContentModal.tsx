import { useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";

export type FolderOption = {
  value: string;
  label: string;
};

type CreateContentModalProps = {
  contentKind: "page" | "post";
  folders: FolderOption[];
  onSubmit: (title: string, folder: string) => Promise<string | null>;
  onClose: () => void;
};

const CreateContentModal = ({
  contentKind,
  folders,
  onSubmit,
  onClose,
}: CreateContentModalProps) => {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const noun = contentKind === "page" ? "page" : "post";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim() === "") {
      setError(`Give the ${noun} a title.`);
      return;
    }
    setError(await onSubmit(title, folder));
  };

  return (
    <ModalDialog title={`New ${noun}`} onClose={onClose}>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-brand-grayDark text-sm font-medium">Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="bg-brand-background text-brand-black focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
          />
        </label>
        {contentKind === "page" && folders.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-brand-grayDark text-sm font-medium">
              Folder
            </span>
            <select
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              className="bg-brand-background text-brand-black focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
            >
              {folders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="text-brand-danger text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0"
          >
            Create {noun}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0"
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export default CreateContentModal;
