@echo off
chcp 65001 > nul
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
set ANDROID_HOME=C:\Users\Tawfiek Fayez\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%
rem Signing comes from keystore.properties (gitignored) or TAREEQ_* env vars.
cd /d "%~dp0"
gradlew.bat --stop > nul 2>&1
if "%1"=="bundle" (
    gradlew.bat bundleRelease 2>&1
) else if "%1"=="release" (
    gradlew.bat assembleRelease 2>&1
) else (
    gradlew.bat assembleDebug 2>&1
)
echo GRADLE_EXIT_CODE=%errorlevel%
