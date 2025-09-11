@echo off
setlocal enabledelayedexpansion

:: =============================================
:: USER CONFIGURATION SECTION (MODIFY THIS PART)
:: =============================================
set "required_packages="
set "main_script=addTextbook_GUI.py"
:: =============================================
:: END OF CONFIGURATION SECTION
:: =============================================

echo Checking required packages...
set "missing_packages="

:: Check each required package
for %%p in (%required_packages%) do (
    python -c "import %%p" >nul 2>&1
    if !errorlevel! neq 0 (
        set "missing_packages=!missing_packages! %%p"
    )
)

:: Install missing packages
if not "!missing_packages!"=="" (
    echo Missing packages: !missing_packages!
    echo Installing required dependencies...
    pip install !missing_packages:~1! --user
    if !errorlevel! neq 0 (
        echo [ERROR] Installation failed! Please check network connection or install manually
        timeout /t 5 >nul
        exit /b 1
    )
    echo Dependencies installed successfully
)

:: Launch application and close batch window
start "" python "%main_script%"
exit
