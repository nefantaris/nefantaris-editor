import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

function linkUrlAtPos(state: EditorState, pos: number): string | null {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "URL") {
      return state.sliceDoc(node.from, node.to);
    }
    if (node.name === "Link" || node.name === "Autolink") {
      const url = node.getChild("URL");
      return url ? state.sliceDoc(url.from, url.to) : null;
    }
  }
  return null;
}

function openIfExternal(url: string): void {
  const candidate = url.startsWith("www.") ? `https://${url}` : url;
  if (/^https?:\/\//.test(candidate)) {
    void globalThis.nefantaris.invoke("system:openExternal", candidate);
  }
}

export function createLinkClickHandler(): Extension {
  return EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (!event.metaKey && !event.ctrlKey) {
        return false;
      }
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) {
        return false;
      }
      const url = linkUrlAtPos(view.state, pos);
      if (url === null) {
        return false;
      }
      event.preventDefault();
      openIfExternal(url);
      return true;
    },
  });
}
