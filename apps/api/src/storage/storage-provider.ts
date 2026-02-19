export interface StorageProvider {
  upload(content: Buffer, key: string): Promise<string>;
  getFilePath(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}
