import { useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import type { ContentTarget } from "./contentTypes.ts";

type RenameContentModalProps = {
  target: ContentTarget;
  onSubmit: (newName: string) => Promise<string | null>;
  onClose: () => void;
};

const RenameContentModal = ({
  target,
  onSubmit,
  onClose,
}: RenameContentModalProps) => {
  const [name, setName] = useState(() => target.fileName.replace(/\.md$/, ""));
  const [error, setError] = useState<string | null>(null);
  const addressNoun = target.kind === "page" ? "page" : "post";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Give it a file name.");
      return;
    }
    setError(await onSubmit(name));
  };

  return (
    <ModalDialog title={`Rename "${target.title}"`} onClose={onClose}>
      <p className="text-brand-grayDark text-sm">
        Renaming this {addressNoun} changes its address on your site. Links to
        the old address will stop working.
      </p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-brand-grayDark text-sm font-medium">
            File name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="bg-brand-background text-brand-black focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
          />
        </label>
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
            Rename
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

export default RenameContentModal;
