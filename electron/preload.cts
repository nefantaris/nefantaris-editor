import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer } from "electron";
import type {
  IpcEventMap,
  IpcInvokeMap,
  NefantarisApi,
} from "./ipcContract.cjs";

const invokeChannels: Record<keyof IpcInvokeMap, true> = {
  "window:getContext": true,
  "sites:openFromDialog": true,
  "sites:open": true,
  "recentSites:list": true,
  "recentSites:remove": true,
  "content:getTree": true,
  "content:readFile": true,
  "content:writeFile": true,
  "content:createPage": true,
  "content:createPost": true,
  "content:renameFile": true,
  "content:deleteFile": true,
  "content:saveAsset": true,
  "site:inspect": true,
  "system:openExternal": true,
  "preview:start": true,
  "preview:stop": true,
  "preview:getStatus": true,
  "sync:get": true,
  "sync:check": true,
  "sync:update": true,
  "publish:run": true,
  "merge:complete": true,
  "merge:cancel": true,
  "versions:list": true,
  "auth:getStatus": true,
  "auth:startSignIn": true,
  "auth:cancelSignIn": true,
  "auth:signOut": true,
  "repos:list": true,
  "repos:create": true,
  "sites:connect": true,
  "sites:discardClone": true,
  "sites:pickCreateParent": true,
  "sites:planCreate": true,
  "sites:defaultThemeFolder": true,
  "sites:create": true,
  "sites:setOnlineRemote": true,
  "liveness:check": true,
};

const eventChannels: Record<keyof IpcEventMap, true> = {
  "recentSites:changed": true,
  "content:changed": true,
  "preview:status": true,
  "sync:changed": true,
  "auth:statusChanged": true,
  "auth:flowChanged": true,
  "connect:progress": true,
};

const api: NefantarisApi = {
  invoke: (channel, ...args) => {
    if (!invokeChannels[channel]) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, listener) => {
    if (!eventChannels[channel]) {
      throw new Error(`Unknown IPC event channel: ${channel}`);
    }
    const subscription = (
      _event: IpcRendererEvent,
      ...args: Parameters<typeof listener>
    ) => {
      listener(...args);
    };
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

contextBridge.exposeInMainWorld("nefantaris", api);
