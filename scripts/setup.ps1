# Bill HQ — Windows setup script
# Bootstraps everything: clones both repos, installs deps, sets up config.
#
# Run from PowerShell:
#   cd C:\Users\iblad\Documents
#   iwr -useb https://raw.githubusercontent.com/imman-dev/bill-hq/main/scripts/setup.ps1 | iex
#
# Or after you've cloned bill-hq manually:
#   cd bill-hq\scripts; .\setup.ps1

$ErrorActionPreference = 'Stop'

$root = Get-Location
Write-Host ""
Write-Host "[ Bill HQ Setup ] Working from: $root" -ForegroundColor Cyan
Write-Host ""

# --- 1. Clone bill-hq if not already present ---
if (-not (Test-Path "bill-hq")) {
    Write-Host "[1/5] Cloning bill-hq..." -ForegroundColor Yellow
    git clone https://github.com/imman-dev/bill-hq.git
    if ($LASTEXITCODE -ne 0) { throw "git clone bill-hq failed" }
} else {
    Write-Host "[1/5] bill-hq already present — pulling latest..." -ForegroundColor Yellow
    Push-Location bill-hq
    git pull
    Pop-Location
}

# --- 2. Clone Ward-vault if not already present ---
if (-not (Test-Path "Ward-vault")) {
    Write-Host "[2/5] Cloning Ward-vault (private — may prompt for GitHub auth)..." -ForegroundColor Yellow
    git clone https://github.com/imman-dev/Ward-vault.git
    if ($LASTEXITCODE -ne 0) { throw "git clone Ward-vault failed" }
} else {
    Write-Host "[2/5] Ward-vault already present — pulling latest..." -ForegroundColor Yellow
    Push-Location Ward-vault
    git pull
    Pop-Location
}

# --- 3. npm install ---
Write-Host "[3/5] Installing Node dependencies..." -ForegroundColor Yellow
Push-Location bill-hq
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed — is Node v18+ installed?" }
Pop-Location

# --- 4. Set up config.js ---
$configPath = Join-Path $root "bill-hq\config.js"
$examplePath = Join-Path $root "bill-hq\config.example.js"
$vaultAbs = (Resolve-Path "Ward-vault").Path

if (-not (Test-Path $configPath)) {
    Write-Host "[4/5] Creating config.js with your vault path..." -ForegroundColor Yellow
    $contents = Get-Content $examplePath -Raw
    # Replace the default vaultPath placeholder with the real one (escape backslashes for JS).
    $vaultJsEscaped = $vaultAbs.Replace('\', '\\')
    $contents = $contents -replace "vaultPath:.*", "vaultPath: '$vaultJsEscaped',"
    Set-Content -Path $configPath -Value $contents -Encoding utf8
    Write-Host "       Wrote config.js with vaultPath = $vaultAbs"
} else {
    Write-Host "[4/5] config.js already exists — leaving as-is." -ForegroundColor Yellow
}

# --- 5. Done ---
Write-Host ""
Write-Host "[5/5] Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "To start Mission Control:" -ForegroundColor Cyan
Write-Host "    cd bill-hq" -ForegroundColor White
Write-Host "    npm start" -ForegroundColor White
Write-Host ""
Write-Host "Then open http://localhost:3737 in your browser."
Write-Host ""
Write-Host "If Bill chat doesn't respond:"
Write-Host "  - Make sure 'claude' CLI is installed and you've run 'claude /login' with your Max plan."
Write-Host ""
Write-Host "If Hermes-engine agents (Scout/Hunter/Echo) error:"
Write-Host "  - Make sure Ollama is running and you've pulled a model:  ollama pull hermes3"
Write-Host ""
