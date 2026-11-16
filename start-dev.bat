@echo off
rem Windows: double-click to start server and app (web) in two windows
start "hanmadi server" cmd /k "cd /d %~dp0server && npm run dev"
start "hanmadi app" cmd /k "cd /d %~dp0app && npm run web"
