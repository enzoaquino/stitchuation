# Azure Dev Environment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the Stitchuation API to Azure as a persistent dev environment with CI/CD on push to main.

**Architecture:** Azure Container Apps (scale-to-zero) + PostgreSQL Flexible Server + Azure Blob Storage + ACR. Bicep IaC in `infra/`. GitHub Actions for CI/CD. Custom domain `api.dev.stitchuation.app` with Azure-managed TLS.

**Tech Stack:** Azure Bicep, GitHub Actions, Docker, Azure CLI

**Design doc:** `docs/plans/2026-02-27-azure-dev-environment-design.md`

---

### Task 1: Storage Account Bicep Module

**Files:**
- Create: `infra/modules/storage.bicep`

**Step 1: Create the storage module**

```bicep
@description('Location for resources')
param location string

@description('Base name for resources')
param baseName string

@description('Storage container name')
param containerName string = 'images'

var storageAccountName = replace('st${baseName}', '-', '')

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
}

output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
output containerName string = containerName
```

**Step 2: Verify syntax**

Run: `az bicep lint --file infra/modules/storage.bicep`
Expected: No errors (warnings about listKeys are OK).

**Step 3: Commit**

```bash
git add infra/modules/storage.bicep
git commit -m "feat(infra): add storage account Bicep module"
```

---

### Task 2: PostgreSQL Flexible Server Bicep Module

**Files:**
- Create: `infra/modules/postgresql.bicep`

**Step 1: Create the postgresql module**

```bicep
@description('Location for resources')
param location string

@description('Base name for resources')
param baseName string

@description('Database administrator login')
param adminLogin string

@secure()
@description('Database administrator password')
param adminPassword string

@description('Database name')
param databaseName string = 'stitchuation'

var serverName = 'psql-${baseName}'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: databaseName
}

// Allow Azure services (Container Apps) to connect
resource firewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output connectionString string = 'postgresql://${adminLogin}:${adminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
```

**Step 2: Verify syntax**

Run: `az bicep lint --file infra/modules/postgresql.bicep`
Expected: No errors.

**Step 3: Commit**

```bash
git add infra/modules/postgresql.bicep
git commit -m "feat(infra): add PostgreSQL Flexible Server Bicep module"
```

---

### Task 3: Container Registry Bicep Module

**Files:**
- Create: `infra/modules/container-registry.bicep`

**Step 1: Create the container registry module**

```bicep
@description('Location for resources')
param location string

@description('Base name for resources')
param baseName string

var acrName = replace('acr${baseName}', '-', '')

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

output loginServer string = acr.properties.loginServer
output name string = acr.name
```

**Step 2: Verify syntax**

Run: `az bicep lint --file infra/modules/container-registry.bicep`
Expected: No errors.

**Step 3: Commit**

```bash
git add infra/modules/container-registry.bicep
git commit -m "feat(infra): add Container Registry Bicep module"
```

---

### Task 4: Container Apps Bicep Module

**Files:**
- Create: `infra/modules/container-apps.bicep`

This is the most complex module — it creates the Container Apps Environment and the API container app.

**Step 1: Create the container apps module**

```bicep
@description('Location for resources')
param location string

@description('Base name for resources')
param baseName string

@description('Container image to deploy')
param containerImage string

@description('ACR login server')
param acrLoginServer string

@description('ACR admin username')
param acrUsername string

@secure()
@description('ACR admin password')
param acrPassword string

@secure()
@description('Database connection string')
param databaseUrl string

@secure()
@description('JWT secret')
param jwtSecret string

@secure()
@description('JWT refresh secret')
param jwtRefreshSecret string

@description('Azure Storage connection string')
@secure()
param storageConnectionString string

@description('Azure Storage container name')
param storageContainer string = 'images'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${baseName}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${baseName}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${baseName}-api'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
      }
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acrPassword }
        { name: 'database-url', value: databaseUrl }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'jwt-refresh-secret', value: jwtRefreshSecret }
        { name: 'storage-connection-string', value: storageConnectionString }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'JWT_REFRESH_SECRET', secretRef: 'jwt-refresh-secret' }
            { name: 'STORAGE_PROVIDER', value: 'azure' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection-string' }
            { name: 'AZURE_STORAGE_CONTAINER', value: storageContainer }
            { name: 'PORT', value: '3000' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output environmentId string = containerAppsEnv.id
output environmentName string = containerAppsEnv.name
output appName string = containerApp.name
```

**Step 2: Verify syntax**

Run: `az bicep lint --file infra/modules/container-apps.bicep`
Expected: No errors.

**Step 3: Commit**

```bash
git add infra/modules/container-apps.bicep
git commit -m "feat(infra): add Container Apps Bicep module"
```

---

### Task 5: Main Bicep Orchestration + Dev Parameters

**Files:**
- Create: `infra/main.bicep`
- Create: `infra/parameters/dev.bicepparam`

