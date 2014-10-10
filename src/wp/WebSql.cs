/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */

using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Collections.Generic;
using SQLite;
using WPCordovaClassLib.Cordova;
using WPCordovaClassLib.Cordova.Commands;
using WPCordovaClassLib.Cordova.JSON;
using System.Text.RegularExpressions;

namespace Cordova.Extension.Commands
{
    /// <summary>
    /// Apache Cordova plugin for WebSql
    /// </summary>
    public class WebSql : BaseCommand
    {
        public class QueryRow : List<QueryColumn> {}

        public class SqlResultSetRowList : List<QueryRow> {}

        [DataContract]
        public class SqlResultSet
        {
            [DataMember(Name = "insertId")]
            public long InsertId;
            [DataMember(Name = "rowsAffected")]
            public long RowsAffected;
            [DataMember(Name = "rows")]
            public SqlResultSetRowList Rows = new SqlResultSetRowList();
        };
        [DataContract]
        public class QueryColumn
        {
            [DataMember]
            public string Key;
            [DataMember]
            public object Value;

            public QueryColumn(string key, object value)
            {
                Key = key;
                Value = value;
            }
        }
        
        [DataContract]
        private class ConnectionInfo
        {
            [DataMember(Name = "connectionId")]
            public long Id;
        }

        [DataContract]
        private class SQliteError
        {
            [DataMember(Name = "message")] 
            public string Message;
            [DataMember(Name = "code")] 
            public int Code;

            public SQliteError(Exception ex)
            {
                Message = ex.Message;
                if (ex is SQLiteException)
                    Code = (int)((SQLiteException)ex).Result;
            }
        }

        /// <summary>
        /// Represents database path.
        /// </summary>
        private string _dbName = "";

        /// <summary>
        /// Represents database connection instance.
        /// </summary>
        private static Dictionary<long, SQLiteConnection> _dbConnections = new Dictionary<long, SQLiteConnection>();
        private static readonly object _locker = new Object();
        private int _retriesCount = 3;

        /// <summary>
        /// We don't connect to the database here, we just save database name for further access.
        /// </summary>
        /// <param name="options"></param>
        public void open(string options)
        {
            lock (_locker)
            {
                try
                {
                    var args = JsonHelper.Deserialize<List<string>>(options);

                    String dbName = args[0];
                    _dbName = dbName;
                    DispatchCommandResult(new PluginResult(PluginResult.Status.OK));
                }
                catch (Exception ex)
                {
                    DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, new SQliteError(ex)));
                }
            }
        }

        /// <summary>
        /// Remove dbName.
        /// </summary>
        /// <param name="options"></param>
        public void close(string options)
        {
            lock (_locker)
            {
                _dbName = string.Empty;

                DispatchCommandResult(new PluginResult(PluginResult.Status.OK));
            }
        }

        public void connect(string options)
        {
            lock (_locker)
            {
                var args = JsonHelper.Deserialize<List<string>>(options);
                string dbName = args[0];
                var callbackId = args[1];

                for (int i = 0; i < _retriesCount; i++)
                {
                    try
                    {
                        var result = new ConnectionInfo();

                        var newId = _dbConnections.Keys.DefaultIfEmpty(0).Max() + 1;
                        _dbConnections.Add(newId, new SQLiteConnection(dbName));
                        result.Id = newId;
                        DispatchCommandResult(new PluginResult(PluginResult.Status.OK, result), callbackId);

                        return;
                    }
                    catch (Exception ex)
                    {
                        if (i == _retriesCount - 1)
                        {
                            DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, new SQliteError(ex)), callbackId);
                            return;
                        }
                    }
                }
            }
        }

        public void disconnect(string options)
        {
            lock (_locker)
            {
                var args = JsonHelper.Deserialize<List<string>>(options);
                var callbackId = args[1];
                try
                {
                    var connectionId = int.Parse(args[0]);
                    if (_dbConnections.ContainsKey(connectionId))
                    {
                        var connection = _dbConnections[connectionId];
                        connection.Dispose();
                        _dbConnections.Remove(connectionId);
                    }
                    else
                    {
                        throw new ArgumentException("No such connection! (connectionId = " + connectionId + ")");
                    }
                }
                catch (Exception ex)
                {
                    DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, new SQliteError(ex)), callbackId);
                    return;
                }

                DispatchCommandResult(new PluginResult(PluginResult.Status.OK), callbackId);
            }
        }

        /// <summary>
        /// Executes SQL query.
        /// </summary>
        /// <param name="options"></param>
        public void executeSql(string options)
        {
            lock (_locker)
            {
                var args = JsonHelper.Deserialize<List<string>>(options);
                var callbackId = args[3];
                try
                {
                    var connectionId = int.Parse(args[0]);

                    var query = args[1];
                    var queryParams = string.IsNullOrEmpty(args[2])
                        ? new object[0]
                        : JsonHelper.Deserialize<object[]>(args[2]);

                    var resultSet = new SqlResultSet();

                    foreach (var row in _dbConnections[connectionId].Query2(query, queryParams))
                    {
                        var resultRow = new QueryRow();
                        resultRow.AddRange(row.column.Select(column => new QueryColumn(column.Key, column.Value)));
                        resultSet.Rows.Add(resultRow);
                    }

                    resultSet.InsertId = SQLite3.LastInsertRowid(_dbConnections[connectionId].Handle);
                    resultSet.RowsAffected = SQLite3.Changes(_dbConnections[connectionId].Handle);
                    DispatchCommandResult(new PluginResult(PluginResult.Status.OK, resultSet), callbackId);
                }
                catch (Exception ex)
                {
                    DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, new SQliteError(ex)), callbackId);
                }
            }
        }
    }
}