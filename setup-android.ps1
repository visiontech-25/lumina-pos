# PowerShell script to set up Android for Capacitor
Write-Host "Setting up Android for Lumina POS..." -ForegroundColor Cyan

# Build the project first
Write-Host "Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Please fix build errors first." -ForegroundColor Red
    exit 1
}

# Check if Android platform exists
if (-not (Test-Path "android")) {
    Write-Host "Adding Android platform..." -ForegroundColor Yellow
    npx cap add android
}

# Sync Capacitor
Write-Host "Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync android

Write-Host "Opening Android Studio..." -ForegroundColor Green
npx cap open android

Write-Host "Setup complete! Android Studio should open now." -ForegroundColor Green
Write-Host "To build APK: Build > Build Bundle(s) / APK(s) > Build APK(s)" -ForegroundColor Cyan
