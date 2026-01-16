@echo off
title Tower Defense Game
echo ========================================
echo        Tower Defense - Local Server
echo ========================================
echo.
echo Starting game...
echo.
echo [NOTE] Do not close this window
echo ========================================
echo.
cd /d "%~dp0"
start /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:8080"
powershell -ExecutionPolicy Bypass -Command "$port = 8080; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:' + $port + '/'); $listener.Start(); Write-Host 'Server started: http://localhost:8080' -ForegroundColor Green; Write-Host 'Press Ctrl+C to stop' -ForegroundColor Yellow; Write-Host ''; while ($listener.IsListening) { try { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $localPath = $request.Url.LocalPath; if ($localPath -eq '/') { $localPath = '/index.html' }; $filePath = Join-Path (Get-Location) $localPath.TrimStart('/').Replace('/', '\\'); if (Test-Path $filePath -PathType Leaf) { $content = [System.IO.File]::ReadAllBytes($filePath); $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); $contentType = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.js' {'application/javascript'} '.css' {'text/css'} '.json' {'application/json'} '.png' {'image/png'} '.jpg' {'image/jpeg'} '.jpeg' {'image/jpeg'} '.gif' {'image/gif'} '.ico' {'image/x-icon'} '.wasm' {'application/wasm'} '.mp3' {'audio/mpeg'} '.ogg' {'audio/ogg'} '.wav' {'audio/wav'} '.bin' {'application/octet-stream'} '.cconb' {'application/octet-stream'} default {'application/octet-stream'} }; $response.ContentType = $contentType; $response.ContentLength64 = $content.Length; $response.OutputStream.Write($content, 0, $content.Length); } else { $response.StatusCode = 404; Write-Host ('404: ' + $localPath) -ForegroundColor Red; }; $response.Close(); } catch { Write-Host $_.Exception.Message -ForegroundColor Red; } }"
pause