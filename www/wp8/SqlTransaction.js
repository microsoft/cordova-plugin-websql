/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec'),
    WRITE_OPS_REGEX = /^\s*(?:create|drop|delete|insert|update)\s/i;

// http://www.w3.org/TR/webdatabase/#sqltransaction
var SqlTransaction = function (onError, onSuccess, postflight, readOnly, transactionId, isRoot) {
    this.onError = onError;
    this.onSuccess = onSuccess;
    this.postflight = postflight;
    this.readOnly = readOnly;
    this.id = transactionId;
    this.isRoot = isRoot;

    this.statementsQueue = [];
    this.transactionStarted = false;

    this.errorOccured = false;
    //this.Log('ctor');
};

SqlTransaction.prototype.Log = function (text) {
    if(window.__webSqlDebugModeOn === true)
        console.log('[SqlTransaction] id: ' + this.id + ', connectionId: ' + this.connectionId + ', errorOccured: ' + this.errorOccured + '; statementsQueue.length = ' + this.statementsQueue.length + '. | ' + text);
};

SqlTransaction.prototype.statementCompleted = function () {
    //this.Log('statementCompleted');

    var me = this;
    if (this.errorOccured !== false) {
        //me.Log('statementCompleted - error occured, going to ROLLBACK...');

        exec(function() {
            //me.Log('statementCompleted - error occured, ROLLBACK SUCCESS!');

            exec(function () {
                //me.Log('statementCompleted - error occured, ROLLBACK SUCCESS, going to DISCONNECT');
                if (me.isRoot) {
                    exec(function () {
                        //me.Log('statementCompleted - error occured, ROLLBACK SUCCESS, DISCONNECTed successfully');
                    }, function (err) {
                        me.Log('statementCompleted - error occured, ROLLBACK SUCCESS, DISCONNECT error: ' + JSON.stringify(err));
                    }, "WebSql", "disconnect", [me.connectionId]);
                }

                me.Log('statementCompleted - error occured, ROLLBACK SUCCESS, last error: ' + JSON.stringify(me.lastError));
                if (me.onError)
                    me.onError(me, me.lastError);
            }, function (err) {
                me.Log('statementCompleted - error occured, ROLLBACK SUCCESS, RELEASE after rollback error: ' + JSON.stringify(err));
                if (me.onError)
                    me.onError(me, err);
            }, "WebSql", "executeSql", [me.connectionId, 'RELEASE trx' + me.id, []]);

        }, function(err) {
            me.Log('statementCompleted - error occured, ROLLBACK error: ' + JSON.stringify(err));
        }, "WebSql", "executeSql", [this.connectionId, 'ROLLBACK TO trx' + this.id, []]);

    } else if (this.statementsQueue.length === 0) {
        //me.Log('statementCompleted - statementsQueue is empty, transactionStarted: ' + me.transactionStarted);

        exec(function () {
            if (me.postflight) {
                me.postflight();
            }

            if (me.isRoot) {
                //me.Log('statementCompleted - statementsQueue is empty, going to DISCONNECT after COMMIT');
                exec(function () {
                    //me.Log('statementCompleted - statementsQueue is empty, DISCONNECT after COMMIT success');
                    if (me.onSuccess) {
                        me.onSuccess();
                    }
                }, function (err) {
                    me.Log('statementCompleted - statementsQueue is empty, DISCONNECT after COMMIT error: ' + JSON.stringify(err));
                    if (me.onError)
                        me.onError(me, me.lastError);
                }, "WebSql", "disconnect", [me.connectionId]);
            } else {
                if (me.onSuccess) {
                    me.onSuccess();
                }
            }

        }, this.onError, "WebSql", "executeSql", [this.connectionId, 'RELEASE trx' + this.id, []]);
    }
    else {
        var taskForRun = this.statementsQueue.shift();
        //me.Log('statementCompleted - executing next query: ' + JSON.stringify(taskForRun));

        try {
            taskForRun.task.apply(this, taskForRun.params);
        } catch (e) {
            me.Log('statementCompleted - next query exception: ' + JSON.stringify(e));
            if (onError) {
                this.errorOccured = onError(me, e);
            } else {
                this.errorOccured = true;
            }

            this.statementCompleted();
        }
    }
};

