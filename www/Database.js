/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec');
    SqlTransaction = require('./SqlTransaction');

var Database = function (name, version, displayName, estimatedSize, creationCallback) {
    // // Database openDatabase(in DOMString name, in DOMString version, in DOMString displayName, in unsigned long estimatedSize, in optional DatabaseCallback creationCallback
    // TODO: duplicate native error messages
    if (!name) {
        throw new Error('Database name can\'t be null or empty');
    }
    this.name = name;
    this.version = version; // not supported
    this.displayName = displayName; // not supported
    this.estimatedSize = estimatedSize; // not supported

    exec(creationCallback, null, "WebSql", "open", [this.name]);
    
};

Database.prototype.transaction = function (cb) {
    var tx = new SqlTransaction();
    setTimeout(function () {
        cb(tx);
    }, 0);
};

Database.prototype.readTransaction = Database.prototype.transaction;

module.exports = Database;