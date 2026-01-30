# PowerShell script to copy google-services.json to Android project
Write-Host "Copying google-services.json to Android project..." -ForegroundColor Cyan

$rootFile = "google-services.json"
$androidFile = "android\app\google-services.json"

# Check if root file exists
if (-not (Test-Path $rootFile)) {
    Write-Host "Error: google-services.json not found in project root!" -ForegroundColor Red
    Write-Host "Please download it from Firebase Console first." -ForegroundColor Yellow
    Write-Host "See FIREBASE_ANDROID_SETUP.md for instructions." -ForegroundColor Yellow
    exit 1
}

# Check if Android project exists
if (-not (Test-Path "android")) {
    Write-Host "Warning: Android project not found. Creating it..." -ForegroundColor Yellow
    Write-Host "Run 'npm run cap:add:android' first, then run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if android/app folder exists
if (-not (Test-Path "android\app")) {
    Write-Host "Error: android/app folder not found!" -ForegroundColor Red
    Write-Host "Make sure you've run 'npm run cap:add:android' first." -ForegroundColor Yellow
    exit 1
}

# Create android/app directory if it doesn't exist (shouldn't happen, but just in case)
$androidAppDir = "android\app"
if (-not (Test-Path $androidAppDir)) {
    New-Item -ItemType Directory -Path $androidAppDir -Force | Out-Null
}

# Copy the file
Write-Host "Copying $rootFile to $androidFile..." -ForegroundColor Yellow
Copy-Item $rootFile $androidFile -Force

if (Test-Path $androidFile) {
    Write-Host "Success! google-services.json copied to Android project." -ForegroundColor Green
    Write-Host "Location: $androidFile" -ForegroundColor Cyan
    
    # Verify package name
    $content = Get-Content $androidFile -Raw | ConvertFrom-Json
    $packageName = $content.client[0].client_info.android_client_info.package_name
    Write-Host "Package name in file: $packageName" -ForegroundColor Cyan
    
    if ($packageName -eq "com.lumina.pos.pro") {
        Write-Host "Package name matches! Everything looks good." -ForegroundColor Green
    } else {
        Write-Host "Warning: Package name mismatch! Expected: com.lumina.pos.pro" -ForegroundColor Yellow
        Write-Host "Please download a new google-services.json from Firebase Console." -ForegroundColor Yellow
    }
} else {
    Write-Host "Error: Failed to copy file!" -ForegroundColor Red
    exit 1
}
