# Azure Dev Environment Design

## Goal

Deploy the Stitchuation API to Azure as a persistent dev environment. Enable real device testing, beta tester access, and automated CI/CD deployment on push to main.

## Architecture

Azure Container Apps (scale-to-zero) + PostgreSQL Flexible Server + Azure Blob Storage + Azure Container Registry. GitHub Actions for CI/CD. Custom domain `api.dev.stitchuation.app` with Azure-managed TLS.

## Azure Resources

| Resource | SKU | Purpose | Est. Cost |
|----------|-----|---------|-----------|
| Azure Container Registry | Basic | Store API Docker images | ~$5/mo |
| Container Apps Environment | Consumption | Serverless container runtime | $0 (pay per use) |
| Container App (`api`) | 0.25 vCPU / 0.5 GB | Run the Hono API | ~$0-2/mo |
| PostgreSQL Flexible Server | Burstable B1ms | Database | ~$13/mo |
| Storage Account | Standard LRS | Blob storage for images | <$1/mo |

**Total: ~$18-20/mo** (Postgres dominates). API scales to zero when idle; cold starts ~2-3s.

## Infrastructure as Code (Bicep)

```
infra/
  main.bicep                  # Orchestrates all modules
  modules/
    container-registry.bicep
    container-apps.bicep
    postgresql.bicep
    storage.bicep
  parameters/
    dev.bicepparam            # Dev environment values
```

Deploy via: `az deployment group create --resource-group rg-stitchuation-dev --template-file infra/main.bicep --parameters infra/parameters/dev.bicepparam`

## CI/CD Pipeline (GitHub Actions)

Triggered on push to `main`:

1. **Test** — Run `npx vitest run` against a PostgreSQL service container
2. **Build** — Docker build + push to Azure Container Registry
3. **Deploy** — Update Container App to new image revision

GitHub repo secrets:
- `AZURE_CREDENTIALS` — service principal JSON for `az login`
- `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`

## Container App Configuration

Environment variables set via Bicep secrets:

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | PostgreSQL Flexible Server connection string |
| `JWT_SECRET` | Random generated, Container App secret |
| `JWT_REFRESH_SECRET` | Random generated, Container App secret |
| `STORAGE_PROVIDER` | `azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage Account connection string |
| `AZURE_STORAGE_CONTAINER` | `images` |
| `PORT` | `3000` |

No `AZURE_STORAGE_PUBLIC_ENDPOINT` needed — real Azure Storage URLs are publicly resolvable.

## Custom Domain

- **Domain:** `api.dev.stitchuation.app`
- **DNS:** CNAME record at Namecheap (`api.dev` → Container App FQDN)
- **TLS:** Azure-managed free certificate (auto-renewed)
- **Convention:** `dev` subdomain; production will use `api.stitchuation.app`

## iOS Integration

The release API URL is already defined correctly:

```swift
#if DEBUG
private static let apiBaseURL = URL(string: "http://localhost:3000")!
#else
private static let apiBaseURL = URL(string: "https://api.dev.stitchuation.app")!
#endif
```

Only change: update the `#else` URL from `api.stitchuation.com` to `api.dev.stitchuation.app`.

## What Changes in the Codebase

- New `infra/` directory with Bicep templates
- New `.github/workflows/deploy.yml` for CI/CD
- Update iOS release `apiBaseURL` to `api.dev.stitchuation.app`
- DNS CNAME record at Namecheap (manual step)

## No API Code Changes

The API is fully ready for Azure deployment. Migrations auto-run on container startup via `entrypoint.sh`. Azure Blob Storage is already integrated. Health check endpoint exists at `GET /health`.
