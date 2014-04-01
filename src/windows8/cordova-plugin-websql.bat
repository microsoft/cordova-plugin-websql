@ECHO OFF
SET full_path=%~dp0
cscript "%full_path%lib\cordova-plugin-websql.js" %0 //nologo
