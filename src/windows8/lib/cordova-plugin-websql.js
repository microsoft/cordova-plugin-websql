/*
 * Copyright (c) Microsoft Open Technologies, Inc.  
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); 
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at 
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0 
 * 
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
 
var fso = WScript.CreateObject('Scripting.FileSystemObject');
var wscript_shell = WScript.CreateObject("WScript.Shell");

// logs messaged to stdout and stderr
function Log(msg, error) {
    if (error) {
        WScript.StdErr.WriteLine(msg);
    }
    else {
        WScript.StdOut.WriteLine(msg);
    }
}

// returns the contents of a file
function read(filename) {
    if (fso.FileExists(filename)) {
        var f=fso.OpenTextFile(filename, 1,2);
        var s=f.ReadAll();
        f.Close();
        return s;
    }
    else {
        Log('Cannot read non-existant file : ' + filename, true);
        WScript.Quit(2);
    }
    return null;
}

// writes content to a file
function write(filename, content) {
    var f=fso.OpenTextFile(filename, 2,2);
    f.Write(content);
    f.Close();
}

function getFileByExtension(path, ext) {
    var proj_folder = fso.GetFolder(path);
    var proj_files = new Enumerator(proj_folder.Files);
    for (;!proj_files.atEnd(); proj_files.moveNext()) {
        if (fso.GetExtensionName(proj_files.item()) == ext) {
            return path + '\\' + fso.GetFileName(proj_files.item());  
        }
    }

    return null;
}

function patchProject(path) {
    Log('Patching windows8 project file:');
    var projFile = getFileByExtension(path, 'jsproj');
    if (projFile == null) {
        Log('Project file not found', true);
        return;
    };
    Log('\t' + projFile);
    
    var projContent = read(projFile);

    if (projContent.indexOf('SQLite.WinRT81, Version=3.8.2') > 0) {
        Log('Already patched, skip...');
        return;
    }

    var patch = '<ItemGroup>' + 
      '<SDKReference Include="Microsoft.VCLibs, version=12.0" />' +
      '<SDKReference Include="SQLite.WinRT81, Version=3.8.2" />' + 
    '</ItemGroup>';

    projContent = projContent.replace('</Project>', patch + '</Project>');

    write(projFile, projContent);
}

function getTargetPlatform() {
    var buildCmd = wscript_shell.ExpandEnvironmentStrings("%CORDOVA_CMDLINE%").toLowerCase();
    
    if (buildCmd.indexOf('--arm')>=0) {
        return'ARM';
    }

    if (buildCmd.indexOf('--x86')>=0) {
        return 'x86';
    }

    // default
    return 'x64';
}

function patchSolution(path) {
    Log('Patching windows8 solution file:');
    var projFile = getFileByExtension(path, 'sln');
    if (projFile == null) {
        Log('Solution file not found', true);
        return;
    };
    Log('\t' + projFile);
    
    var targetPlatform = getTargetPlatform();
    Log('\tTarget build platform: ' + targetPlatform);

    var projContent = read(projFile);

    // if (projContent.indexOf('ActiveCfg = Debug|Any CPU') <= 0) {
    //     Log('Already patched, skip...');
    //     return;
    // }
    // TODO: refactor
    // Debug
    projContent = projContent.replace(/Any CPU.ActiveCfg = Debug\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.ActiveCfg = Debug|' + targetPlatform);
    projContent = projContent.replace(/Any CPU.Build.0 = Debug\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.Build.0 = Debug|' + targetPlatform);
    projContent = projContent.replace(/Any CPU.Deploy.0 = Debug\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.Deploy.0 = Debug|' + targetPlatform);
    // Release
    projContent = projContent.replace(/Any CPU.ActiveCfg = Release\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.ActiveCfg = Release|' + targetPlatform);
    projContent = projContent.replace(/Any CPU.Build.0 = Release\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.Build.0 = Release|' + targetPlatform);
    projContent = projContent.replace(/Any CPU.Deploy.0 = Release\|(x64|x86|ARM|Any CPU)/g, 'Any CPU.Deploy.0 = Release|' + targetPlatform);

    write(projFile, projContent);
}

var platform = wscript_shell.ExpandEnvironmentStrings("%CORDOVA_PLATFORMS%");
if (platform && platform != 'windows8') {
    Log('Platform is not windows8, skip..');
} else {
    var root = WScript.ScriptFullName.split('\\plugins\\com.msopentech.websql\\src\\windows8\\lib\\cordova-plugin-websql.js').join('');
    var projRoot = root + '\\platforms\\windows8';
    // not required anymore since plugman now provides <lib-file/>
    //patchProject(projRoot);
    patchSolution(projRoot);
}