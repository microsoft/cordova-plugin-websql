/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec'),
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

    this.lastTransactionId = 0;
    this.tasksQueue = [];
    this.tasksRunned = false;

    this.Log('new Database(); name = ' + name);

    var that = this;

    function creationCallbackAsyncWrapper() {
        setTimeout(creationCallback, 0);
    }

    exec(creationCallbackAsyncWrapper, function (err) {
        that.Log('Database.open() err = ' + JSON.stringify(err));
    }, "WebSql", "open", [this.name]);
};

Database.prototype.Log = function (text) {
    if(window.__webSqlDebugModeOn === true)
        console.log('[Database] name: ' + this.name + ', tasksQueue.length: ' + this.tasksQueue.length + '. | ' + text);
};

Database.prototype.guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    }
    return function () {
        return s4() + '' + s4() + '' + s4() + '' + s4() + '' +
               s4() + '' + s4() + '' + s4() + '' + s4();
    };
})();

Database.prototype.transaction = function (cb, onError, onSuccess, preflight, postflight, readOnly, parentTransaction) {
    //this.Log('transaction');

    if (typeof cb !== "function") {
        this.Log('transaction callback expected');
        throw new Error("transaction callback expected");
    }

    if (!readOnly) {
        readOnly = false;
    }

    var isRoot = (Boolean)(!parentTransaction);

    var me = this;

    this.transactionSuccess = function () {
        if (onSuccess) {
            onSuccess();
        }            

        me.runNext();
    };

    this.transactionError = function (tx, lastError) {
        if (onError) {
            onError(tx, lastError);
        }

        me.runNext();
    };

    this.runNext = function () {
        if (me.tasksQueue.length > 0) {
            var taskForRun = me.tasksQueue.shift();
            taskForRun.task.apply(me, taskForRun.params);
        } else {
            me.tasksRunned = false;
        }
    };

    this.pushTask = function (task) {
        me.tasksQueue.push({
            task: task,
            params: []
        });

        if (!me.tasksRunned) {
            me.tasksRunned = true;
            me.runNext();
        }
    };

    me.lastTransactionId = me.guid();
    var tx = new SqlTransaction(me.transactionError, me.transactionSuccess, postflight, readOnly, me.lastTransactionId, isRoot);

    var runTransaction = function() {
        try {
            var connectionSuccess = function(res) {
                //me.Log('transaction.run.connectionSuccess, res.connectionId: ' + res.connectionId);
                if (!res.connectionId) {
                    throw new Error('Could not establish DB connection');
                }

                tx.connectionId = res.connectionId;

                try {
                    var executeTransaction = function() {
                        //me.Log('transaction.run.connectionSuccess, executeTransaction');
                        if (preflight) {
                            preflight();
                        }

                        try {
                            cb(tx);
                        } catch (cbEx) {
                            me.Log('transaction.run.connectionSuccess, executeTransaction callback error: ' + JSON.stringify(cbEx));
                            me.transactionError(tx, cbEx);
                        }                        
                    };

                    var internalError = function(tx, err) {
                        me.Log('transaction.run.connectionSuccess, internalError: ' + JSON.stringify(err));
                        me.transactionError(tx, err);
                    };

                    exec(executeTransaction, internalError, "WebSql", "executeSql", [tx.connectionId, 'SAVEPOINT trx' + tx.id, []]);
                } catch (ex) {
                    me.Log('transaction.run exception: ' + JSON.stringify(ex));
                    throw ex;
                }
            };

            if (!parentTransaction) {
                //me.Log('transaction.run connect to dbName: ' + me.name);
                exec(function (res) {
                    //me.Log('transaction.run connect success: ' + JSON.stringify(res));
                    connectionSuccess(res);
                }, function(ex) {
                    me.Log('transaction.run connect error: ' + JSON.stringify(ex));
                }, "WebSql", "connect", [me.name]);
            } else {
                //me.Log('transaction.run using parent connectionId: ' + parentTransaction.connectionId);
                connectionSuccess({ connectionId: parentTransaction.connectionId });
            }
        } catch (ex) {
            me.Log('transaction.run DB connection error: ' + JSON.stringify(ex));
            throw ex;
        }
    };

    if (!isRoot) {
        //me.Log('transaction pushing as nested');
        parentTransaction.pushTransaction(tx, cb, onError, onSuccess, preflight, postflight, readOnly, parentTransaction);
    } else {
        //me.Log('transaction pushing as root');
        this.pushTask(runTransaction);
    }
};

Database.prototype.readTransaction = function (cb, onError, onSuccess, preflight, postflight, parentTransaction) {
    //this.Log('readTransaction');
    this.transaction(cb, onError, onSuccess, preflight, postflight, true, parentTransaction);
};

module.exports = Database;
