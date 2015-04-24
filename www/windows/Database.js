
/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */

/*global require, module*/

var exec = require('cordova/exec'),
    SqlTransaction = require('./SqlTransaction');

var READONLY = true;
var READWRITE = false;

var Database = function (name, version, displayName, estimatedSize, creationCallback) {
    // // Database openDatabase(in DOMString name, in DOMString version, in DOMString displayName, in unsigned long estimatedSize, in optional DatabaseCallback creationCallback
    // TODO: duplicate native error messages
    if (!name) {
        throw new Error('Database name can\'t be null or empty');
    }
    this.name = name;

    // This is due to SQLite limitation which uses integer version type
    // (websql spec uses strings so you can use “1.3-dev2” for example)
    if (version === 0 || version === "") {
        this.version = 0;
    } else {
        this.version = parseInt(version, 10);
        if (isNaN(this.version)) {
            throw new Error("Datavase version should be a number or its string representation");
        }
    }

    this.displayName = displayName; // not supported
    this.estimatedSize = estimatedSize; // not supported

    this.lastTransactionId = 0;

    this.Log('new Database(); name = ' + name);

    var that = this;
    var failed = false;
    var fail = function(err) {
        that.Log('Database.open() err = ' + JSON.stringify(err));
    };

    function callback() {

        // try to get verfion for existing database
        exec(function (actualVersion) {
            if (that.version == 0 || that.version == actualVersion) {
                // If we don't care of DB version or versions are matching
                // then set current version to actual
                that.version = actualVersion;
            } else if (actualVersion == 0) {
                // If actual version is 0, that means that database is just created
                // or it's version hadn't been set yet. In this case we're update it's version to version, provided by user
                exec(null, fail, "WebSql", "setVersion", [that.name, that.version]);
            } else {
                // Otherwise fail with version mismatch error
                failed = actualVersion;
            }
        }, fail, "WebSql", "getVersion", [that.name]);

        // On windows proxy.getVersion method is sync, so the following
        // conditional statement will be executed only after return from exec's success callback

        if (!failed) {
            // We'll schedule a creation callback invocation only if there is no version mismatch
            if(creationCallback) { setTimeout(creationCallback.bind(null, that), 0); }
        }
    }

    exec(callback, fail, "WebSql", "open", [this.name]);

    if (failed) {
        throw new Error("Unable to open database, version mismatch, " + that.version + " does not match the currentVersion of " + failed);
    }
};

Database.prototype.Log = function (text) {
    if(window.__webSqlDebugModeOn === true)
        console.log('[Database] name: ' + this.name + ', lastTransactionId: ' + this.lastTransactionId + '. | ' + text);
};

Database.prototype.transaction = function (cb, onError, onSuccess, preflight, postflight, readOnly, parentTransaction) {
    this.Log('transaction');

    if (typeof cb !== "function") {
        this.Log('transaction callback expected');
        throw new Error("transaction callback expected");
    }

    if (!readOnly) {
        readOnly = READWRITE;
    }

    var me = this;
    var isRoot = !parentTransaction;
    this.lastTransactionId++;

    var runTransaction = function() {
        var tx = new SqlTransaction(readOnly);
        tx.id = me.lastTransactionId;
        try {
            if (isRoot) {
                exec(function(res) {
                    if (!res.connectionId) {
                        me.Log('transaction.run DB connection error');
                        throw new Error('Could not establish DB connection');
                    }

                    //me.Log('transaction.run.connectionSuccess, res.connectionId: ' + res.connectionId);
                    tx.connectionId = res.connectionId;
                }, null, "WebSql", "connect", [me.name]);
            } else {
                tx.connectionId = parentTransaction.connectionId;
            }

            tx.executeSql('SAVEPOINT trx' + tx.id);

            if (preflight) {
                preflight();
            }

            try {
                cb(tx);
            } catch (cbEx) {
                me.Log('Database.prototype.transaction callback error; lastTransactionId = ' + JSON.stringify(me.lastTransactionId) + '; err = ' + JSON.stringify(cbEx));
                throw cbEx;
            }

            if (postflight) {
                postflight();
            }

            tx.executeSql('RELEASE trx' + tx.id);
        } catch (ex) {
            me.Log('transaction.run callback error, lastTransactionId = ' + JSON.stringify(me.lastTransactionId) + '; error: ' + ex);

            tx.executeSql('ROLLBACK TO trx' + tx.id);
            tx.executeSql('RELEASE trx' + tx.id);
            if (onError) {
                onError(tx, ex);
            }
            return;
        } finally {
            if (isRoot) {
                exec(null, null, "WebSql", "disconnect", [tx.connectionId]);
            }
        }

        if (onSuccess) {
            onSuccess();
        }
    };

    if (isRoot) {
        setTimeout(runTransaction, 0);
    } else {
        runTransaction();
    }
};

Database.prototype.readTransaction = function (cb, onError, onSuccess, preflight, postflight, parentTransaction) {
    this.transaction(cb, onError, onSuccess, preflight, postflight, READONLY, parentTransaction);
};

Database.prototype.changeVersion = function (oldVersion, newVersion, cb, onError, onSuccess, parentTransaction) {

    var transaction;
    var that = this;
    var oldver = parseInt(oldVersion, 10);
    var newVer = parseInt(newVersion, 10);

    if (isNaN(oldver) || isNaN(newVer)) {
        throw new Error("Version parameters should be valid integers or its' string representation");
    }

    var callback = function (tx) {
        // Just save a transaction here so we can use it later in postflight
        transaction = tx;
        cb(tx);
    };

    var preflight = function() {
        if (oldver != that.version) {
            throw new Error("Version mismatch. First param to changeVersion is not equal to current database version");
        }
    };

    var postflight = function() {
        transaction.executeSql('PRAGMA user_version=' + newVer, null, function () {
            that.version = newVer;
        }, function() {
            throw new Error("Failed to set database version");
        });
    };

    this.transaction(callback, onError, onSuccess, preflight, postflight, READWRITE, parentTransaction);
};

module.exports = Database;
