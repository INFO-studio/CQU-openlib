@echo off
:: Set console encoding to UTF-8 to support relative paths and potential Chinese metadata
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: Define relative paths
:: Script is in: ...\scripts\文档管理器
:: Requirements is in: ...\requirements.txt
set "ENV_NAME=cqu-openlib-manager-05FA"
set "REQS_PATH=..\..\requirements.txt"
set "APP_PATH=gui\app.py"

echo Starting GUI...
call conda activate %ENV_NAME%
:: Ensure we are in the script's directory for relative execution
cd /d "%~dp0"
python "%APP_PATH%"
pause