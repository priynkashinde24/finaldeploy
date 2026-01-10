# PowerShell script to create a small zip file excluding large folders
# This script removes node_modules, dist, build artifacts before zipping

Write-Host "🧹 Cleaning project for smaller zip size..." -ForegroundColor Cyan

# Folders to exclude from zip
$excludeFolders = @(
    "node_modules",
    "dist",
    "out",
    ".next",
    "build",
    "coverage",
    ".vercel",
    ".git",
    "*.log",
    ".DS_Store",
    "Thumbs.db"
)

Write-Host "📦 Creating zip file (excluding large folders)..." -ForegroundColor Yellow

# Get current directory name for zip file name
$currentDir = Split-Path -Leaf (Get-Location)
$zipFileName = "${currentDir}_clean.zip"
$tempFolder = "${currentDir}_temp"

# Create temporary folder
if (Test-Path $tempFolder) {
    Remove-Item $tempFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $tempFolder | Out-Null

Write-Host "📋 Copying files (excluding node_modules, dist, etc.)..." -ForegroundColor Yellow

# Use robocopy for better performance
$robocopyArgs = @(".", $tempFolder, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/XD", "node_modules", "dist", "out", ".next", "build", "coverage", ".vercel", ".git", "/XF", "*.log", "*.zip", "*.tar.gz", ".DS_Store", "Thumbs.db")

& robocopy @robocopyArgs | Out-Null

# Remove the extra files robocopy creates
if (Test-Path "$tempFolder\robocopy.log") {
    Remove-Item "$tempFolder\robocopy.log" -ErrorAction SilentlyContinue
}

Write-Host "🗜️  Creating zip file..." -ForegroundColor Yellow

# Remove existing zip if it exists
if (Test-Path $zipFileName) {
    Remove-Item $zipFileName -Force
}

# Create zip file
Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipFileName -Force

# Clean up temp folder
Remove-Item $tempFolder -Recurse -Force

# Get file sizes
$originalSize = (Get-ChildItem -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
$zipSize = (Get-Item $zipFileName).Length / 1MB

Write-Host ""
Write-Host "✅ Zip file created successfully!" -ForegroundColor Green
Write-Host "📁 File: $zipFileName" -ForegroundColor Cyan
Write-Host "📊 Original size: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Yellow
Write-Host "📊 Zip size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
Write-Host "💾 Space saved: $([math]::Round($originalSize - $zipSize, 2)) MB" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Excluded folders:" -ForegroundColor Cyan
$excludeFolders | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }

