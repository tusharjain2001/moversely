@echo off
rem Starts the whole demo on this laptop and gives it a public https link.
rem Keep the three windows open while the client is testing.
rem Settings (admin password, database, chat model) are in ai\.env.

cd /d "%~dp0"

rem The "Talk to AI" chat needs Ollama running (it starts with Windows; this
rem starts it if it was closed).
curl -s http://127.0.0.1:11434/api/version >nul 2>&1 || start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"

start "1 - AI server" cmd /k "cd ai && .venv\Scripts\python server_local.py"
start "2 - Website" cmd /k "cd web && npx next start -p 3000"

echo Waiting for the servers to start...
timeout /t 25 /nobreak >nul

echo.
echo ============================================================
echo  In the "3 - Public link" window, look for a line like:
echo     https://something-random.trycloudflare.com
echo  That is the link to send to the client.
echo  Leads page for the team: that link + /admin
echo ============================================================
start "3 - Public link" cmd /k "tools\cloudflared.exe tunnel --no-autoupdate --url http://localhost:3000"
