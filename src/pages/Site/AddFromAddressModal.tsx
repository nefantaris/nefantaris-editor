import { useState, type FormEvent } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import {
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

type AddFromAddressModalProps = {
  sitePath: string;
  onAdded: () => void;
  onClose: () => void;
};

const AddFromAddressModal = ({
  sitePath,
  onAdded,
  onClose,
}: AddFromAddressModalProps) => {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (address.trim() === "") {
      setError("Paste the add-on's web address.");
      return;
    }
    setIsAdding(true);
    setError(null);
    const result = await globalThis.nefantaris.invoke(
      "plugins:add",
      sitePath,
      address,
    );
    setIsAdding(false);
    if (result.status === "failed") {
      setError(result.message);
      return;
    }
    onAdded();
  };

  return (
    <ModalDialog
      title="Add from an address"
      onClose={onClose}
      canDismiss={!isAdding}
    >
      <p className="text-ink-secondary text-sm">
        For an add-on someone shared with you. Adding it downloads it, which can
        take a moment.
      </p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-ink-secondary text-sm font-medium">
            Add-on address
          </span>
          <input
            type="text"
            value={address}
            disabled={isAdding}
            placeholder="https://github.com/someone/nefantaris-plugin-name"
            onChange={(event) => setAddress(event.target.value)}
            className="bg-field text-ink focus:ring-primary rounded-md p-3 focus:ring-2 focus:outline-none"
          />
        </label>
        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isAdding}
            className={modalPrimaryButtonClasses}
          >
            {isAdding ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            disabled={isAdding}
            onClick={onClose}
            className={modalSecondaryButtonClasses}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export default AddFromAddressModal;
