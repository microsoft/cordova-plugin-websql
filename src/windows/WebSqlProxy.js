
/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */

/*global module, require, SQLite, Windows*/

var localFolderPath = Windows.Storage.ApplicationData.current.localFolder.path;
var pathSeparator = "\\";
function generateDbPath(dbFileName) {
    return localFolderPath + pathSeparator + dbFileName;
}

module.exports = {
    db: null,

    getVersion: function(success, fail, args) {
        try {
            var dbName = args.shift();
            module.exports.db = generateDbPath(dbName);

            var res = SQLite.Proxy.SQLiteProxy.getVersion(module.exports.db);
            res = JSON.parse(res);

            if (res && res.message) {
                fail(res);
                return;
            }

            success(res);
        } catch (ex) {
            fail(ex);
        }
    },

    setVersion: function (success, fail, args) {
        try {
            var dbName = args.shift();
            var version = args.shift();

            module.exports.db = generateDbPath(dbName);

            var res = SQLite.Proxy.SQLiteProxy.setVersion(module.exports.db, version);
            res = JSON.parse(res);

            if (res && res.message) {
                fail(res);
                return;
            }

            if (res === -1) {
                fail(res);
                return;
            }

            success(res);
        } catch (ex) {
            fail(ex);
        }
    },

    open: function (success, fail, args) {
        try {
            module.exports.db = generateDbPath(args[0]);
            success();
        } catch(ex) {
            fail(ex);
        }
    },

    close: function (success, fail, args) {
        try {
            module.exports.db = null;
            success();
        } catch (ex) {
            fail(ex);
        }
    },

    executeSql: function (success, fail, args) {
        try {
            var connectionId = args.shift();
            var res = SQLite.Proxy.SQLiteProxy.executeSql(connectionId, args);
            res = JSON.parse(res);

            // You can't access the original message text from JavaScript code.
            // http://msdn.microsoft.com/en-US/library/windows/apps/br230301.aspx#ThrowingExceptions
            // so we return it via custom object
            if (res && res.message) {
                fail(res);
                return;
            }

            success(res);
        } catch(ex) {
            fail(ex);
        }
    },

    connect: function(success, fail, args) {
        try {
            var dbName = args.shift();
            module.exports.db = generateDbPath(dbName);

            var res = SQLite.Proxy.SQLiteProxy.connectToDb(module.exports.db);
            res = JSON.parse(res);

            if (res && res.message) {
                fail(res);
                return;
            }

            success(res);
        } catch (ex) {
            fail(ex);
        }
    },

    disconnect: function(success, fail, connectionId) {
        try {
            var res = SQLite.Proxy.SQLiteProxy.disconnect(connectionId.shift());
            res = JSON.parse(res);

            if (res && res.message) {
                fail(res);
                return;
            }

            success();
        } catch (ex) {
            fail(ex);
        }
    }
};
require("cordova/exec/proxy").add("WebSql", module.exports);
