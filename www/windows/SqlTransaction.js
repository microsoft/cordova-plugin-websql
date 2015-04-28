/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec'),
    WRITE_OPS_REGEX = /^\s*(?:create|drop|delete|insert|update)\s/i;

// http://www.w3.org/TR/webdatabase/#sqltransaction
var SqlTransaction = function (readOnly) {
    this.readOnly = readOnly;
    //this.Log('ctor');
};

SqlTransaction.prototype.Log = function (text) {
    if(window.__webSqlDebugModeOn === true)
        console.log('[SqlTransaction] id: ' + this.id + ', connectionId: ' + this.connectionId + '. | ' + text);
};

SqlTransaction.prototype.executeSql = function(sql, params, onSuccess, onError) {
    if (!sql) {
        this.Log('executeSql, ERROR: sql query can\'t be null or empty');
        throw new Error('sql query can\'t be null or empty');
    }

    if (typeof (this.connectionId) === 'undefined' || this.connectionId <= 0) {
        this.Log('executeSql, ERROR: Connection is not set');
        throw new Error('Connection is not set');
    }

    if (this.readOnly && WRITE_OPS_REGEX.test(sql)) {
        this.Log('executeSql, ERROR: Read-only transaction can\'t include write operations');
        throw new Error('Read-only transaction can\'t include write operations');
    }

    var me = this;
    var rollbackRequired = false;
    var lastError;

    this.sql = sql;
    this.params = params || [];
    this.successCallback = function (res) {
        // add missing .item() method as per http://www.w3.org/TR/webdatabase/#sqlresultset
        res.rows.item = function(index) {
            if (index < 0 || index >= res.rows.length) {
                return null;
            }
            return res.rows[index];
        };

        // process rows to be W3C spec compliant; TODO - this must be done inside native part for performance reasons
        for (var idxRow = 0; idxRow < res.rows.length; idxRow++) {
            var originalRow = res.rows[idxRow],
                refinedRow = {};

            res.rows[idxRow] = refinedRow;

            for (var idxColumn in originalRow) {
                if (originalRow.hasOwnProperty(idxColumn)){
                    refinedRow[originalRow[idxColumn].Key] = originalRow[idxColumn].Value;
                }
            }
        }

        if (onSuccess) {
            try {
                onSuccess(me, res);
            } catch (e) {
                if (onError) {
                    try {
                        rollbackRequired = onError(me, e);
                    } catch (errCbEx) {
                        me.Log("Error occured while executing error callback: " + errCbEx + "; query: " + me.sql);
                        rollbackRequired = true;
                    }
                } else {
                    rollbackRequired = true;
                }

                lastError = e;
            }
        }
    };

    this.errorCallback = function (error) {
        if (onError) {
            try {
                rollbackRequired = onError(me, error);
            } catch (errCbEx) {
                me.Log("Error occured while executing error callback: " + errCbEx);
                rollbackRequired = true;
            }
        } else {
            rollbackRequired = true;
        }
        lastError = error;
    };

    try {
        exec(this.successCallback, this.errorCallback, "WebSql", "executeSql", [this.connectionId, this.sql, this.params]);
    } catch(ex) {
        this.errorCallback(ex);
    }

    if (rollbackRequired !== false) {
        me.Log("Error occured while executing sql: " + me.sql + '. Error: ' + lastError);
        throw lastError;
    }
};

module.exports = SqlTransaction;
