import { join } from "node:path";
import { LocalStorageProvider } from "./local-storage-provider.js";
import { AzureBlobStorageProvider } from "./azure-blob-storage-provider.js";
import type { StorageProvider } from "./storage-provider.js";

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER ?? "local";

    if (provider === "local") {
      const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
      storageInstance = new LocalStorageProvider(uploadDir);
    } else if (provider === "azure") {
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is required when STORAGE_PROVIDER=azure");
      }
      const container = process.env.AZURE_STORAGE_CONTAINER ?? "images";
      const publicEndpoint = process.env.AZURE_STORAGE_PUBLIC_ENDPOINT || undefined;
      storageInstance = new AzureBlobStorageProvider(connectionString, container, publicEndpoint);
    } else {
      throw new Error(`Unknown storage provider: ${provider}`);
    }
  }

  return storageInstance;
}

export function resetStorage(): void {
  storageInstance = null;
}

export type { StorageProvider } from "./storage-provider.js";
export { resolveImageKey, resolvePieceImageKeys, resolvePieceImageKeysArray } from "./resolve-image-keys.js";