SqlTransaction.prototype.pushTransaction = function(tx, cb, onError, onSuccess, preflight, postflight, readOnly, parentTransaction) {
    //if (!!parentTransaction) {
    //    this.Log('pushTransaction: parentTransaction.id: ' + parentTransaction.id + ', parentTransaction.connectionId: ' + parentTransaction.connectionId + ', new tx.id: ' + tx.id);
    //} else {
    //    this.Log('pushTransaction: parentTransaction is not defined');
    //}

    var me = this;

    this.transactionSuccess = function () {
        if (onSuccess)
            onSuccess();

        me.statementCompleted();
    };

    this.transactionError = function (tx, lastError) {
        if (onError)
            onError(tx, lastError);

        me.statementCompleted();
    };

    tx.onSuccess = this.transactionSuccess;
    tx.onError = this.transactionError;
    
    var runTransaction = function () {
        try {
            var connectionSuccess = function (res) {
                //me.Log('pushTransaction.connectionSuccess, res.connectionId: ' + res.connectionId);
                if (!res.connectionId) {
                    throw new Error('Could not establish DB connection');
                }

                tx.connectionId = res.connectionId;

                try {
                    var executeTransaction = function () {
                        //me.Log('pushTransaction.executeTransaction callback');
                        if (preflight) {
                            preflight();
                        }

                        try {
                            cb(tx);
                        } catch (cbEx) {
                            me.Log('pushTransaction.executeTransaction callback error: ' + JSON.stringify(cbEx));
                            me.transactionError(tx, cbEx);
                        }
                    };

                    var internalError = function (tx, err) {
                        me.Log('pushTransaction.executeTransaction internalError: ' + JSON.stringify(err));
                        me.transactionError(tx, err);
                    };

                    exec(executeTransaction, internalError, "WebSql", "executeSql", [tx.connectionId, 'SAVEPOINT trx' + tx.id, []]);
                } catch (ex) {
                    me.Log('pushTransaction.executeTransaction error: ' + JSON.stringify(ex));
                    throw ex;
                }
            };

            connectionSuccess({ connectionId: parentTransaction.connectionId });
        } catch (ex) {
            me.Log('pushTransaction.executeTransaction DB connection error: ' + JSON.stringify(ex));
            throw ex;
        }
    };

    this.statementsQueue.push({
        task: runTransaction,
        params: []
    });

    //this.Log('pushTransaction, transactionStarted: ' + this.transactionStarted + ', statementsQueue.length: ' + this.statementsQueue.length);

    if (this.transactionStarted === false && this.statementsQueue.length === 1) {
        this.transactionStarted = true;
        var taskForRun = this.statementsQueue.shift();
        taskForRun.task.apply(this, taskForRun.params);
    }
};

SqlTransaction.prototype.executeSql = function(sql, params, onSuccess, onError) {
    //this.Log('executeSql, sql: ' + sql);
    // BUG: We can loose a statement here if DB processing works faster than next executeSql call - in this case transaction will be finalized
    this.statementsQueue.push({
        task: this.executeSqlInternal,
        params: [sql, params, onSuccess, onError]
    });

    if (this.transactionStarted === false && this.statementsQueue.length === 1) {       
        this.transactionStarted = true;
        var taskForRun = this.statementsQueue.shift();
        //this.Log('executeSql, running task');
        try {
            taskForRun.task.apply(this, taskForRun.params);
        } catch (e) {
            me.Log('executeSql - next query exception: ' + JSON.stringify(e));
            if (onError) {
                this.errorOccured = onError(me, e);
            } else {
                this.errorOccured = true;
            }

            this.statementCompleted();
        }        
    }
};

