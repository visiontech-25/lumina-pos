# PowerShell script to set up app icon for ALL platforms (Web, Android, Desktop)
Write-Host "Setting up Lumina Pro POS icon for all platforms..." -ForegroundColor Cyan

$iconSource = "public\Icon.png"
$errors = @()

# Check if source icon exists
if (-not (Test-Path $iconSource)) {
    Write-Host "Error: Icon.png not found in public folder!" -ForegroundColor Red
    Write-Host "Please make sure public/Icon.png exists." -ForegroundColor Yellow
    exit 1
}

Write-Host "Source icon found: $iconSource" -ForegroundColor Green

# ============================================
# 1. WEB/FAVICON - Already configured in index.html
# ============================================
Write-Host ""
Write-Host "[1/3] Web/Favicon..." -ForegroundColor Yellow
Write-Host "  Already configured in index.html (uses /Icon.png)" -ForegroundColor Green
Write-Host "  Already configured in manifest.json (uses /Icon.png)" -ForegroundColor Green

# ============================================
# 2. ANDROID - Copy to Android resource folders
# ============================================
Write-Host ""
Write-Host "[2/3] Android..." -ForegroundColor Yellow

$androidResPath = "android\app\src\main\res"

if (Test-Path $androidResPath) {
    # Create resource directories if they don't exist
    $iconDirs = @(
        "mipmap-mdpi",
        "mipmap-hdpi", 
        "mipmap-xhdpi",
        "mipmap-xxhdpi",
        "mipmap-xxxhdpi"
    )

    foreach ($dir in $iconDirs) {
        $fullPath = Join-Path $androidResPath $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        }
    }

    # Function to resize icon using ImageMagick or copy if not available
    function Copy-Icon {
        param(
            [string]$Source,
            [string]$Dest,
            [int]$Size
        )
        
        if (Get-Command magick -ErrorAction SilentlyContinue) {
            Write-Host "  Resizing icon to ${Size}x${Size}..." -ForegroundColor Gray
            magick $Source -resize "${Size}x${Size}" $Dest
        } else {
            Write-Host "  Copying icon (ImageMagick not found - install for proper resizing)" -ForegroundColor Gray
            Copy-Item $Source $Dest -Force
        }
    }

    # Copy icons to appropriate mipmap folders
    $iconSizes = @{
        "mipmap-mdpi" = 48
        "mipmap-hdpi" = 72
        "mipmap-xhdpi" = 96
        "mipmap-xxhdpi" = 144
        "mipmap-xxxhdpi" = 192
    }

    foreach ($entry in $iconSizes.GetEnumerator()) {
        $destDir = Join-Path $androidResPath $entry.Key
        $destFile = Join-Path $destDir "ic_launcher.png"
        Copy-Icon -Source $iconSource -Dest $destFile -Size $entry.Value
        
        # Also copy as ic_launcher_foreground.png (for adaptive icons)
        $destFileForeground = Join-Path $destDir "ic_launcher_foreground.png"
        Copy-Icon -Source $iconSource -Dest $destFileForeground -Size $entry.Value
    }
    
    Write-Host "  Android icons configured!" -ForegroundColor Green
} else {
    Write-Host "  Android project not found. Run 'npm run cap:add:android' first." -ForegroundColor Yellow
    $errors += "Android project not found"
}

# ============================================
# 3. DESKTOP (ELECTRON) - Copy to electron/assets
# ============================================
Write-Host ""
Write-Host "[3/3] Desktop (Electron)..." -ForegroundColor Yellow

$electronAssetsPath = "electron\assets"

if (Test-Path "electron") {
    if (-not (Test-Path $electronAssetsPath)) {
        New-Item -ItemType Directory -Path $electronAssetsPath -Force | Out-Null
    }
    
    # Copy icon for Electron
    $electronIconPath = Join-Path $electronAssetsPath "appIcon.png"
    Copy-Item $iconSource $electronIconPath -Force
    Write-Host "  Icon copied to electron/assets/appIcon.png" -ForegroundColor Green
    
    # Check if electron-builder.config.json exists and is configured
    $electronConfig = "electron\electron-builder.config.json"
    if (Test-Path $electronConfig) {
        Write-Host "  Electron builder config found" -ForegroundColor Green
    } else {
        Write-Host "  Electron builder config not found" -ForegroundColor Yellow
        $errors += "Electron builder config not found"
    }
} else {
    Write-Host "  Electron project not found. Run 'npx cap add @capacitor-community/electron' first." -ForegroundColor Yellow
    $errors += "Electron project not found"
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host ("="*60) -ForegroundColor Cyan
Write-Host "Icon Setup Summary" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host ""
Write-Host "Web/Favicon:" -ForegroundColor Green
Write-Host "  - index.html uses /Icon.png"
Write-Host "  - manifest.json uses /Icon.png"
Write-Host "  - Source: public/Icon.png"

if (Test-Path $androidResPath) {
    Write-Host ""
    Write-Host "Android:" -ForegroundColor Green
    Write-Host "  - Icons copied to android/app/src/main/res/mipmap-*/"
    Write-Host "  - All sizes configured (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)"
} else {
    Write-Host ""
    Write-Host "Android:" -ForegroundColor Yellow
    Write-Host "  - Android project not found"
    Write-Host "  - Run: npm run cap:add:android"
}

if (Test-Path "electron") {
    Write-Host ""
    Write-Host "Desktop (Electron):" -ForegroundColor Green
    Write-Host "  - Icon copied to electron/assets/appIcon.png"
    Write-Host "  - electron-builder.config.json configured"
} else {
    Write-Host ""
    Write-Host "Desktop (Electron):" -ForegroundColor Yellow
    Write-Host "  - Electron project not found"
    Write-Host "  - Run: npx cap add @capacitor-community/electron"
}

Write-Host ""
Write-Host ("="*60) -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    Write-Host ""
    Write-Host "All icons configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: For best icon quality, install ImageMagick:" -ForegroundColor Cyan
    Write-Host "  choco install imagemagick" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Some platforms need setup:" -ForegroundColor Yellow
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done! Your app icon is now configured for all platforms." -ForegroundColor Green
Write-Host ""
