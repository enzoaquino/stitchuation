# Azure Blob Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace local filesystem image storage with Azure Blob Storage, using Azurite for local dev, with direct SAS URL serving.

**Architecture:** Implement `AzureBlobStorageProvider` behind the existing `StorageProvider` interface. Uploads return SAS URLs stored as `imageKey`. iOS detects URL-style keys and fetches directly from blob storage. Azurite in docker-compose provides local blob service.

**Tech Stack:** `@azure/storage-blob` SDK, Azurite Docker image, Vitest, Swift/SwiftUI

---

### Task 1: Add Azurite to Docker Compose

**Files:**
- Modify: `apps/api/docker-compose.yml`

**Step 1: Add Azurite service and env vars**

Update `apps/api/docker-compose.yml` to:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: stitchuation
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres # Change in production
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d stitchuation"]
      interval: 5s
      timeout: 5s
      retries: 5

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports:
      - "10000:10000"
    volumes:
      - azurite_data:/data
    command: "azurite-blob --blobHost 0.0.0.0 --blobPort 10000 -l /data"

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/stitchuation
      JWT_SECRET: docker-dev-secret # Change in production
      JWT_REFRESH_SECRET: docker-dev-refresh-secret # Change in production
      PORT: "3000"
      STORAGE_PROVIDER: azure
      AZURE_STORAGE_CONNECTION_STRING: "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;"
      AZURE_STORAGE_CONTAINER: images
    depends_on:
      postgres:
        condition: service_healthy
      azurite:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  pgdata:
  azurite_data:
```

**Step 2: Verify Azurite starts**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && docker compose up azurite -d`
Expected: Azurite container running, port 10000 listening.

**Step 3: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/docker-compose.yml
git -C /Users/enzo/Projects/personal/needlepoint commit -m "feat(api): add Azurite blob storage service to docker-compose"
```

---

### Task 2: Install `@azure/storage-blob` and Create Azure Provider

**Files:**
- Modify: `apps/api/package.json` (via npm install)
- Create: `apps/api/src/storage/azure-blob-storage-provider.ts`
- Create: `apps/api/tests/storage/azure-blob-storage-provider.test.ts`

**Step 1: Install the Azure SDK**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npm install @azure/storage-blob`

**Step 2: Write the failing test**

Create `apps/api/tests/storage/azure-blob-storage-provider.test.ts`:

```typescript
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
```

**Step 3: Run test to verify it fails**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run tests/storage/azure-blob-storage-provider.test.ts`
Expected: FAIL — module not found.

**Step 4: Write the implementation**

Create `apps/api/src/storage/azure-blob-storage-provider.ts`:

```typescript
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

  constructor(connectionString: string, containerName: string) {
    this.containerName = containerName;
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
    expiresOn.setFullYear(expiresOn.getFullYear() + 1);

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
    return `${blobClient.url}?${sasParams.toString()}`;
  }

  async ensureContainer(): Promise<void> {
    await this.containerClient.createIfNotExists();
  }

  async deleteContainer(): Promise<void> {
    await this.containerClient.deleteIfExists();
  }

  async upload(content: Buffer, key: string): Promise<string> {
    await this.ensureContainer();
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    await blockBlobClient.upload(content, content.length);
    return this.generateSasUrl(key);
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

  async delete(key: string): Promise<void> {
    const blobClient = this.containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  }
}
```

**Step 5: Start Azurite and run tests**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && docker compose up azurite -d && npx vitest run tests/storage/azure-blob-storage-provider.test.ts`
Expected: All 7 tests PASS.

**Step 6: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/package.json apps/api/package-lock.json apps/api/src/storage/azure-blob-storage-provider.ts apps/api/tests/storage/azure-blob-storage-provider.test.ts
git -C /Users/enzo/Projects/personal/needlepoint commit -m "feat(api): add AzureBlobStorageProvider with SAS URL generation"
```

---

### Task 3: Wire Azure Provider into Storage Factory

**Files:**
- Modify: `apps/api/src/storage/index.ts`
- Create: `apps/api/tests/storage/storage-factory.test.ts`

**Step 1: Write the failing test**

Create `apps/api/tests/storage/storage-factory.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run tests/storage/storage-factory.test.ts`
Expected: FAIL — "azure" branch doesn't exist yet (the "Unknown storage provider" test might pass).

**Step 3: Update the factory**

Modify `apps/api/src/storage/index.ts`:

```typescript
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
      storageInstance = new AzureBlobStorageProvider(connectionString, container);
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run tests/storage/storage-factory.test.ts`
Expected: All 4 tests PASS.

**Step 5: Run full test suite to check for regressions**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/src/storage/index.ts apps/api/tests/storage/storage-factory.test.ts
git -C /Users/enzo/Projects/personal/needlepoint commit -m "feat(api): wire AzureBlobStorageProvider into storage factory"
```

---

### Task 4: Add `.env.example` with Azure Config

