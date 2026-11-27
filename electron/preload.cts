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
  "siteConfig:read": true,
  "siteConfig:edit": true,
  "siteFiles:listImages": true,
  "siteFiles:getFavicon": true,
  "siteFiles:setFavicon": true,
  "customCss:read": true,
  "customCss:write": true,
  "customCss:findings": true,
  "customCss:themeTokens": true,
  "styleRules:read": true,
  "styleRules:edit": true,
  "styleRules:resetTarget": true,
  "styleRules:themeTokens": true,
  "components:list": true,
  "components:customize": true,
  "components:read": true,
  "components:write": true,
  "components:reset": true,
  "components:compare": true,
  "components:keepMine": true,
  "plugins:add": true,
  "plugins:remove": true,
  "plugins:checkAvailable": true,
  "plugins:setSetting": true,
  "plugins:unsetSetting": true,
  "devVars:read": true,
  "devVars:write": true,
  "devVars:ignore": true,
  "system:openExternal": true,
  "clipboard:readText": true,
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
  "sites:create": true,
  "sites:setOnlineRemote": true,
  "liveness:check": true,
};

const eventChannels: Record<keyof IpcEventMap, true> = {
  "recentSites:changed": true,
  "content:changed": true,
  "siteConfig:changed": true,
  "siteFiles:changed": true,
  "customCss:changed": true,
  "components:changed": true,
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
