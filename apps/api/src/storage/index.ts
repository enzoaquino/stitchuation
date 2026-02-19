import { join } from "node:path";
import { LocalStorageProvider } from "./local-storage-provider.js";
import type { StorageProvider } from "./storage-provider.js";

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER ?? "local";

    if (provider === "local") {
      const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
      storageInstance = new LocalStorageProvider(uploadDir);
    } else {
      throw new Error(`Unknown storage provider: ${provider}`);
    }
  }

  return storageInstance;
}

export type { StorageProvider } from "./storage-provider.js";
