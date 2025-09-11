Write-Host "Starting Guitar Sheet Library..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
        Write-Host "Starting server..." -ForegroundColor Yellow
        
        # Start Node.js server in the background
        Start-Process node -ArgumentList "modules/server.js" -NoNewWindow
        
        # Open browser after a short delay
        Start-Process "http://localhost:3000/"
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "Node.js not found. Opening static file mode..." -ForegroundColor Yellow
    
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
