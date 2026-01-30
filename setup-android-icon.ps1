# PowerShell script to set up Android app icon
Write-Host "Setting up Android app icon..." -ForegroundColor Cyan

$iconPath = "public\Icon.png"
$androidResPath = "android\app\src\main\res"

if (-not (Test-Path $iconPath)) {
    Write-Host "Error: Icon.png not found in public folder!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $androidResPath)) {
    Write-Host "Error: Android project not found. Run 'npm run cap:sync' first!" -ForegroundColor Red
    exit 1
}

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
        Write-Host "Resizing icon to ${Size}x${Size} for $(Split-Path $Dest -Leaf)..." -ForegroundColor Yellow
        magick $Source -resize "${Size}x${Size}" $Dest
    } else {
        Write-Host "ImageMagick not found. Copying original icon. Install ImageMagick for proper resizing." -ForegroundColor Yellow
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
    Copy-Icon -Source $iconPath -Dest $destFile -Size $entry.Value
}

# Also copy as ic_launcher_foreground.png (for adaptive icons)
foreach ($entry in $iconSizes.GetEnumerator()) {
    $destDir = Join-Path $androidResPath $entry.Key
    $destFile = Join-Path $destDir "ic_launcher_foreground.png"
    Copy-Icon -Source $iconPath -Dest $destFile -Size $entry.Value
}

Write-Host "Android icons configured!" -ForegroundColor Green
Write-Host "Note: For best results, install ImageMagick: choco install imagemagick" -ForegroundColor Cyan
