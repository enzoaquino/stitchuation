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

@secure()
output adminPassword string = acr.listCredentials().passwords[0].value
