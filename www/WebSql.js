/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var Database = require('./Database');

// http://www.w3.org/TR/webdatabase/
var WebSQL = {};

// Database openDatabase(in DOMString name, in DOMString version, in DOMString displayName, in unsigned long estimatedSize, in optional DatabaseCallback creationCallback
// http://www.w3.org/TR/webdatabase/#databases
WebSQL.openDatabase = window.openDatabase || function (name, version, displayName, estimatedSize, creationCallback) {
    if(window.__webSqlDebugModeOn === true)
        console.log('openDatabase: name = ' + name);
    return new Database(name, version, displayName, estimatedSize, creationCallback);
};

module.exports = WebSQL;
