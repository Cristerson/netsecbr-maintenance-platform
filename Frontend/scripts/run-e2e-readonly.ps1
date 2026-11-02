# Execute no terminal local do VS Code. As senhas não são salvas nem exibidas.
$ErrorActionPreference = 'Stop'

function Read-MARVEmail([string]$label, [string]$suggested) {
  while ($true) {
    $entered = Read-Host "$label e-mail [$suggested]"
    $selected = if ([string]::IsNullOrWhiteSpace($entered)) { $suggested } else { $entered.Trim() }
    if ($selected -match '^[^\s@]+@[^\s@]+\.[^\s@]+$') { return $selected }
    Write-Host 'E-mail inválido. Pressione Enter para usar o sugerido ou digite um endereço válido.'
  }
}

function Read-MARVPassword([string]$label, [string]$variableName) {
  $secure = Read-Host "$label senha" -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    [Environment]::SetEnvironmentVariable($variableName, $plain, 'Process')
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $plain = $null
    $secure = $null
  }
}

$variableNames = @(
  'MARV_AN_EMAIL', 'MARV_AN_PASSWORD',
  'MARV_AC_EMAIL', 'MARV_AC_PASSWORD',
  'MARV_UN_EMAIL', 'MARV_UN_PASSWORD'
)

try {
  $env:MARV_AN_EMAIL = Read-MARVEmail 'AN' 'cristerson.castelanno@netsecbr.com.br'
  Read-MARVPassword 'AN' 'MARV_AN_PASSWORD'
  $env:MARV_AC_EMAIL = Read-MARVEmail 'AC' 'adm@saint-gobain.com'
  Read-MARVPassword 'AC' 'MARV_AC_PASSWORD'
  $env:MARV_UN_EMAIL = Read-MARVEmail 'UN' 'tecnico@saint-gobain.com'
  Read-MARVPassword 'UN' 'MARV_UN_PASSWORD'

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  Push-Location -LiteralPath $repoRoot
  try {
    & npm --prefix Frontend run test:e2e
    $testExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  foreach ($variableName in $variableNames) {
    [Environment]::SetEnvironmentVariable($variableName, $null, 'Process')
  }
}

exit $testExitCode
