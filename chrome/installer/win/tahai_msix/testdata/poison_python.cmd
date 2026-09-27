@echo off
if "%TAHAI_PACKAGE_TEST_POISON_LOG%"=="" exit /b 98
>> "%TAHAI_PACKAGE_TEST_POISON_LOG%" echo %~f0^|%*
exit /b 99
