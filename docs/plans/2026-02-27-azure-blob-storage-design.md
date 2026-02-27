# Azure Blob Storage Design

## Goal

Replace local filesystem image storage with Azure Blob Storage. Use Azurite Docker image for local development. Serve images directly via SAS URLs instead of proxying through the API.

## Architecture

Implement `AzureBlobStorageProvider` using the existing `StorageProvider` interface. On upload, store blob to Azure (or Azurite locally) and return a SAS URL as the `imageKey`. iOS detects URL-style keys and fetches directly from blob storage.

Single `images` container with existing key structure: `pieces/{userId}/{id}.ext`, `journals/{userId}/{entryId}/{imageId}.ext`.

## API Changes

### New: `AzureBlobStorageProvider`
- Implements `StorageProvider` interface
- Uses `@azure/storage-blob` SDK
- `upload()` → uploads blob, returns SAS URL (1-year expiry)
- `delete()` → deletes blob by key
- Auto-creates container on first use

### Modified: `StorageProvider` interface
- `upload()` return value semantics change: returns full URL for Azure, relative path for local
- `getFilePath()` unused for Azure provider (direct URL serving)

### Modified: `getStorage()` factory
- `STORAGE_PROVIDER=azure` → `AzureBlobStorageProvider`
- `STORAGE_PROVIDER=local` (default) → `LocalStorageProvider`

### Modified: Upload routes
- No structural changes — `upload()` already returns a string stored as `imageKey`
- For Azure, that string is now a full SAS URL

### Kept: `GET /images/*` route
- Backward compatibility for any existing relative keys in the database

### Docker Compose
- Add Azurite service (mcr.microsoft.com/azure-storage/azurite)
- Expose port 10000 (blob service)
- Add `AZURE_STORAGE_CONNECTION_STRING` env var for api service

## iOS Changes

### Modified: `ImageCache`
- Detect URL-style `imageKey` (starts with `http`)
- URL keys: fetch directly via `URLSession` (no auth needed, SAS token in URL)
- Relative keys: fetch via `NetworkClient.fetchData(path: "/images/...")` (backward compat)

### No changes: `UploadQueue`
- Already parses response JSON for `imageKey` — works whether it's a relative path or full URL

## Environment Variables

```
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;
AZURE_STORAGE_CONTAINER=images
```

## Key Decisions

- **SAS token lifetime**: 1 year (images are immutable, re-upload = new blob)
- **Container structure**: Single `images` container, user-prefixed keys
- **Backward compatibility**: Old relative keys still served via `GET /images/*`
- **No data migration**: Dev-only Docker volume, fresh start acceptable
