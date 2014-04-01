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
        window.onError = this.onError;
    },

    onError: function (msg) {
        console.log('Error: ' + msg);
        document.getElementById("lblInfo").innerHTML = 'ERROR: ' + msg;
    },

    onSuccess: function (msg) {
        console.log('Operation completed successfully');
        app.getAllTodoItems();
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
            tx.executeSql("CREATE TABLE IF NOT EXISTS todo(ID INTEGER PRIMARY KEY ASC, todo TEXT, added_on DATETIME)", [],
                app.onSuccess, app.onError);
        });
    },

    addTodo: function (text) {
        app.db.transaction(function (tx) {
            var ts = new Date();
            tx.executeSql("INSERT INTO todo(todo, added_on) VALUES (?,?)", [text, ts], app.onSuccess, app.onError);
        });
    },

    getAllTodoItems: function () {
        app.db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM todo", [], app.loadTodoItems, app.onError);
        });
    },

    deleteTodo: function (id) {
        console.log('Delete item: ' + id);
        app.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM todo WHERE ID=?", [id], app.onSuccess, app.onError);
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
