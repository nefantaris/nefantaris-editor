import { useEffect, useState } from "react";
import type { AuthStatus } from "../../electron/ipcContract.cts";

export function useAuthStatus(): AuthStatus | null {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      setStatus(await globalThis.nefantaris.invoke("auth:getStatus"));
    };
    void loadStatus();
    return globalThis.nefantaris.on("auth:statusChanged", setStatus);
  }, []);

  return status;
}
