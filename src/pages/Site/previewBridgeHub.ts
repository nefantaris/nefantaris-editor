import {
  bridgeMessage,
  type BridgeErrorReport,
  type BridgeMessage,
  type OutgoingBridgeType,
} from "./previewBridge.ts";

export type BridgeEvent = BridgeMessage | { type: "detached" };

export type BridgeState = {
  isConnected: boolean;
  isSelecting: boolean;
  viewportWidth: number | null;
  error: BridgeErrorReport | null;
};

type BridgeSender = (message: Record<string, unknown>) => void;

export type PreviewBridgeHub = {
  getState: () => BridgeState;
  subscribeState: (onChange: () => void) => () => void;
  listen: (listener: (event: BridgeEvent) => void) => () => void;
  publish: (event: BridgeEvent) => void;
  attachSender: (sender: BridgeSender | null) => void;
  send: (type: OutgoingBridgeType, payload?: Record<string, unknown>) => void;
};

const detachedState: BridgeState = {
  isConnected: false,
  isSelecting: false,
  viewportWidth: null,
  error: null,
};

function stateAfter(state: BridgeState, event: BridgeEvent): BridgeState {
  switch (event.type) {
    case "detached": {
      return detachedState;
    }
    case "ready": {
      return {
        ...state,
        isConnected: true,
        viewportWidth: event.viewportWidth ?? state.viewportWidth,
      };
    }
    case "select-mode": {
      return { ...state, isSelecting: event.active };
    }
    case "viewport": {
      return { ...state, viewportWidth: event.viewportWidth };
    }
    case "error": {
      return {
        ...state,
        error: {
          kind: event.kind,
          message: event.message,
          file: event.file,
          line: event.line,
        },
      };
    }
    case "error-cleared": {
      return { ...state, error: null };
    }
    default: {
      return state;
    }
  }
}

export function createPreviewBridgeHub(): PreviewBridgeHub {
  let state = detachedState;
  let sender: BridgeSender | null = null;
  const stateListeners = new Set<() => void>();
  const eventListeners = new Set<(event: BridgeEvent) => void>();

  return {
    getState: () => state,
    subscribeState: (onChange) => {
      stateListeners.add(onChange);
      return () => stateListeners.delete(onChange);
    },
    listen: (listener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    publish: (event) => {
      const next = stateAfter(state, event);
      if (next !== state) {
        state = next;
        for (const onChange of stateListeners) {
          onChange();
        }
      }
      for (const listener of eventListeners) {
        listener(event);
      }
    },
    attachSender: (nextSender) => {
      sender = nextSender;
    },
    send: (type, payload = {}) => {
      if (sender !== null && state.isConnected) {
        sender(bridgeMessage(type, payload));
      }
    },
  };
}
