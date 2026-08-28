import { app, BrowserWindow } from "electron";
import {
  registerAssetProtocolHandler,
  registerAssetScheme,
} from "./assetProtocol.cjs";
import { stopAllPreviewServers } from "./devServer.cjs";
import { registerIpcHandlers } from "./ipcHandlers.cjs";
import { createWelcomeWindow } from "./windows.cjs";

const userDataDir = process.env.NEFANTARIS_USER_DATA_DIR;
if (userDataDir) {
  app.setPath("userData", userDataDir);
}

registerAssetScheme();

app.on("ready", () => {
  registerAssetProtocolHandler();
  registerIpcHandlers();
  createWelcomeWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWelcomeWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let previewTeardown: "pending" | "running" | "done" = "pending";

async function finishPreviewTeardownThenQuit(): Promise<void> {
  await stopAllPreviewServers();
  previewTeardown = "done";
  app.quit();
}

app.on("before-quit", (event) => {
  if (previewTeardown === "done") {
    return;
  }
  event.preventDefault();
  if (previewTeardown === "pending") {
    previewTeardown = "running";
    void finishPreviewTeardownThenQuit();
  }
});
