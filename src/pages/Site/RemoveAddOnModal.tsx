import { useState } from "react";
import ModalDialog from "../../components/ModalDialog.tsx";
import {
  modalDangerButtonClasses,
  modalSecondaryButtonClasses,
} from "./settingsStyles.ts";

type RemoveAddOnModalProps = {
  title: string;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
};

const RemoveAddOnModal = ({
  title,
  onConfirm,
  onClose,
}: RemoveAddOnModalProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmRemoval = async () => {
    setIsRemoving(true);
    setError(null);
    const problem = await onConfirm();
    setIsRemoving(false);
    setError(problem);
  };

  return (
    <ModalDialog
      title={`Remove “${title}”?`}
      onClose={onClose}
      canDismiss={!isRemoving}
    >
      <p className="text-ink-secondary text-sm">
        Your site stops using this add-on. Anything on your site that relies on
        it stops working until you add it back.
      </p>
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isRemoving}
          onClick={() => void confirmRemoval()}
          className={modalDangerButtonClasses}
        >
          {isRemoving ? "Removing…" : "Remove"}
        </button>
        <button
          type="button"
          disabled={isRemoving}
          onClick={onClose}
          className={modalSecondaryButtonClasses}
        >
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
};

export default RemoveAddOnModal;
