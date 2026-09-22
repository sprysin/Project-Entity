@echo off
setlocal

rem Convenience launcher for the locally compiled desktop game.
if exist "%~dp0src-tauri\target\release\project-entity.exe" (
    start "" "%~dp0src-tauri\target\release\project-entity.exe"
    exit /b 0
)
echo Install Project Entity using its Setup.exe, then launch it from the Start menu.
echo Developers: run npm run desktop:build to create the executable first.
pause
exit /b 1
