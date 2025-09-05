@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM === Path Settings (now relative) ===
set "ENV_DIR=."
set "IN_DIR=%ENV_DIR%\saved_pages"
set "PY_SCRIPT=%ENV_DIR%\converter_v2.py"
set "OUT_DIR=..\sheets"

REM === Python Executable (EDIT THIS IF NEEDED) ===
REM set "PYEXE="  <-- REMOVED THIS LINE
where python >nul 2>&1 && set "PYEXE=python"
if not defined PYEXE where py >nul 2>&1 && set "PYEXE=py"
if not defined PYEXE (
    echo Python not found, please install it first & exit /b 1
)

REM === Check Required Files ===
if not exist "%ENV_DIR%\save_pages.js" (
    echo save_pages.js not found & exit /b 1
)
if not exist "%PY_SCRIPT%" (
    echo converter_v2.py not found & exit /b 1
)
if not exist "%IN_DIR%" mkdir "%IN_DIR%"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM === Step 1: Download HTML Pages ===
echo [1/3] Downloading HTML pages...
where node >nul 2>&1 || (
    echo Node.js not found, please install it first & exit /b 1
)
pushd "%ENV_DIR%"
node save_pages.js
if errorlevel 1 (
    echo Download step failed, stopping.
    popd & exit /b 1
)
popd

REM === Step 2: Convert HTML to TXT ===
echo [2/3] Converting HTML to TXT...
echo Using Python executable: %PYEXE%
echo Using Python script: %PY_SCRIPT%

for %%F in ("%IN_DIR%\*.html") do (
    if exist "%%F" (
        echo Processing: %%~nxF
        "%PYEXE%" "%PY_SCRIPT%" "%%F" "%OUT_DIR%"
        if errorlevel 1 (
            echo Conversion failed, keeping HTML: %%~nxF
        ) else (
            echo Conversion completed: %%~nxF
            del /q "%%F" >nul 2>&1
        )
    )
)

REM === Step 3: Move TXT files ===
REM This step is now redundant if converter_v2.py saves directly to OUT_DIR
REM if exist "%IN_DIR%\*.txt" (
REM     for %%T in ("%IN_DIR%\*.txt") do (
REM         move "%%T" "%OUT_DIR%" >nul 2>&1
REM     )
REM )

echo [3/3] All completed! TXT files are in: %OUT_DIR%
exit /b 0
