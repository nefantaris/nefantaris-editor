import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow, ipcMain } from "electron";
import type { IpcEventMap, IpcInvokeMap } from "./ipcContract.cjs";

type InvokeHandler<C extends keyof IpcInvokeMap> = (
  event: IpcMainInvokeEvent,
  ...args: IpcInvokeMap[C]["args"]
) => IpcInvokeMap[C]["result"] | Promise<IpcInvokeMap[C]["result"]>;

export function handleInvoke<C extends keyof IpcInvokeMap>(
  channel: C,
  handler: InvokeHandler<C>,
): void {
  ipcMain.handle(channel, handler);
}

export function broadcast<C extends keyof IpcEventMap>(
  channel: C,
  payload: IpcEventMap[C],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}