**Files:**
- Create: `apps/api/.env.example` (if it doesn't exist, otherwise modify)

**Step 1: Create/update .env.example**

Create `apps/api/.env.example`:

```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5433/stitchuation

# Auth
JWT_SECRET=dev-secret
JWT_REFRESH_SECRET=dev-refresh-secret

# Storage (local or azure)
STORAGE_PROVIDER=local
# STORAGE_PROVIDER=azure
# AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
# AZURE_STORAGE_CONTAINER=images
```

Also update `.env` (or `.env.local`) to use Azure for local dev:

```env
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
AZURE_STORAGE_CONTAINER=images
```

Note: When running outside Docker (e.g. `npm run dev` or tests), use `127.0.0.1:10000`. Inside Docker (docker-compose), use `azurite:10000`. The docker-compose.yml already has the Docker-internal connection string.

**Step 2: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/.env.example
git -C /Users/enzo/Projects/personal/needlepoint commit -m "docs(api): add .env.example with Azure storage config"
```

---

### Task 5: Update iOS ImageCache for Direct URL Fetching

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift`
- Modify: `apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift`

**Step 1: Write the failing test**

Add to `apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift`:

```swift
@Test func isDirectURLDetectsHTTP() {
    #expect(ImageCache.isDirectURL("http://localhost:10000/devstoreaccount1/images/test.jpg") == true)
}

@Test func isDirectURLDetectsHTTPS() {
    #expect(ImageCache.isDirectURL("https://myaccount.blob.core.windows.net/images/test.jpg") == true)
}

@Test func isDirectURLRejectsRelativePath() {
    #expect(ImageCache.isDirectURL("pieces/user123/piece456.jpg") == false)
}

@Test func isDirectURLRejectsNil() {
    #expect(ImageCache.isDirectURL(nil) == false)
}
```

**Step 2: Run tests to verify they fail**

Build and run tests in Xcode or via: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/ImageCacheTests 2>&1 | tail -20`
Expected: FAIL — `isDirectURL` does not exist.

**Step 3: Update ImageCache**

Modify `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift` — update the `image(for:networkClient:)` method and add the helper:

```swift
actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskDirectory = caches.appendingPathComponent("images", isDirectory: true)
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        memoryCache.countLimit = 100
    }

    // MARK: - URL Detection

    /// Returns true if the imageKey is a full URL (Azure SAS URL) rather than a relative path.
    static func isDirectURL(_ imageKey: String?) -> Bool {
        guard let imageKey else { return false }
        return imageKey.hasPrefix("http://") || imageKey.hasPrefix("https://")
    }

    // MARK: - Public API

    /// Full lookup: memory → disk → network. Returns nil on failure.
    func image(for imageKey: String?, networkClient: NetworkClient?) async -> UIImage? {
        guard let imageKey, !imageKey.isEmpty else { return nil }

        // 1. Memory
        if let cached = cachedImage(forKey: imageKey) {
            return cached
        }

        // 2. Disk
        if let diskImage = loadFromDisk(forKey: imageKey) {
            store(diskImage, forKey: imageKey)
            return diskImage
        }

        // 3. Network
        let data: Data?
        if Self.isDirectURL(imageKey) {
            // Azure SAS URL — fetch directly, no auth needed
            data = try? await fetchDirectURL(imageKey)
        } else {
            // Relative path — fetch via API proxy (backward compat)
            guard let networkClient else { return nil }
            data = try? await networkClient.fetchData(path: "/images/\(imageKey)")
        }

        guard let data, let image = UIImage(data: data) else { return nil }
        store(image, forKey: imageKey)
        storeToDisk(data, forKey: imageKey)
        return image
    }

    // MARK: - Direct URL Fetching

    private func fetchDirectURL(_ urlString: String) async throws -> Data {
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        return data
    }

    // MARK: - Memory

    func cachedImage(forKey key: String) -> UIImage? {
        memoryCache.object(forKey: key as NSString)
    }

    func store(_ image: UIImage, forKey key: String) {
        memoryCache.setObject(image, forKey: key as NSString)
    }

    // MARK: - Disk

    func storeToDisk(_ data: Data, forKey key: String) {
        let path = diskPath(forKey: key)
        try? data.write(to: path)
    }

    func loadFromDisk(forKey key: String) -> UIImage? {
        let path = diskPath(forKey: key)
        guard let data = try? Data(contentsOf: path) else { return nil }
        return UIImage(data: data)
    }

    func evict(forKey key: String) {
        memoryCache.removeObject(forKey: key as NSString)
        let path = diskPath(forKey: key)
        try? FileManager.default.removeItem(at: path)
    }

    // MARK: - Helpers

    func diskFileName(forKey key: String) -> String {
        let hash = SHA256.hash(data: Data(key.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func diskPath(forKey key: String) -> URL {
        diskDirectory.appendingPathComponent(diskFileName(forKey: key))
    }
}
```

**Step 4: Run tests to verify they pass**

Run iOS tests again. Expected: All ImageCache tests PASS (including existing ones).

**Step 5: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift
git -C /Users/enzo/Projects/personal/needlepoint commit -m "feat(ios): support direct URL fetching in ImageCache for Azure SAS URLs"
```

---

### Task 6: Integration Test — Upload via API, Fetch via SAS URL

**Files:**
- Create: `apps/api/tests/storage/azure-integration.test.ts`

This test verifies the full flow: upload an image through the API routes → get back a SAS URL as `imageKey` → fetch the image directly from the SAS URL (no API proxy).

**Step 1: Write the integration test**

Create `apps/api/tests/storage/azure-integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetStorage } from "../../src/storage/index.js";
import app from "../../src/app.js";

// This test requires Azurite running on localhost:10000 AND
// STORAGE_PROVIDER=azure in the environment (set in .env or vitest).
// Skip gracefully if not configured.
const isAzureConfigured =
  process.env.STORAGE_PROVIDER === "azure" &&
  !!process.env.AZURE_STORAGE_CONNECTION_STRING;

describe.skipIf(!isAzureConfigured)(
  "Azure Blob Storage Integration",
  () => {
    let accessToken: string;
    let pieceId: string;

    beforeAll(async () => {
      // Reset storage to pick up env
      resetStorage();

      // Register user
      const authRes = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `azure-int-${Date.now()}@example.com`,
          password: "securepassword123",
          displayName: "Azure Tester",
        }),
      });
      const authBody = await authRes.json();
      accessToken = authBody.accessToken;

      // Create a piece
      const pieceRes = await app.request("/pieces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          designer: "Azure Test Designer",
          designName: "Azure Test Canvas",
        }),
      });
      const pieceBody = await pieceRes.json();
      pieceId = pieceBody.id;
    });

    afterAll(() => {
      resetStorage();
    });

    it("upload returns SAS URL as imageKey and image is directly fetchable", async () => {
      const formData = new FormData();
      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const blob = new Blob([imageBytes], { type: "image/jpeg" });
      formData.append("image", blob, "azure-test.jpg");

      const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      expect(uploadRes.status).toBe(200);
      const body = await uploadRes.json();

      // imageKey should be a full URL with SAS token
      expect(body.imageKey).toContain("http");
      expect(body.imageKey).toContain("sig=");
      expect(body.imageKey).toContain(pieceId);

      // Fetch directly from blob storage (no API proxy)
      const directRes = await fetch(body.imageKey);
      expect(directRes.status).toBe(200);

      const directBytes = new Uint8Array(await directRes.arrayBuffer());
      // First 4 bytes should be JPEG magic bytes
      expect(directBytes[0]).toBe(0xff);
      expect(directBytes[1]).toBe(0xd8);
    });

    it("delete removes blob from storage", async () => {
      // Upload first
      const formData = new FormData();
      const blob = new Blob(
        [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
        { type: "image/jpeg" },
      );
      formData.append("image", blob, "delete-test.jpg");

      const uploadRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const uploadBody = await uploadRes.json();
      const sasUrl = uploadBody.imageKey;

      // Delete via API
      const deleteRes = await app.request(`/pieces/${pieceId}/image`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(deleteRes.status).toBe(200);

      // Direct fetch should now 404
      const directRes = await fetch(sasUrl);
      expect(directRes.status).toBe(404);
    });
  },
);
```

**Step 2: Run integration test**

Make sure `.env` has `STORAGE_PROVIDER=azure` and `AZURE_STORAGE_CONNECTION_STRING` set (pointing to `127.0.0.1:10000`), and Azurite is running.

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run tests/storage/azure-integration.test.ts`
Expected: All 2 tests PASS.

**Step 3: Run full test suite**

Run: `cd /Users/enzo/Projects/personal/needlepoint/apps/api && npx vitest run`
Expected: All tests PASS. The existing `image-routes.test.ts` should still pass using local storage (since it doesn't set `STORAGE_PROVIDER=azure`). The azure integration tests skip gracefully if not configured.

**Step 4: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/tests/storage/azure-integration.test.ts
git -C /Users/enzo/Projects/personal/needlepoint commit -m "test(api): add Azure Blob Storage integration tests"
```

---

### Task 7: Remove Docker `uploads` Volume

**Files:**
- Modify: `apps/api/docker-compose.yml`

Now that Azure blob storage is the default in Docker, the `uploads` named volume is no longer needed.

**Step 1: Remove uploads volume from docker-compose**

In `apps/api/docker-compose.yml`, remove the `uploads:/app/uploads` volume mount from the `api` service and the `uploads:` entry from the top-level `volumes:` section.

The `api` service `volumes:` section should be removed entirely (it only had uploads).

The `volumes:` section at the bottom should only have:
```yaml
volumes:
  pgdata:
  azurite_data:
```

**Step 2: Commit**

```bash
git -C /Users/enzo/Projects/personal/needlepoint add apps/api/docker-compose.yml
git -C /Users/enzo/Projects/personal/needlepoint commit -m "chore(api): remove unused uploads volume from docker-compose"
```
