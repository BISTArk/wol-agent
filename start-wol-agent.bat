@echo off
REM Configure your environment variables here
set PORT=4510
set WOL_AGENT_TOKEN=
set WOL_BROADCAST=255.255.255.255
set CORS_ORIGIN=*

REM Start the WoL agent in background
cscript //nologo "%~dp0launcher.vbs"
