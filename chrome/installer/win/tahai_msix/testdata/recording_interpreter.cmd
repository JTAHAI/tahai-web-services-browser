@echo off
if "%TAHAI_PACKAGE_TEST_INTERPRETER_LOG%"=="" exit /b 97
>> "%TAHAI_PACKAGE_TEST_INTERPRETER_LOG%" echo %~f0^|%*
if /I "%~f1"=="%TAHAI_PACKAGE_TEST_FAIL_SCRIPT%" exit /b 37
exit /b 0
