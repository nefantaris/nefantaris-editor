import type { NefantarisApi } from "../../electron/ipcContract.cts";

declare global {
  var nefantaris: NefantarisApi;
}

export {};
