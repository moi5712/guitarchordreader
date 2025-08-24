Write-Host "Starting Guitar Sheet Library..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
        Write-Host "Starting server..." -ForegroundColor Yellow
        
        # Start browser after a short delay
        Start-Process "http://localhost:3000/"
        
        # Start Node.js server
        node server.js
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "Node.js not found. Opening static file mode..." -ForegroundColor Yellow
    Start-Process "library.html"
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
