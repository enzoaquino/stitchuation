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
