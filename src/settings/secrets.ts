// API-key commands. Keys live in the OS keychain, never in settings.json,
// and the value is write-only: the backend only ever reports whether a key
// exists, so the key can never reach the webview.

import { invoke } from "@tauri-apps/api/core";
import type { AiProvider } from "./settings";

export function setApiKey(provider: AiProvider, key: string): Promise<void> {
  return invoke("set_api_key", { provider, key });
}

export function hasApiKey(provider: AiProvider): Promise<boolean> {
  return invoke<boolean>("has_api_key", { provider });
}

export function deleteApiKey(provider: AiProvider): Promise<void> {
  return invoke("delete_api_key", { provider });
}
