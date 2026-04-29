import type { PluginRuntime } from "openclaw/plugin-sdk";
import { setOpenClawVersion } from "./api.js";

let runtime: PluginRuntime | null = null;

export function setQQBotRuntime(next: PluginRuntime) {
  runtime = next;
  setOpenClawVersion(next.version);
}

export function getQQBotRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("QQBot runtime not initialized");
  }
  return runtime;
}