**Step 1: Create the main orchestration file**

```bicep
targetScope = 'resourceGroup'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Base name used for all resources')
param baseName string

@description('Container image to deploy (e.g. acr.azurecr.io/api:latest)')
param containerImage string

@description('PostgreSQL admin login')
param dbAdminLogin string

@secure()
@description('PostgreSQL admin password')
param dbAdminPassword string

@secure()
@description('JWT secret for auth tokens')
param jwtSecret string

@secure()
@description('JWT refresh secret')
param jwtRefreshSecret string

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    baseName: baseName
  }
}

module postgresql 'modules/postgresql.bicep' = {
  name: 'postgresql'
  params: {
    location: location
    baseName: baseName
    adminLogin: dbAdminLogin
    adminPassword: dbAdminPassword
  }
}

module containerRegistry 'modules/container-registry.bicep' = {
  name: 'containerRegistry'
  params: {
    location: location
    baseName: baseName
  }
}

module containerApps 'modules/container-apps.bicep' = {
  name: 'containerApps'
  params: {
    location: location
    baseName: baseName
    containerImage: containerImage
    acrLoginServer: containerRegistry.outputs.loginServer
    acrUsername: containerRegistry.outputs.name
    acrPassword: listCredentials(resourceId('Microsoft.ContainerRegistry/registries', containerRegistry.outputs.name), '2023-07-01').passwords[0].value
    databaseUrl: postgresql.outputs.connectionString
    jwtSecret: jwtSecret
    jwtRefreshSecret: jwtRefreshSecret
    storageConnectionString: storage.outputs.connectionString
    storageContainer: storage.outputs.containerName
  }
}

output apiUrl string = 'https://${containerApps.outputs.fqdn}'
output acrLoginServer string = containerRegistry.outputs.loginServer
output containerAppName string = containerApps.outputs.appName
```

**Step 2: Create the dev parameters file**

```
using '../main.bicep'

param baseName = 'stitchuation-dev'
param containerImage = 'acrstitchuationdev.azurecr.io/api:latest'
param dbAdminLogin = 'stitchadmin'
```

Note: Secrets (`dbAdminPassword`, `jwtSecret`, `jwtRefreshSecret`) will be passed via CLI `--parameters` flags or environment variables at deploy time — they are NOT stored in the file.

**Step 3: Verify syntax**

Run: `az bicep lint --file infra/main.bicep`
Expected: No errors.

**Step 4: Commit**

```bash
git add infra/main.bicep infra/parameters/dev.bicepparam
git commit -m "feat(infra): add main Bicep orchestration and dev parameters"
```

---

### Task 6: GitHub Actions CI/CD Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the workflow file**

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - '.github/workflows/deploy.yml'

env:
  RESOURCE_GROUP: rg-stitchuation-dev
  CONTAINER_APP_NAME: ca-stitchuation-dev-api
  ACR_NAME: acrstitchuationdev

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: stitchuation_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/stitchuation_test
      JWT_SECRET: test-secret
      JWT_REFRESH_SECRET: test-refresh-secret
      STORAGE_PROVIDER: local
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: apps/api/package-lock.json
      - run: npm ci
      - run: npx drizzle-kit migrate
      - run: npx vitest run

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push to ACR
        run: |
          az acr login --name ${{ env.ACR_NAME }}
          docker build -t ${{ env.ACR_NAME }}.azurecr.io/api:${{ github.sha }} -t ${{ env.ACR_NAME }}.azurecr.io/api:latest apps/api
          docker push ${{ env.ACR_NAME }}.azurecr.io/api:${{ github.sha }}
          docker push ${{ env.ACR_NAME }}.azurecr.io/api:latest

      - name: Deploy to Container App
        uses: azure/container-apps-deploy-action@v1
        with:
          resourceGroup: ${{ env.RESOURCE_GROUP }}
          containerAppName: ${{ env.CONTAINER_APP_NAME }}
          imageToDeploy: ${{ env.ACR_NAME }}.azurecr.io/api:${{ github.sha }}
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): add GitHub Actions deploy workflow"
```

---

### Task 7: Update iOS Release API URL

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift:12`

**Step 1: Update the URL**

Change line 12 from:
```swift
private static let apiBaseURL = URL(string: "https://api.stitchuation.com")!
```

To:
```swift
private static let apiBaseURL = URL(string: "https://api.dev.stitchuation.app")!
```

**Step 2: Verify it compiles**

Open in Xcode and build, or verify the change looks correct:

