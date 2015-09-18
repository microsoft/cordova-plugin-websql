WebSQL plugin for Apache Cordova
==================================
Adds WebSQL functionality as Apache Cordova Plugin implemented on top of [Csharp-Sqlite library](https://code.google.com/p/csharp-sqlite/). Support of Windows 8.0, Windows 8.1, Windows Phone 8.0 and Windows Phone 8.1.

### Sample usage ###

Plugin follows [WebDatabase](http://www.w3.org/TR/webdatabase/) specification, no special changes are required. The following sample code creates `todo` table (if not exist) and adds new record. Complete example is available [here](https://github.com/MSOpenTech/cordova-plugin-websql/tree/master/test).
```javascript
var dbSize = 5 * 1024 * 1024; // 5MB

var db = openDatabase("Todo", "", "Todo manager", dbSize, function() {
    console.log('db successfully opened or created');
});

db.transaction(function (tx) {
    tx.executeSql("CREATE TABLE IF NOT EXISTS todo(ID INTEGER PRIMARY KEY ASC, todo TEXT, added_on TEXT)",
        [], onSuccess, onError);
    tx.executeSql("INSERT INTO todo(todo, added_on) VALUES (?,?)", ['my todo item', new Date().toUTCString()], onSuccess, onError);
});

function onSuccess(transaction, resultSet) {
    console.log('Query completed: ' + JSON.stringify(resultSet));
}

function onError(transaction, error) {
    console.log('Query failed: ' + error.message);
}
```
### Installation Instructions ###

Plugin is [Apache Cordova CLI](http://cordova.apache.org/docs/en/edge/guide_cli_index.md.html) 3.x compliant.

1. Make sure an up-to-date version of Node.js is installed, then type the following command to install the [Cordova CLI](https://github.com/apache/cordova-cli):

        npm install -g cordova

2. Create a project and add the platforms you want to support:

        cordova create sampleApp
        cd sampleApp
        cordova platform add windows <- support of Windows 8.0, Windows 8.1 and Windows Phone 8.1
        cordova platform add wp8 <- support of Windows Phone 8.0

3. Add WebSql plugin to your project:

        cordova plugin add cordova-plugin-websql

4. Build and run, for example:

        cordova build wp8
        cordova emulate wp8

To learn more, read [Apache Cordova CLI Usage Guide](http://cordova.apache.org/docs/en/edge/guide_cli_index.md.html).

### Pre-populated DBs support ###
You can copy a prepared DB file to the App' LocalFolder on the first run, for example (in terms of the sample app):
```javascript
initialize: function () {
    WinJS.Application.local.exists('Todo').done(
        function (found) {
            if (!found) {
                return copyStartData('Todo');
            }
        }
    );

    function copyStartData(copyfile) {
        return Windows.ApplicationModel.Package.current.installedLocation.getFolderAsync('www')
        .then(function (www) {
            return www.getFolderAsync('data')
            .then(function (data) {
                    return data.getFileAsync(copyfile).then(
                        function (file) {
                            if (file) {
                                return file.copyAsync(WinJS.Application.local.folder);
                            }
                        });
            });
        });
    }

    ...
},
```

The snippet copies `www/data/Todo` pre-populated DB to the App' local folder if it did not exist.

Based on [this StackOverflow question](http://stackoverflow.com/questions/15068295/deployment-of-localstate-folder).

### Quirks ###
* The display name, and size parameter values are not supported and will be ignored.

* Due to SQLite limitations db version parameter to `openDatabase` and `changeVersion` methods should be an integer value or integer's string representation.

* openDatabase on WP8 bypass version check by default. The reason of this is async nature of cordova calls to native APIs. To force version check and enable full versioning functionality set up the following variable:

    ```javascript
    window.__webSqlUseSyncConstructor = true;
    ```

* To use nested transactions you will need to pass parent transaction like this:
    ```javascript
    var db = openDatabase('test1.db', '1.0', 'testLongTransaction', 2 * 1024);
    db.transaction(function (tx1) {
        tx1.executeSql('DROP TABLE IF EXISTS foo');
        tx1.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)');
        ...
        db.transaction(function (tx2) {
            tx2.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');
        }, null, null, null, null, false, tx1);
        ...
    }, null, null);
    ```
    `tx1` passed as the last argument in the nested `db.transaction` refers to the parent transaction.

    Other arguments (`null, null, null, null, false, tx1`) are:
    * the db.transaction error callback,
    * the db.transaction success callback,
    * preflight operation callback,
    * postflight operation callback,
    * readOnly flag,
    * parent transaction - respectively.

* To enable logging use:
    ```javascript
    window.__webSqlDebugModeOn = true;
    ```

### Copyrights ###
Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
