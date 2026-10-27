@echo off
setlocal
set "FINTIN_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not exist "%FINTIN_PWSH%" (
  echo No se encuentra PowerShell 7. Instala PowerShell 7 o ejecuta backup-shared.ps1 con pwsh.
  pause
  exit /b 1
)
"%FINTIN_PWSH%" -NoProfile -STA -File "%~dp0backup-shared.ps1" -ToolsDirectory "%TEMP%\FinTin-postgresql-17-tools"
echo.
echo Consulta el resultado en %TEMP%\FinTin-backup-result.json
pause
