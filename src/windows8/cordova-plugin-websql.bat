@ECHO OFF
SET full_path=%~dp0
cscript "%full_path%..\..\plugins\com.msopentech.websql\src\windows8\lib\cordova-plugin-websql.js" %0 //nologo
