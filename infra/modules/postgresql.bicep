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

@secure()
output connectionString string = 'postgresql://${adminLogin}:${adminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
