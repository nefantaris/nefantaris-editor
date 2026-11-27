import type { AuthStatus } from "../../../electron/ipcContract.cts";

type AccountAreaProps = {
  status: AuthStatus | null;
  onSignInRequested: () => void;
};

const AccountArea = ({ status, onSignInRequested }: AccountAreaProps) => {
  return (
    <footer
      aria-label="Account"
      className="border-line flex min-h-12 items-center justify-between gap-3 border-t pt-4"
    >
      {status?.state === "unconfigured" && (
        <p className="text-ink-muted text-sm">
          GitHub sign-in isn&rsquo;t configured in this build yet.
        </p>
      )}
      {status?.state === "signed-out" && (
        <>
          <p className="text-ink-muted text-sm">
            Sign in to connect and publish your sites.
          </p>
          <button
            onClick={onSignInRequested}
            className="bg-primary text-on-primary hover:bg-primary-hover shrink-0 rounded-md px-4 py-2 font-medium transition-colors duration-100"
          >
            Sign in to GitHub
          </button>
        </>
      )}
      {status?.state === "signed-in" && (
        <>
          <div className="min-w-0">
            <p className="text-ink truncate text-sm font-medium">
              Signed in as {status.account.name ?? status.account.login}
            </p>
            {status.isSessionOnly && (
              <p className="text-ink-muted text-sm">
                You&rsquo;ll need to sign in again next time you open the app.
              </p>
            )}
          </div>
          <button
            onClick={() => void globalThis.nefantaris.invoke("auth:signOut")}
            className="text-ink-secondary hover:bg-raised shrink-0 rounded-md px-3 py-2 font-medium transition-colors duration-100"
          >
            Sign out
          </button>
        </>
      )}
    </footer>
  );
};

export default AccountArea;
