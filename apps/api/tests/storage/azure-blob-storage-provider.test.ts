import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AzureBlobStorageProvider } from "../../src/storage/azure-blob-storage-provider.js";

// These tests require Azurite running on localhost:10000.
// Run: docker compose up azurite -d
const AZURITE_CONNECTION_STRING =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

const TEST_CONTAINER = `test-${Date.now()}`;

describe("AzureBlobStorageProvider", () => {
  let provider: AzureBlobStorageProvider;

  beforeAll(async () => {
    provider = new AzureBlobStorageProvider(
      AZURITE_CONNECTION_STRING,
      TEST_CONTAINER,
    );
    await provider.ensureContainer();
  });

  afterAll(async () => {
    await provider.deleteContainer();
  });

  it("upload returns a URL containing the blob key", async () => {
    const content = Buffer.from("hello world");
    const url = await provider.upload(content, "test/file.txt");

    expect(url).toContain("test/file.txt");
    expect(url).toContain("http");
    expect(url).toContain("sig="); // SAS token present
  });

  it("upload overwrites existing blob", async () => {
    const key = "test/overwrite.txt";
    await provider.upload(Buffer.from("version 1"), key);
    const url = await provider.upload(Buffer.from("version 2"), key);

    // Fetch the blob to verify content
    const res = await fetch(url);
    const text = await res.text();
    expect(text).toBe("version 2");
  });

  it("uploaded blob is accessible via returned SAS URL", async () => {
    const content = Buffer.from("fetch me");
    const url = await provider.upload(content, "test/fetch.txt");

    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("fetch me");
  });

  it("delete removes the blob", async () => {
    const content = Buffer.from("delete me");
    const url = await provider.upload(content, "test/delete.txt");

    await provider.delete("test/delete.txt");

    const res = await fetch(url);
    expect(res.status).toBe(404);
  });

  it("delete does not throw for non-existent blob", async () => {
    await expect(
      provider.delete("nonexistent/blob.txt"),
    ).resolves.toBeUndefined();
  });

  it("getUrl returns a SAS URL for existing blob", async () => {
    await provider.upload(Buffer.from("url test"), "test/url.txt");

    const url = await provider.getUrl("test/url.txt");
    expect(url).not.toBeNull();
    expect(url).toContain("test/url.txt");
    expect(url).toContain("sig=");
  });

  it("getUrl returns null for non-existent blob", async () => {
    const url = await provider.getUrl("nonexistent/blob.txt");
    expect(url).toBeNull();
  });
});
