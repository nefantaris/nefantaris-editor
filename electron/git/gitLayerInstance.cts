import { gitAuthProvider } from "../tokenStore.cjs";
import type { GitLayer } from "./gitLayer.cjs";
import { createIsomorphicGitLayer } from "./isomorphicGit.cjs";

export const gitLayer: GitLayer = createIsomorphicGitLayer(gitAuthProvider);
