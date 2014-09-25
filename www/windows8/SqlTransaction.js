/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec'),
    WRITE_OPS_REGEX = /^\s*(?:create|drop|delete|insert|update)\s/i;

// http://www.w3.org/TR/webdatabase/#sqltransaction
var SqlTransaction = function (readOnly) {
    this.readOnly = readOnly;
};

SqlTransaction.prototype.executeSql = function(sql, params, onSuccess, onError) {

    if (!sql) {
        throw new Error('sql query can\'t be null or empty');
    }

    if (typeof (this.connectionId) == 'undefined' || this.connectionId <= 0) {
        throw new Error('Connection is not set');
    }

    if (this.readOnly && WRITE_OPS_REGEX.test(sql)) {
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
                if (onError) {
                    try {
                        rollbackRequired = onError(me, e);
                    } catch (errCbEx) {
                        console.log("Error occured while executing error callback: " + errCbEx + "; query: " + this.sql);
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
                console.log("Error occured while executing error callback: " + errCbEx);
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
        errorCallback(ex);
    }

    if (rollbackRequired) {
        console.log("Error occured while executing sql: " + this.sql + '. Error: ' + lastError);
        throw lastError;
    }
};

module.exports = SqlTransaction;
