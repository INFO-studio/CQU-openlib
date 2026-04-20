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

:menu
cls
echo ==========================================================
echo            Anaconda ^& CQU-OpenLib Manager (v2.0)
echo ==========================================================
echo  [1] View all Anaconda environments
echo  [2] Create a new Anaconda environment
echo  [3] Delete an Anaconda environment
echo ----------------------------------------------------------
echo  [4] Setup Project (Create Env ^& Install Dependencies)
echo  [5] Run Document Manager GUI
echo ----------------------------------------------------------
echo  [6] Check Current Env Status (Python ^& Packages)
echo  [7] Reset Env (Clear all packages ^& Re-install)
echo ----------------------------------------------------------
echo  [0] Exit
echo ==========================================================
set /p choice="Enter your choice (0-7): "

if "%choice%"=="1" goto view_envs
if "%choice%"=="2" goto create_env
if "%choice%"=="3" goto delete_env
if "%choice%"=="4" goto setup_project
if "%choice%"=="5" goto run_project
if "%choice%"=="6" goto check_status
if "%choice%"=="7" goto reset_env
if "%choice%"=="0" goto end

echo Invalid input, please try again!
echo Press any key to continue... & pause >nul
goto menu

:view_envs
cls
echo Fetching environment list...
echo.
call conda env list
echo.
echo Press any key to continue... & pause >nul
goto menu

:create_env
cls
set /p custom_env="Enter the new environment name: "
set /p py_version="Enter Python version (e.g., 3.10, press Enter for 3.10): "
if "%py_version%"=="" set py_version=3.10
echo.
echo Creating environment: %custom_env% (Python %py_version%)...
call conda create -n %custom_env% python=%py_version% -y
echo.
echo Environment created successfully!
echo Press any key to continue... & pause >nul
goto menu

:delete_env
cls
echo Current environments:
call conda env list
echo.
set /p del_name="Enter the environment name to delete: "
echo.
echo Deleting environment: %del_name%...
call conda remove -n %del_name% --all -y
echo.
echo Environment deleted successfully!
echo Press any key to continue... & pause >nul
goto menu

:setup_project
cls
echo Setting up %ENV_NAME%...
echo [1/3] Creating Python 3.10 environment...
call conda create -n %ENV_NAME% python=3.10 -y
echo [2/3] Installing requirements from %REQS_PATH%...
call conda activate %ENV_NAME%
pip install -r "%REQS_PATH%"
echo [3/3] Installing PySide6...
pip install PySide6
echo Setup completed!
echo Press any key to continue... & pause >nul
goto menu

:run_project
cls
echo Starting GUI...
call conda activate %ENV_NAME%
:: Ensure we are in the script's directory for relative execution
cd /d "%~dp0"
python "%APP_PATH%"
echo.
echo Press any key to continue... & pause >nul
goto menu

:check_status
cls
echo Checking status for environment: %ENV_NAME%
echo ----------------------------------------------------------
call conda activate %ENV_NAME%
echo Python Version:
python --version
echo.
echo Installed Packages (pip):
pip list
echo.
echo Press any key to continue... & pause >nul
goto menu

:reset_env
cls
echo WARNING: This will uninstall ALL packages in %ENV_NAME% and re-install them.
set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" goto menu

call conda activate %ENV_NAME%
echo.
echo [1/2] Clearing all packages...
:: Create a temporary list and uninstall everything
pip freeze > temp_pkg_list.txt
pip uninstall -r temp_pkg_list.txt -y
del temp_pkg_list.txt

echo.
echo [2/2] Re-linking (Installing) packages from requirements...
pip install -r "%REQS_PATH%"
pip install PySide6

echo.
echo Environment reset completed!
echo Press any key to continue... & pause >nul
goto menu

:end
exit