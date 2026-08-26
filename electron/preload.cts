import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("nefantaris", {});
