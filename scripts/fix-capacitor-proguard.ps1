# Fix ProGuard configuration in Capacitor packages for AGP 9.0+ compatibility
# Windows PowerShell version

Write-Host "🔧 Checking Capacitor ProGuard configurations..." -ForegroundColor Cyan

$fixedCount = 0
$capacitorFiles = Get-ChildItem -Path "node_modules/@capacitor/*/android/build.gradle" -Recurse -ErrorAction SilentlyContinue

foreach ($file in $capacitorFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "proguard-android\.txt") {
        $newContent = $content -replace "proguard-android\.txt", "proguard-android-optimize.txt"
        Set-Content -Path $file.FullName -Value $newContent
        Write-Host "  ✓ Fixed: $($file.FullName)" -ForegroundColor Green
        $fixedCount++
    }
}

if ($fixedCount -gt 0) {
    Write-Host "✅ Fixed $fixedCount Capacitor package(s)" -ForegroundColor Green
    Write-Host "ℹ️  Note: This is a fallback - primary fix is in frontend/android/build.gradle" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️  No Capacitor packages needed fixing (likely already handled by Gradle override)" -ForegroundColor Green
}
