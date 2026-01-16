@echo off
chcp 65001 >nul
title 塔防游戏
echo ========================================
echo        塔防游戏 - 本地服务�?echo ========================================
echo.
echo 正在启动游戏...
echo.
echo 【注意】请不要关闭此窗口，关闭后游戏将停止运行
echo ========================================
echo.

cd /d "%~dp0"

start /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:8080"

powershell -ExecutionPolicy Bypass -Command " = 8080;  = New-Object System.Net.HttpListener; .Prefixes.Add('http://localhost:' +  + '/'); .Start(); Write-Host '服务器已启动: http://localhost:8080' -ForegroundColor Green; Write-Host '�?Ctrl+C 或关闭窗口停�? -ForegroundColor Yellow; Write-Host ''; while (.IsListening) { try {  = .GetContext();  = .Request;  = .Response;  = .Url.LocalPath; if ( -eq '/') {  = '/index.html' };  = Join-Path (Get-Location) .TrimStart('/').Replace('/', '\'); if (Test-Path  -PathType Leaf) {  = [System.IO.File]::ReadAllBytes();  = [System.IO.Path]::GetExtension().ToLower();  = switch () { '.html' {'text/html; charset=utf-8'} '.js' {'application/javascript'} '.css' {'text/css'} '.json' {'application/json'} '.png' {'image/png'} '.jpg' {'image/jpeg'} '.jpeg' {'image/jpeg'} '.gif' {'image/gif'} '.ico' {'image/x-icon'} '.wasm' {'application/wasm'} '.mp3' {'audio/mpeg'} '.ogg' {'audio/ogg'} '.wav' {'audio/wav'} '.bin' {'application/octet-stream'} '.cconb' {'application/octet-stream'} default {'application/octet-stream'} }; .ContentType = ; .ContentLength64 = .Length; .OutputStream.Write(, 0, .Length); } else { .StatusCode = 404; }; .Close(); } catch { } }"

pause
