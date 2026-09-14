@echo off
setlocal

rem Always run from the folder containing this launcher.
pushd "%~dp0" || (
    echo Could not open the Project Entity folder.
    pause
    exit /b 1
)

echo Starting Project Entity...

where npm.cmd >nul 2>nul || (
    echo.
    echo Node.js and npm were not found. Install Node.js, then try again.
    goto :failed
)

rem Install only when the local Vite dependency is missing.
if not exist "node_modules\vite\bin\vite.js" (
    echo Installing dependencies. This may take a moment on the first run...
    call npm.cmd install
    if errorlevel 1 goto :failed
)

echo Opening the game in your browser...
call npm.cmd run dev -- --open
if errorlevel 1 goto :failed

popd
exit /b 0

:failed
echo.
echo Project Entity could not be started. Review the error above.
popd
pause
exit /b 1
