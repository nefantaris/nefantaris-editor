import { useEffect, useState } from "react";
import type { WindowContext } from "../electron/ipcContract.cts";
import Site from "./pages/Site";
import Welcome from "./pages/Welcome";

const App = () => {
  const [context, setContext] = useState<WindowContext | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      setContext(await globalThis.nefantaris.invoke("window:getContext"));
    };
    void loadContext();
  }, []);

  return (
    <>
      {context?.kind === "welcome" && <Welcome />}
      {context?.kind === "site" && (
        <Site siteName={context.siteName} sitePath={context.sitePath} />
      )}
    </>
  );
};

export default App;
