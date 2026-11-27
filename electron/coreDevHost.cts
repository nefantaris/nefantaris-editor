import { pathToFileURL } from "node:url";

const [hostRuntime, , coreEntry, ...coreArgs] = process.argv;

process.env.ELECTRON_RUN_AS_NODE = "1";
process.argv = [hostRuntime, coreEntry, ...coreArgs];
void import(pathToFileURL(coreEntry).href);
