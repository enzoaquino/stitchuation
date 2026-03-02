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

@secure()
@description('Anthropic API key for stitch guide parsing')
param anthropicApiKey string

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
    acrPassword: containerRegistry.outputs.adminPassword
    databaseUrl: postgresql.outputs.connectionString
    jwtSecret: jwtSecret
    jwtRefreshSecret: jwtRefreshSecret
    storageConnectionString: storage.outputs.connectionString
    storageContainer: storage.outputs.containerName
    anthropicApiKey: anthropicApiKey
  }
}

output apiUrl string = 'https://${containerApps.outputs.fqdn}'
output acrLoginServer string = containerRegistry.outputs.loginServer
output containerAppName string = containerApps.outputs.appName
