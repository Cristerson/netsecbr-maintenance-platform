$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $PSScriptRoot
$productionDist = Join-Path $frontendRoot 'dist\production'
$packagePath = Join-Path $frontendRoot 'marv.zip'

if (-not (Test-Path -LiteralPath $productionDist)) {
  throw "Build de produção não encontrado em $productionDist. Execute npm run build:production primeiro."
}

Compress-Archive -Path (Join-Path $productionDist '*') -DestinationPath $packagePath -Force

Write-Host "Pacote de produção criado: $packagePath"
