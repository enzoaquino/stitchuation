import { describe, it, expect, afterEach, vi } from "vitest";
import { getStorage, resetStorage } from "../../src/storage/index.js";
import { LocalStorageProvider } from "../../src/storage/local-storage-provider.js";
import { AzureBlobStorageProvider } from "../../src/storage/azure-blob-storage-provider.js";

describe("getStorage factory", () => {
  afterEach(() => {
    resetStorage();
    vi.unstubAllEnvs();
  });

  it("returns LocalStorageProvider by default", () => {
    vi.stubEnv("STORAGE_PROVIDER", "local");
    const storage = getStorage();
    expect(storage).toBeInstanceOf(LocalStorageProvider);
  });

  it("returns AzureBlobStorageProvider when STORAGE_PROVIDER=azure", () => {
    vi.stubEnv("STORAGE_PROVIDER", "azure");
    vi.stubEnv(
      "AZURE_STORAGE_CONNECTION_STRING",
      "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;",
    );
    vi.stubEnv("AZURE_STORAGE_CONTAINER", "test-images");
    const storage = getStorage();
    expect(storage).toBeInstanceOf(AzureBlobStorageProvider);
  });

  it("throws when STORAGE_PROVIDER=azure but no connection string", () => {
    vi.stubEnv("STORAGE_PROVIDER", "azure");
    vi.stubEnv("AZURE_STORAGE_CONNECTION_STRING", "");
    expect(() => getStorage()).toThrow("AZURE_STORAGE_CONNECTION_STRING");
  });

  it("throws for unknown provider", () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    expect(() => getStorage()).toThrow("Unknown storage provider: s3");
  });
});
