import { PencilIcon, TrashIcon } from "../../components/Icons.tsx";
import type { ContentTarget } from "./contentTypes.ts";

type RowActionsProps = {
  target: ContentTarget;
  onRenameRequested: (target: ContentTarget) => void;
  onDeleteRequested: (target: ContentTarget) => void;
};

const RowActions = ({
  target,
  onRenameRequested,
  onDeleteRequested,
}: RowActionsProps) => {
  return (
    <span className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100">
      <button
        aria-label={`Rename ${target.title}`}
        onClick={() => onRenameRequested(target)}
        className="text-brand-gray hover:text-brand-black hover:bg-brand-grayLight rounded-md p-1 transition-colors duration-100"
      >
        <PencilIcon />
      </button>
      <button
        aria-label={`Delete ${target.title}`}
        onClick={() => onDeleteRequested(target)}
        className="text-brand-gray hover:text-brand-danger hover:bg-brand-grayLight rounded-md p-1 transition-colors duration-100"
      >
        <TrashIcon />
      </button>
    </span>
  );
};

export default RowActions;
