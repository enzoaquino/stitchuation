import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { StorageProvider } from "./storage-provider.js";

export class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string) {}

  async upload(content: Buffer, key: string): Promise<string> {
    const filePath = join(this.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    return key;
  }

  async getFilePath(key: string): Promise<string | null> {
    const filePath = join(this.baseDir, key);
    try {
      await access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.baseDir, key);
    try {
      await unlink(filePath);
    } catch {
      // File doesn't exist, nothing to delete
    }
  }
}
