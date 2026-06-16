# Team Rigo - Apply Sky Blue Theme
# Run this from the project root: C:\Users\jebro\team-rigo
# This changes the app from teal/standard blue to a cleaner sky-blue theme.

$ErrorActionPreference = "Stop"

Write-Host "Applying sky-blue theme to Team Rigo app..." -ForegroundColor Cyan

$root = Get-Location
$srcPath = Join-Path $root "src"

if (-not (Test-Path $srcPath)) {
  Write-Host "ERROR: Could not find src folder. Run this script from your project root." -ForegroundColor Red
  exit 1
}

$extensions = @("*.tsx", "*.ts", "*.jsx", "*.js", "*.css")
$files = @()

foreach ($extension in $extensions) {
  $files += Get-ChildItem -Path $srcPath -Recurse -File -Filter $extension
}

if ($files.Count -eq 0) {
  Write-Host "No source files found to update." -ForegroundColor Yellow
  exit 0
}

foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw
  $original = $content

  # Convert teal or old blue theme classes to sky-blue classes
  $content = $content -replace "teal-50", "sky-50"
  $content = $content -replace "teal-100", "sky-100"
  $content = $content -replace "teal-200", "sky-200"
  $content = $content -replace "teal-300", "sky-300"
  $content = $content -replace "teal-400", "sky-400"
  $content = $content -replace "teal-500", "sky-500"
  $content = $content -replace "teal-600", "sky-600"
  $content = $content -replace "teal-700", "sky-700"
  $content = $content -replace "teal-800", "sky-800"
  $content = $content -replace "teal-900", "sky-900"

  $content = $content -replace "blue-50", "sky-50"
  $content = $content -replace "blue-100", "sky-100"
  $content = $content -replace "blue-200", "sky-200"
  $content = $content -replace "blue-300", "sky-300"
  $content = $content -replace "blue-400", "sky-400"
  $content = $content -replace "blue-500", "sky-500"
  $content = $content -replace "blue-600", "sky-600"
  $content = $content -replace "blue-700", "sky-700"
  $content = $content -replace "blue-800", "sky-800"
  $content = $content -replace "blue-900", "sky-900"

  # Custom login-page hex colors -> sky-blue
  $content = $content -replace "#2029a6", "#0369a1"
  $content = $content -replace "#18208a", "#075985"
  $content = $content -replace "#0f766e", "#0369a1"
  $content = $content -replace "#115e59", "#075985"

  # Shadows
  $content = $content -replace "shadow-teal-900", "shadow-sky-900"
  $content = $content -replace "shadow-blue-900", "shadow-sky-900"

  # Clear theme text where present
  $content = $content -replace "Professional Teal", "Sky Blue"
  $content = $content -replace "Professional Blue", "Sky Blue"

  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated $($file.FullName)" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Sky-blue theme applied." -ForegroundColor Cyan
Write-Host "Now run:" -ForegroundColor White
Write-Host "npm run build" -ForegroundColor Yellow
Write-Host ""
Write-Host "If the build passes, run:" -ForegroundColor White
Write-Host "git add ." -ForegroundColor Yellow
Write-Host "git commit -m `"Apply sky blue app theme`"" -ForegroundColor Yellow
Write-Host "git push" -ForegroundColor Yellow
