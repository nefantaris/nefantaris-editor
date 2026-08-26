import type { ComponentType } from "react";

type PageLoader = () => Promise<{ default: ComponentType }>;

export const routeImports: Record<string, PageLoader> = {
  "/": () => import("./pages/Home"),
  "/404": () => import("./pages/NotFound"),
};

export function preloadRoute(path: string): void {
  const load = routeImports[path];
  if (!load) return;
  void load().catch(() => {});
}

let hasStartedIdlePreload = false;

export function preloadAllRoutesWhenIdle(): void {
  if (hasStartedIdlePreload) return;
  hasStartedIdlePreload = true;

  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (connection?.saveData === true) return;
  if (connection?.effectiveType?.endsWith("2g") === true) return;

  const scheduleIdle = (callback: () => void): void => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(callback);
    } else {
      globalThis.setTimeout(callback, 1500);
    }
  };

  const queue = Object.values(routeImports);
  const loadNext = (): void => {
    const load = queue.shift();
    if (!load) return;
    void load()
      .then(() => scheduleIdle(loadNext))
      .catch(() => scheduleIdle(loadNext));
  };

  const start = (): void => scheduleIdle(loadNext);
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
}
