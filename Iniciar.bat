@echo off
REM ============================================================
REM  Iniciar.bat - Abre la pagina web de Sparrow Nesting
REM  Doble clic en este archivo y se abre el navegador solo.
REM  Cierra esta ventana negra para detener el servidor.
REM ============================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    echo Abriendo con Python...
    start "" http://localhost:8080/index.html
    python -m http.server 8080
    exit /b
)

where node >nul 2>nul
if %errorlevel%==0 (
    echo Abriendo con Node...
    start "" http://localhost:8080/index.html
    npx --yes serve -l 8080
    exit /b
)

echo Abriendo con PowerShell (siempre disponible en Windows)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
endlocal
