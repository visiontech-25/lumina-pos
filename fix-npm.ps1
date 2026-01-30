# PowerShell script to fix npm/esbuild installation issues
Write-Host "Cleaning node_modules and package-lock.json..." -ForegroundColor Yellow

# Remove node_modules if it exists
if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}

# Remove package-lock.json if it exists
if (Test-Path "package-lock.json") {
    Write-Host "Removing package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
}

# Clear npm cache for esbuild
Write-Host "Clearing npm cache for esbuild..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "Done! If errors persist, try running as Administrator." -ForegroundColor Green
