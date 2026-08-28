import { useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";

type PublishModalProps = {
  onSubmit: (note: string) => Promise<string | null>;
  onClose: () => void;
};

const PublishModal = ({ onSubmit, onClose }: PublishModalProps) => {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPublishing(true);
    setError(await onSubmit(note));
    setIsPublishing(false);
  };

  return (
    <ModalDialog title="Publish your site" onClose={onClose}>
      <p className="text-brand-grayDark text-sm">
        Your latest edits will go live on the internet.
      </p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-brand-grayDark text-sm font-medium">
            What changed? (optional)
          </span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A short note for this version"
            className="bg-brand-background text-brand-black placeholder:text-brand-gray focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
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
            disabled={isPublishing}
            className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover disabled:bg-brand-disabled grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0"
          >
            {isPublishing ? "Publishing…" : "Publish"}
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

export default PublishModal;
