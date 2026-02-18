@echo off
title Project Entity Launcher
echo ==========================================
echo   Starting Antigravity: Project Entity
echo ==========================================

echo.
echo [1/2] Launching Backend Server (ASP.NET Core)...
start "Project Entity Backend" dotnet run --project "ProjectEntity.Server"

echo.
echo [2/2] Launching Frontend Client (Vite)...
start "Project Entity Frontend" npm run dev -- --port 5173

echo.
echo ==========================================
echo   Game Launch Initiated!
echo   Backend: http://localhost:5073
echo   Frontend: http://localhost:5173
echo ==========================================
pause