SqlTransaction.prototype.executeSqlInternal = function(sql, params, onSuccess, onError) {
    //this.Log('executeSqlInternal');

    if (!sql) {
        this.Log('executeSqlInternal, ERROR: sql query can\'t be null or empty');
        throw new Error('sql query can\'t be null or empty');
    }

    if (typeof (this.connectionId) == 'undefined' || this.connectionId <= 0) {
        this.Log('executeSqlInternal, ERROR: Connection is not set');
        throw new Error('Connection is not set');
    }

    if (this.readOnly && WRITE_OPS_REGEX.test(sql)) {
        this.Log('executeSqlInternal, ERROR: Read-only transaction can\'t include write operations');
        throw new Error('Read-only transaction can\'t include write operations');
    }

    var me = this;
    var rollbackRequired = false;
    var lastError;

    this.sql = sql;
    this.params = params || [];

    this.successCallback = function (res) {
        //me.Log('executeSqlInternal, successCallback, res: ' + JSON.stringify(res));
        // add missing .item() method as per http://www.w3.org/TR/webdatabase/#sqlresultset
        res.rows.item = function(index) {
            if (index < 0 || index >= res.rows.length) {
                return null;
            }
            return res.rows[index];
        };

        // process rows to be W3C spec compliant; TODO - this must be done inside native part for performance reasons
        for (idxRow = 0; idxRow < res.rows.length; idxRow++) {
            var originalRow = res.rows[idxRow],
                refinedRow = {},
                idxColumn;
          
            res.rows[idxRow] = refinedRow;

            for (idxColumn in originalRow) {
                refinedRow[originalRow[idxColumn].Key] = originalRow[idxColumn].Value;
            } 
        }
   
        if (onSuccess) {
            try {
                onSuccess(me, res);
            } catch (e) {
                me.Log('executeSqlInternal, successCallback, onSuccess exception: ' + JSON.stringify(e));

                if (onError) {
                    rollbackRequired = onError(me, e);
                } else {
                    rollbackRequired = true;
                }

                me.errorOccured = rollbackRequired;
                me.lastError = e;
            }
        }

        //me.Log('executeSqlInternal, successCallback FINISH');
        me.statementCompleted();
    };

    this.errorCallback = function (error) {
        //me.Log('executeSqlInternal, errorCallback');
        if (onError) {
            try {
                rollbackRequired = onError(me, error);
            } catch (e) {
                me.Log('executeSqlInternal, errorCallback exception: ' + JSON.stringify(e));
                rollbackRequired = true;
            }            
        } else {
            rollbackRequired = true;
        }
        me.lastError = error;
        me.errorOccured = rollbackRequired;

        //me.Log('executeSqlInternal, errorCallback FINISH');
        me.statementCompleted();
    };

    function internalSuccess(res) {
        try {
            //me.Log('executeSqlInternal, internalSuccess');
            me.successCallback(res);
        } catch (e) {
            me.Log('executeSqlInternal, internalSuccess callback exception: ' + JSON.stringify(e));
            throw e;
        }
    }

    function internalError(err) {
        try {
            me.Log('executeSqlInternal, internalError: ' + JSON.stringify(err));
            me.errorCallback(err);
        } catch (e) {
            me.Log('executeSqlInternal, internalError callback exception: ' + JSON.stringify(e));
            throw e;
        }
    }

    try {
        //me.Log('executeSqlInternal, going to executeSql: ' + me.sql);
        exec(internalSuccess, internalError, "WebSql", "executeSql", [this.connectionId, this.sql, this.params]);
    } catch (ex) {
        me.Log('executeSqlInternal, executeSql error: ' + JSON.stringify(ex));
        me.errorCallback(ex);
    }
};

module.exports = SqlTransaction;
