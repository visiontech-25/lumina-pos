# PowerShell script to update packages and fix vulnerabilities
Write-Host "Updating packages to secure versions..." -ForegroundColor Cyan

# Backup package.json
if (Test-Path "package.json") {
    Copy-Item "package.json" "package.json.backup" -Force
    Write-Host "Backed up package.json" -ForegroundColor Yellow
}

# Remove package-lock.json to force fresh install
if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -Force
    Write-Host "Removed package-lock.json" -ForegroundColor Yellow
}

# Clean npm cache
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

# Remove problematic node_modules subdirectories that cause EPERM errors
Write-Host "Cleaning problematic node_modules..." -ForegroundColor Yellow
$problemDirs = @(
    "node_modules\lucide-react\dist\esm",
    "node_modules\@capacitor\camera\android\src\main\java\com\capacitorjs\plugins",
    "node_modules\@capacitor\android\capacitor\src\main\java\com\getcapacitor",
    "node_modules\@capacitor\status-bar\android\src\main\java\com",
    "node_modules\@capacitor\splash-screen\android\src\main\java"
)

foreach ($dir in $problemDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Could not remove $dir (may be in use)" -ForegroundColor Yellow
        }
    }
}

# Install dependencies
Write-Host "Installing updated dependencies..." -ForegroundColor Green
$installResult = npm install --legacy-peer-deps 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    
    # Wait for package-lock.json to be created
    Start-Sleep -Seconds 2
    
    # Run audit fix for remaining vulnerabilities (non-breaking)
    Write-Host "Fixing remaining vulnerabilities..." -ForegroundColor Yellow
    npm audit fix --legacy-peer-deps 2>&1 | Out-Null
    
    # Show final audit status (only if lockfile exists)
    if (Test-Path "package-lock.json") {
        Write-Host "`nFinal security audit:" -ForegroundColor Cyan
        npm audit 2>&1
    } else {
        Write-Host "`nPackage installation completed. Run 'npm audit' after lockfile is created." -ForegroundColor Yellow
    }
} else {
    Write-Host "`nInstallation had errors. Please check the output above." -ForegroundColor Red
    Write-Host "Trying alternative installation method..." -ForegroundColor Yellow
    npm install --force --legacy-peer-deps
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Installation completed with --force flag." -ForegroundColor Yellow
        if (Test-Path "package-lock.json") {
            Write-Host "`nSecurity audit:" -ForegroundColor Cyan
            npm audit 2>&1
        }
    } else {
        Write-Host "`nInstallation failed. Please check the errors above." -ForegroundColor Red
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "1. Run PowerShell as Administrator" -ForegroundColor Yellow
        Write-Host "2. Close all terminals and IDEs" -ForegroundColor Yellow
        Write-Host "3. Delete node_modules folder manually" -ForegroundColor Yellow
        Write-Host "4. Run: npm cache clean --force" -ForegroundColor Yellow
        Write-Host "5. Run: npm install --legacy-peer-deps" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Packages updated." -ForegroundColor Green
Write-Host "If errors persist, try running as Administrator or restart your IDE." -ForegroundColor Yellow
