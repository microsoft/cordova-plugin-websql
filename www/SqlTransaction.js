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
       
	    // Success might be null or undefined
	    if (onSuccess)
			onSuccess(me, res);
    };
    this.errorCallback = function (error) {
        onError && onError(me, error);
    };
    
    try {
        exec(this.successCallback, this.errorCallback, "WebSql", "executeSql", [this.sql, this.params]);
    } catch(ex) {
        errorCallback(ex);
    }
};

module.exports = SqlTransaction;