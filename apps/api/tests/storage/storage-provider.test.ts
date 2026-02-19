import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LocalStorageProvider } from "../../src/storage/local-storage-provider.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const TEST_UPLOAD_DIR = join(process.cwd(), "test-uploads");

describe("LocalStorageProvider", () => {
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    await mkdir(TEST_UPLOAD_DIR, { recursive: true });
    provider = new LocalStorageProvider(TEST_UPLOAD_DIR);
  });

  afterAll(async () => {
    await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  });

  it("uploads a file and returns the key", async () => {
    const content = Buffer.from("fake image data");
    const key = "canvases/user1/canvas1.jpg";

    const resultKey = await provider.upload(content, key);
    expect(resultKey).toBe(key);
  });

  it("retrieves the file path for a stored key", async () => {
    const content = Buffer.from("another image");
    const key = "canvases/user1/canvas2.jpg";

    await provider.upload(content, key);
    const filePath = await provider.getFilePath(key);
    expect(filePath).toContain("canvas2.jpg");
  });

  it("deletes a stored file", async () => {
    const content = Buffer.from("to be deleted");
    const key = "canvases/user1/canvas3.jpg";

    await provider.upload(content, key);
    await provider.delete(key);

    const filePath = await provider.getFilePath(key);
    expect(filePath).toBeNull();
  });

  it("returns null for a non-existent key", async () => {
    const filePath = await provider.getFilePath("nonexistent/key.jpg");
    expect(filePath).toBeNull();
  });

  it("rejects path traversal in upload", async () => {
    const content = Buffer.from("malicious");
    await expect(
      provider.upload(content, "../../etc/passwd")
    ).rejects.toThrow("Invalid storage key");
  });

  it("rejects path traversal in getFilePath", async () => {
    await expect(
      provider.getFilePath("../../etc/passwd")
    ).rejects.toThrow("Invalid storage key");
  });

  it("rejects path traversal in delete", async () => {
    await expect(
      provider.delete("../../etc/passwd")
    ).rejects.toThrow("Invalid storage key");
  });

  it("creates nested directories as needed", async () => {
    const content = Buffer.from("nested content");
    const key = "canvases/deep/nested/path/image.jpg";

    const resultKey = await provider.upload(content, key);
    expect(resultKey).toBe(key);

    const filePath = await provider.getFilePath(key);
    expect(filePath).not.toBeNull();
  });
});
