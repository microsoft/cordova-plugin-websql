/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
var app = {
    // based on http://www.html5rocks.com/en/tutorials/webdatabase/todo/ sample by Paul Kinlan
    // Application Constructor
    initialize: function () {
        this.db = null;
        this.bindEvents();
    },

    onError: function (transaction, error) {
        console.log('Error: ' + error.message);
        document.getElementById("lblInfo").innerHTML = 'ERROR: ' + error.message;
    },

    onSuccess: function (transaction, resultSet) {
        var insertId = null;
        console.log('Operation completed successfully');
        try {
            insertId = resultSet.insertId;
        } catch (ex) {
            // If the statement did not insert a row, then the attribute must instead raise an INVALID_ACCESS_ERR exception.
            // http://www.w3.org/TR/webdatabase/#database-query-results
            console.log('insertId: null');
        }
        document.getElementById("lblTxInfo").innerHTML = 'RowsAffected: ' + resultSet.rowsAffected + '; InsertId: ' + insertId;
        app.getAllTodoItems(transaction);
    },

    openDatabase: function () {
        var dbSize = 5 * 1024 * 1024; // 5MB
        // open database
        app.db = openDatabase("Todo", "", "Todo manager", dbSize, function() {
            console.log('db successfully opened or created');
        });
    },

    createTable: function () {
        app.db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS todo(ID INTEGER PRIMARY KEY ASC, todo TEXT, added_on TEXT)", [],
                app.onSuccess, app.onError);
        });
    },

    addTodo: function (text) {
        app.db.transaction(function (tx) {
            var ts = new Date().toUTCString();
            tx.executeSql("INSERT INTO todo(todo, added_on) VALUES (?,?)", [text, ts], app.onSuccess, app.onError);
        });
    },

    getAllTodoItems: function (tx) {
        tx.executeSql("SELECT * FROM todo", [], app.loadTodoItems, app.onError);
    },

    deleteTodo: function (id) {
        console.log('Delete item: ' + id);
        app.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM todo WHERE ID=?", [id], app.onSuccess, app.onError);
        });
    },

    deleteAll: function () {
        console.log('Deleting all');
        app.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM todo", [], app.onSuccess, app.onError);
        });
    },

    loadTodoItems: function (tx, rs) {
        var rowOutput = "",
            todoItems = document.getElementById("lblInfo"),
            row;

        for (var i = 0; i < rs.rows.length; i++) {
            row = rs.rows.item(i);
            rowOutput += "<li>" + row.todo + " [<a href='javascript:void(0);' onclick=\'app.deleteTodo(" + 
                row.ID + ");\'>Delete</a>]</li>";
        }
        if (typeof window.MSApp != 'undefined') {
            MSApp.execUnsafeLocalFunction(function () {
                todoItems.innerHTML = rowOutput;
            });
        } else {
            todoItems.innerHTML = rowOutput;
        }
    },

    dbError: function (error) {
        console.log('DB Error: ' + JSON.stringify(error));
        document.getElementById("lblDBError").innerHTML = 'DB ERROR: ' + JSON.stringify(error);
    },

    dbSuccess: function () {
        console.log('DB Operation completed successfully');
        document.getElementById("lblDBInfo").innerHTML += 'DB Operation completed successfully<br\>';
    },

    testEvents: function() {
        var db = openDatabase('testEvents.db', '1.0', 'testEvents', 2 * 1024);
        db.transaction (
            function (tx) {
                console.log('transaction 1');
                tx.executeSql('DROP TABLE IF EXISTS foo');
                tx.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)');
                tx.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');
                document.querySelector('#status').innerHTML = '<p>foo created and row inserted.</p>';
            },
            app.dbError,
            function () {
                db.transaction(function (tx) {
                    console.log('transaction 2');
                    tx.executeSql('DROP TABLE foo');

                    // known to fail - so should rollback the DROP statement
                    tx.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');
                }, 
                function (err) {
                    console.log('transaction 2 err: ' + JSON.stringify(err));
                    document.querySelector('#status').innerHTML += '<p>should be rolling back caused by: <code>' + err + '</code></p>';

                    db.transaction(function (tx) {
                        console.log('transaction 3');
                        tx.executeSql('SELECT * FROM foo', [], function (tx, results) {
                            document.querySelector('#status').innerHTML += '<p>found rows (should be 1): ' + results.rows.length + '</p>';
                        }, function (tx, err) {
                            document.querySelector('#status').innerHTML += '<p>failed (rollback failed): <em>' + err.message + '</em></p>';
                            document.querySelector('#status').className = 'error';
                        });
                    });
                },
                function () {
                    console.log('transaction 2 unexpected success!');
                });
            });        
    },

    testJSONBlob: function () {
        var arr = [{name: 'Ivan', title: 'Mr.', age: 25}, 'some string', 42, [1, 2, 3], ['a', 'b', 1, 10], [[1, 2, 3], ['a', 'b', 'c']]];
        var db = openDatabase('testJSONBlob.db', '1.0', 'testJSONBlob', 2 * 1024);
        db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS blob');
            tx.executeSql('CREATE TABLE IF NOT EXISTS blob (id unique, text)');
            tx.executeSql('INSERT INTO blob (id, text) VALUES (?, ?)', [1, JSON.stringify(arr)]);
            document.querySelector('#status').innerHTML = '<p>foo created and row inserted.</p>';

            tx.executeSql('SELECT * FROM blob', [], function (tx, results) {
                document.querySelector('#status').innerHTML += '<p>found rows (should be 1): ' + results.rows.length + '</p>';
                document.querySelector('#status').innerHTML += '<p>found row value: ' + results.rows[0].text + '</p>';
                var parsedArr = JSON.parse(results.rows[0].text);
                document.querySelector('#status').innerHTML += '<p>parsed array: ' + parsedArr + '</p>';
                document.querySelector('#status').innerHTML += '<p>parsed array (stringified): ' + JSON.stringify(parsedArr) + '</p>';
            }, function (tx, err) {
                document.querySelector('#status').innerHTML += '<p>blob select failed: <em>' + err.message + '</em></p>';
                document.querySelector('#status').className = 'error';
            });
        }, app.dbError, app.dbSuccess);
    },

    testRollbacksAfterFailures: function() {
       function log(message) {
                document.getElementById("console").innerHTML += message + "<br>";
            }
            // signal to testRunner when this reaches zero.
        var testCount = 4;
         // we first retrieve and store the number of rows already in our test database.
         // our goal is to keep the number unchanged through the tests.
        var initialRowCount = 0;
        var database;
        var successCallbackCalled;

        function finishTest() {
            if (--testCount)
                return;
            log("All Tests are complete.");
            if (window.testRunner)
                testRunner.notifyDone();
        }

        function successCallback() {
            successCallbackCalled = true;
        }

        function verifySuccess(msg) {
            database.transaction(function(tx) {
                tx.executeSql("SELECT count(*) AS count FROM ErrorCallbackTest", [], function(tx, rs) {
                    log(msg + " : " + (rs.rows.item(0).count == initialRowCount && !successCallbackCalled ? "SUCCESS" : "FAILURE"));
                    finishTest();
                });
            });
        }

        function failMidWay(errorCallback) {
            successCallbackCalled = false;
            database.transaction(function(tx) {
                tx.executeSql("INSERT INTO ErrorCallbackTest(someValue) VALUES(?);", [1]);
                tx.executeSql("MUTTER SOMETHING ILLEGIBLE");
            }, errorCallback, successCallback);
        }

        function statementCallbackThrowsException(errorCallback) {
            successCallbackCalled = false;
            database.transaction(function(tx) {
                tx.executeSql("INSERT INTO ErrorCallbackTest(someValue) VALUES(?);", [1], function() {
                    throw {};
                });
            });
        }

        function runTest() {
            database = openDatabase("testRollbacksAfterFailures.db", "1.0", "testRollbacksAfterFailures", 1);

            database.transaction(function(tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS ErrorCallbackTest (someValue)", []);
                tx.executeSql("SELECT count(*) AS count FROM ErrorCallbackTest", [], function(tx, rs) {
                    initialRowCount = rs.rows.item(0).count;
                });
            });

            failMidWay(function() {
                return true;
            });
            verifySuccess("Testing transaction failing mid-way and error callback returning true");

            failMidWay(function() {
                return false;
            });
            verifySuccess("Testing transaction failing mid-way and error callback return false");

            statementCallbackThrowsException(function() {
                return true;
            });
            verifySuccess("Testing statement callback throwing exception and error callback returning true");

            statementCallbackThrowsException(function() {
                return false;
            });
            verifySuccess("Testing statement callback throwing exception and error callback returning false");
        } 

        runTest();
    },
            
    testLongTransactions: function () {
        //sleep function for simulate long transaction
        function sleep(milliseconds) {
            var start = new Date().getTime();
            for (var i = 0; i < 1e7; i++) {
                if ((new Date().getTime() - start) > milliseconds) {
                    break;
                }
            }
        }

        var db = openDatabase('testLongTransaction.db', '1.0', 'testLongTransaction', 2 * 1024);
        document.querySelector('#status').innerHTML += '<p>start1</p>';
        db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS foo');
            tx.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)');
            tx.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');
        }, function() {
            document.querySelector('#status').innerHTML += '<p>Table created</p>';
        });

        document.querySelector('#status').innerHTML += '<p>start2.</p>';
        db.readTransaction(function (tx) {
            sleep(2000);
            tx.executeSql('SELECT * FROM foo', [], function(tx, results) {
                document.querySelector('#status').innerHTML += '<p>found rows (should be 1): ' + results.rows.length + ' (first)</p>';
            });
        });

        document.querySelector('#status').innerHTML += '<p>start3.</p>';
        db.readTransaction(function (tx) {
            sleep(1000);
            tx.executeSql('SELECT * FROM foo', [], function (tx, results) {
                document.querySelector('#status').innerHTML += '<p>found rows (should be 1): ' + results.rows.length + ' (second)</p>';
            });
        });

        db.transaction(function (tx) {
            sleep(500);
            tx.executeSql('INSERT INTO foo (id, text) VALUES(2, "foobar")');
        });

        db.readTransaction(function (tx) {
            tx.executeSql('SELECT * FROM foo', [], function (tx, results) {
                document.querySelector('#status').innerHTML += '<p>found rows (should be 2): ' + results.rows.length + ' (first)</p>';
            });
        });
    },

    testPrelightPostflight: function() {
        var db = openDatabase('testPrelightPostflight.db', '1.0', 'testPrelightPostflight', 2 * 1024);
        db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS foo');
            tx.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)');
            tx.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');

            document.querySelector('#status').innerHTML += '<p>operations done</p>';
        }, null, function () {
            document.querySelector('#status').innerHTML += '<p>onSuccess run</p>';
        }, function() {
            document.querySelector('#status').innerHTML += '<p>Preflight run</p>';
        }, function() {
            document.querySelector('#status').innerHTML += '<p>Postflight run</p>';
        });
    },

    testNestedTransaction: function() {
        var db = openDatabase('testNestedTransaction.db', '1.0', 'testNestedTransaction', 2 * 1024);
        db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS foo', [], function() {
                document.querySelector('#status').innerHTML += '<p>table dropped</p>';
            }, function() {
                document.querySelector('#status').innerHTML += '<p>error drop</p>';
            });
            tx.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)', [], function() {
                document.querySelector('#status').innerHTML += '<p>table created</p>';
            });
            tx.executeSql('SELECT * FROM foo', [], function(tx, res) {
                document.querySelector('#status').innerHTML += '<p>' + JSON.stringify(res.rows) + '</p>';
            });
            db.transaction(function(tx1) {
                tx1.executeSql('INSERT INTO foo (id, text) VALUES (1, "foobar")');
            }, function() {
                document.querySelector('#status').innerHTML += '<p>error nested</p>';
            }, function() {
                document.querySelector('#status').innerHTML += '<p>row inserted</p>';
            }, null, null, false, tx);
            tx.executeSql('SELECT * FROM foo', [], function(tx, res) {
                document.querySelector('#status').innerHTML += '<p>' + JSON.stringify(res.rows) + '</p>';
                document.querySelector('#status').innerHTML += '<p>Expected 1 row</p>';
            });
        });
    },

    openDatabaseMultipleTimes: function () {
        var dbSize = 5 * 1024 * 1024; // 5MB
        // open database        
        app.tempDb1 = openDatabase("TodoMultiple", "", "Todo manager", dbSize, function() {
            console.log('db successfully opened or created #1');
            app.tempDb1.transaction(function (tx) {
                tx.executeSql("DROP TABLE IF EXISTS todo", [], null, app.onError);
                tx.executeSql("CREATE TABLE IF NOT EXISTS todo(ID INTEGER PRIMARY KEY ASC, todo TEXT, added_on TEXT)", [],
                    null, app.onError);
                var text = "test1";
                var ts = new Date().toUTCString();
                tx.executeSql("INSERT INTO todo(todo, added_on) VALUES (?,?)", [text, ts], null, app.onError);
            }, app.dbError, function() {
                app.tempDb2 = openDatabase("TodoMultiple", "", "Todo manager", dbSize, function () {
                    console.log('db successfully opened or created #2');
                    app.tempDb2.transaction(function (tx) {
                        var text = "test2";
                        var ts = new Date().toUTCString();
                        tx.executeSql("INSERT INTO todo(todo, added_on) VALUES (?,?)", [text, ts], null, app.onError);

                        console.log('there should be 2 rows now:');
                        tx.executeSql("SELECT * FROM todo", [], function (tx, res) {
                            console.log(res.rows.length);
                            document.querySelector('#status').innerHTML += '<p>found rows (should be 2): ' + res.rows.length + '</p>';
                        }, app.onError);
                    });
                });
            });
        });
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        document.getElementById('btnOpenDb').addEventListener('click', this.openDatabase);
        document.getElementById('btnCreateTable').addEventListener('click', this.createTable);
        document.getElementById('btnAddItem').addEventListener('click', function () {
            var text = document.getElementById('lblTodoText').value;
            app.addTodo(text);
        });
        document.getElementById('btnDeleteAll').addEventListener('click', this.deleteAll);
        document.getElementById('btnTestEvents').addEventListener('click', this.testEvents);
        document.getElementById('btnTestJSONBlob').addEventListener('click', this.testJSONBlob);
        document.getElementById('btnTestRollbacksAfterFailures').addEventListener('click', this.testRollbacksAfterFailures);
        document.getElementById('bthTestLongTransactions').addEventListener('click', this.testLongTransactions);
        document.getElementById('btnTestPrelightPostflight').addEventListener('click', this.testPrelightPostflight);
        document.getElementById('btnTestNestedTransaction').addEventListener('click', this.testNestedTransaction);
        document.getElementById('btnOpenDbMul').addEventListener('click', this.openDatabaseMultipleTimes);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function () {
        app.receivedEvent('deviceready');
    },
    // Update DOM on a Received Event
    receivedEvent: function (id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};
