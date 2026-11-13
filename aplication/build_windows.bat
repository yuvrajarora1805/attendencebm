@echo off
echo ===================================================
echo   AttendPro ERP - Native Windows Executable Build
echo ===================================================
echo.

where flutter >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Flutter SDK was not found in your system PATH.
    echo Please ensure Flutter is installed and added to environment variables.
    pause
    exit /b 1
)

echo [1/3] Fetching Flutter dependencies...
call flutter pub get

echo.
echo [2/3] Compiling Release Windows Native Executable (attendpro.exe)...
call flutter build windows --release

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Build failed! Please check the output above.
    pause
    exit /b 1
)

echo.
echo [3/3] Build Successful!
echo Dedicated Executable:
echo %CD%\build\windows\x64\runner\Release\attendpro.exe
echo.
echo You can now run 'attendpro.exe' or distribute the Release folder to Windows workstations.
echo ===================================================
pause

