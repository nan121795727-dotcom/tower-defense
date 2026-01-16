@echo off
chcp 65001 >nul
title 塔防游戏
echo ========================================
echo        塔防游戏 - 本地服务器
echo ========================================
echo.
echo 正在启动游戏...
echo.
echo 【注意】请不要关闭此窗口，关闭后游戏将停止运行
echo ========================================
echo.

cd /d "%~dp0build\web-desktop"

:: 延迟1秒后打开浏览器
start /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:8080"

:: 使用 PowerShell 启动简易 HTTP 服务器
powershell -ExecutionPolicy Bypass -Command ^
  "$port = 8080; " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add('http://localhost:' + $port + '/'); " ^
  "$listener.Start(); " ^
  "Write-Host '服务器已启动: http://localhost:8080' -ForegroundColor Green; " ^
  "Write-Host '按 Ctrl+C 停止服务器' -ForegroundColor Yellow; " ^
  "Write-Host ''; " ^
  "while ($listener.IsListening) { " ^
  "  try { " ^
  "    $context = $listener.GetContext(); " ^
  "    $request = $context.Request; " ^
  "    $response = $context.Response; " ^
  "    $localPath = $request.Url.LocalPath; " ^
  "    if ($localPath -eq '/') { $localPath = '/index.html' }; " ^
  "    $filePath = Join-Path (Get-Location) $localPath.TrimStart('/').Replace('/', '\\'); " ^
  "    if (Test-Path $filePath -PathType Leaf) { " ^
  "      $content = [System.IO.File]::ReadAllBytes($filePath); " ^
  "      $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); " ^
  "      $contentType = switch ($ext) { " ^
  "        '.html' {'text/html; charset=utf-8'} " ^
  "        '.js' {'application/javascript'} " ^
  "        '.css' {'text/css'} " ^
  "        '.json' {'application/json'} " ^
  "        '.png' {'image/png'} " ^
  "        '.jpg' {'image/jpeg'} " ^
  "        '.jpeg' {'image/jpeg'} " ^
  "        '.gif' {'image/gif'} " ^
  "        '.ico' {'image/x-icon'} " ^
  "        '.wasm' {'application/wasm'} " ^
  "        '.mp3' {'audio/mpeg'} " ^
  "        '.ogg' {'audio/ogg'} " ^
  "        '.wav' {'audio/wav'} " ^
  "        '.bin' {'application/octet-stream'} " ^
  "        '.cconb' {'application/octet-stream'} " ^
  "        default {'application/octet-stream'} " ^
  "      }; " ^
  "      $response.ContentType = $contentType; " ^
  "      $response.ContentLength64 = $content.Length; " ^
  "      $response.OutputStream.Write($content, 0, $content.Length); " ^
  "    } else { " ^
  "      $response.StatusCode = 404; " ^
  "      Write-Host ('404: ' + $localPath) -ForegroundColor Red; " ^
  "    }; " ^
  "    $response.Close(); " ^
  "  } catch { " ^
  "    Write-Host $_.Exception.Message -ForegroundColor Red; " ^
  "  } " ^
  "}"

pause
