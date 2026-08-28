import ModalDialog from "../../components/ModalDialog.tsx";
import type { ContentTarget } from "./contentTypes.ts";

type DeleteContentModalProps = {
  target: ContentTarget;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

const DeleteContentModal = ({
  target,
  onConfirm,
  onClose,
}: DeleteContentModalProps) => {
  return (
    <ModalDialog title={`Delete "${target.title}"?`} onClose={onClose}>
      <p className="text-brand-grayDark text-sm">
        This removes the {target.kind} from your site. It can&apos;t be undone.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => void onConfirm()}
          className="bg-brand-danger text-brand-white grow justify-center rounded-md py-3 font-medium transition-colors duration-100 hover:opacity-90 sm:order-2 sm:w-0"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0"
        >
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
};

export default DeleteContentModal;
