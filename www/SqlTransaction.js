/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var exec = require('cordova/exec');

// http://www.w3.org/TR/webdatabase/#sqltransaction
var SqlTransaction = function() {
};

SqlTransaction.prototype.executeSql = function(sql, params, onSuccess, onError) {

    if (!sql) {
        throw new Error('sql query can\'t be null or empty');
    }

    var me = this;

    this.sql = sql;
    this.params = params;
    this.successCallback = function (res) {
        // add missing .item() method as per http://www.w3.org/TR/webdatabase/#sqlresultset
        res.rows.item = function(index) {
            if (index < 0 || index >= res.rows.length) {
                return null;
            }
            return res.rows[index];
        };

        for (idxRow = 0; idxRow < res.rows.length; idxRow++) {
            var row = res.rows[idxRow];
            for (idxColumn = 0; idxColumn < row.length; idxColumn++) {
                row[row[idxColumn].Key] = row[idxColumn].Value;
            }
        }
       
        onSuccess(me, res);
    };
    this.errorCallback = onError;
    
    try {
        exec(this.successCallback, this.errorCallback, "WebSql", "executeSql", [this.sql, this.params]);
    } catch(ex) {
        errorCallback(ex);
    }
};

module.exports = SqlTransaction;