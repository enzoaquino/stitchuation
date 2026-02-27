import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import type { StorageProvider } from "./storage-provider.js";

export class AzureBlobStorageProvider implements StorageProvider {
  private containerClient: ContainerClient;
  private credential: StorageSharedKeyCredential;
  private containerName: string;
  private containerEnsured = false;
  private publicEndpoint: string | undefined;

  constructor(connectionString: string, containerName: string, publicEndpoint?: string) {
    this.containerName = containerName;
    this.publicEndpoint = publicEndpoint;
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient =
      blobServiceClient.getContainerClient(containerName);

    // Extract account name and key from connection string for SAS generation
    const accountName = this.extractFromConnectionString(
      connectionString,
      "AccountName",
    );
    const accountKey = this.extractFromConnectionString(
      connectionString,
      "AccountKey",
    );
    this.credential = new StorageSharedKeyCredential(accountName, accountKey);
  }

  private extractFromConnectionString(
    connectionString: string,
    key: string,
  ): string {
    const match = connectionString.match(new RegExp(`${key}=([^;]+)`));
    if (!match) {
      throw new Error(`Missing ${key} in connection string`);
    }
    return match[1];
  }

  private generateSasUrl(blobName: string): string {
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1);

    const sasParams = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      this.credential,
    );

    const blobClient = this.containerClient.getBlobClient(blobName);
    const baseUrl = this.publicEndpoint
      ? `${this.publicEndpoint.replace(/\/$/, "")}/${this.containerName}/${blobName}`
      : blobClient.url;
    return `${baseUrl}?${sasParams.toString()}`;
  }

  async ensureContainer(): Promise<void> {
    if (this.containerEnsured) return;
    await this.containerClient.createIfNotExists();
    this.containerEnsured = true;
  }

  async deleteContainer(): Promise<void> {
    await this.containerClient.deleteIfExists();
  }

  private contentTypeFromKey(key: string): string {
    const ext = key.split(".").pop()?.toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "heic") return "image/heic";
    return "image/jpeg";
  }

  async upload(content: Buffer, key: string): Promise<string> {
    await this.ensureContainer();
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: this.contentTypeFromKey(key) },
    });
    return key;
  }

  async getUrl(key: string): Promise<string | null> {
    const blobClient = this.containerClient.getBlobClient(key);
    const exists = await blobClient.exists();
    if (!exists) return null;
    return this.generateSasUrl(key);
  }

  // Satisfy StorageProvider interface — alias for getUrl
  async getFilePath(key: string): Promise<string | null> {
    return this.getUrl(key);
  }

  resolveUrl(key: string): string {
    return this.generateSasUrl(key);
  }

  async delete(key: string): Promise<void> {
    const blobClient = this.containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  }
}
