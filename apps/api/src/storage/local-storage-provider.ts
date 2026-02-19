import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { StorageProvider } from "./storage-provider.js";

export class LocalStorageProvider implements StorageProvider {
  private readonly resolvedBaseDir: string;

  constructor(private baseDir: string) {
    this.resolvedBaseDir = resolve(baseDir);
  }

  private resolveSafe(key: string): string {
    const filePath = resolve(this.resolvedBaseDir, key);
    if (!filePath.startsWith(this.resolvedBaseDir + "/")) {
      throw new Error("Invalid storage key");
    }
    return filePath;
  }

  async upload(content: Buffer, key: string): Promise<string> {
    const filePath = this.resolveSafe(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    return key;
  }

  async getFilePath(key: string): Promise<string | null> {
    const filePath = this.resolveSafe(key);
    try {
      await access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafe(key);
    try {
      await unlink(filePath);
    } catch {
      // File doesn't exist, nothing to delete
    }
  }
}
