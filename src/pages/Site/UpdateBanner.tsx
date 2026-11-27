import { CloseIcon } from "../../components/Icons.tsx";
import StatusDot from "../../components/StatusDot.tsx";

type UpdateBannerProps = {
  error: string | null;
  isUpdating: boolean;
  onUpdateRequested: () => void;
  onDismissed: () => void;
};

const UpdateBanner = ({
  error,
  isUpdating,
  onUpdateRequested,
  onDismissed,
}: UpdateBannerProps) => {
  return (
    <div
      role="status"
      className="border-line bg-sunken flex items-center justify-between gap-3 border-b px-4 py-2"
    >
      <p className="text-ink-secondary flex items-center gap-2 text-sm">
        <StatusDot tone={error === null ? "attention" : "negative"} />
        {error ?? "A newer version of your site is online."}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onUpdateRequested}
          disabled={isUpdating}
          className="bg-primary text-on-primary hover:bg-primary-hover disabled:bg-raised disabled:text-ink-disabled rounded-md px-3 py-1 text-sm font-medium transition-colors duration-100"
        >
          {isUpdating ? "Updating…" : "Update"}
        </button>
        <button
          aria-label="Dismiss"
          onClick={onDismissed}
          className="text-ink-muted hover:text-ink hover:bg-raised rounded-md p-1 transition-colors duration-100"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