Run: `grep -n "apiBaseURL" apps/ios/stitchuation/stitchuation/stitchuationApp.swift`
Expected: Line 10 shows `localhost:3000`, line 12 shows `api.dev.stitchuation.app`.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): update release API URL to dev environment"
```

---

### Task 8: Initial Azure Deployment (Manual)

This task is done from the terminal, not in code. It provisions all Azure resources.

**Step 1: Create the resource group**

```bash
az group create --name rg-stitchuation-dev --location eastus
```

**Step 2: Deploy Bicep (first time — bootstraps everything)**

```bash
az deployment group create \
  --resource-group rg-stitchuation-dev \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters dbAdminPassword='<GENERATE_STRONG_PASSWORD>' \
               jwtSecret='<GENERATE_RANDOM_SECRET>' \
               jwtRefreshSecret='<GENERATE_RANDOM_SECRET>'
```

Generate secrets with: `openssl rand -base64 32`

Expected: Deployment succeeds. Outputs show `apiUrl`, `acrLoginServer`, `containerAppName`.

**Step 3: Push the first image to ACR**

```bash
az acr login --name acrstitchuationdev
docker build -t acrstitchuationdev.azurecr.io/api:latest apps/api
docker push acrstitchuationdev.azurecr.io/api:latest
```

**Step 4: Update the Container App with the real image**

```bash
az containerapp update \
  --name ca-stitchuation-dev-api \
  --resource-group rg-stitchuation-dev \
  --image acrstitchuationdev.azurecr.io/api:latest
```

**Step 5: Verify the API is running**

```bash
curl https://$(az containerapp show --name ca-stitchuation-dev-api --resource-group rg-stitchuation-dev --query properties.configuration.ingress.fqdn -o tsv)/health
```

Expected: `{"status":"ok"}`

---

### Task 9: Configure GitHub Secrets

**Step 1: Create a service principal for GitHub Actions**

```bash
az ad sp create-for-rbac --name "github-stitchuation-dev" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-stitchuation-dev \
  --sdk-auth
```

Copy the full JSON output.

**Step 2: Set GitHub repo secrets**

```bash
gh secret set AZURE_CREDENTIALS < credentials.json
```

(Or paste via GitHub Settings > Secrets > Actions)

**Step 3: Verify by triggering the workflow**

Push a small change to `apps/api/` on `main`. Check Actions tab for successful run.

---

### Task 10: Custom Domain + TLS (Manual)

**Step 1: Get the Container App FQDN**

```bash
az containerapp show \
  --name ca-stitchuation-dev-api \
  --resource-group rg-stitchuation-dev \
  --query properties.configuration.ingress.fqdn -o tsv
```

Note the FQDN (e.g. `ca-stitchuation-dev-api.happyhill-abc123.eastus.azurecontainerapps.io`).

**Step 2: Get the verification code**

```bash
az containerapp show \
  --name ca-stitchuation-dev-api \
  --resource-group rg-stitchuation-dev \
  --query properties.customDomainVerificationId -o tsv
```

**Step 3: Add DNS records at Namecheap**

In Namecheap > Domain List > stitchuation.app > Advanced DNS, add:

| Type | Host | Value |
|------|------|-------|
| CNAME | `api.dev` | `<FQDN from Step 1>` |
| TXT | `asuid.api.dev` | `<verification code from Step 2>` |

Wait a few minutes for DNS propagation.

**Step 4: Add custom domain to Container App**

```bash
az containerapp hostname add \
  --name ca-stitchuation-dev-api \
  --resource-group rg-stitchuation-dev \
  --hostname api.dev.stitchuation.app
```

**Step 5: Bind managed certificate**

```bash
# Get the environment name
ENV_NAME=$(az containerapp show --name ca-stitchuation-dev-api --resource-group rg-stitchuation-dev --query properties.managedEnvironmentId -o tsv | xargs basename)

# Create managed certificate
az containerapp env certificate create \
  --name $ENV_NAME \
  --resource-group rg-stitchuation-dev \
  --hostname api.dev.stitchuation.app \
  --certificate-name cert-api-dev

# Bind it
az containerapp hostname bind \
  --name ca-stitchuation-dev-api \
  --resource-group rg-stitchuation-dev \
  --hostname api.dev.stitchuation.app \
  --environment $ENV_NAME \
  --certificate cert-api-dev
```

**Step 6: Verify**

```bash
curl https://api.dev.stitchuation.app/health
```

Expected: `{"status":"ok"}`

---

### Task 11: End-to-End Verification

**Step 1: Verify API health**

```bash
curl https://api.dev.stitchuation.app/health
```

Expected: `{"status":"ok"}`

**Step 2: Test on real device**

Build the iOS app in Release configuration (or just Archive). The `#else` branch uses `api.dev.stitchuation.app`. Log in and verify:
- Auth works
- Sync works
- Image upload/download works

**Step 3: Push a change and verify CI/CD**

Make a trivial change to `apps/api/` (e.g. add a comment), push to `main`, and verify the GitHub Actions workflow:
- Tests pass
- Image builds and pushes to ACR
- Container App updates to new revision
- `GET /health` still returns ok

**Step 4: Commit the plan doc**

```bash
git add docs/plans/2026-02-27-azure-dev-environment.md
git commit -m "docs: add Azure dev environment implementation plan"
```
