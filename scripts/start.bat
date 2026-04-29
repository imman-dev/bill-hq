@echo off
REM Bill HQ — convenience start script. Double-click to launch Mission Control.
cd /d "%~dp0\.."
echo.
echo Starting Bill HQ Mission Control...
echo Open http://localhost:3737 once it's online.
echo.
npm start
pause
