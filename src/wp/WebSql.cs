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

        /// <summary>
        /// Represents database path.
        /// </summary>
        private string _dbName = "";

        /// <summary>
        /// Represents database connection instance.
        /// </summary>
        private SQLiteConnection _db;

        /// <summary>
        /// Opens existing database or creates a new one with the file name specified.
        /// We don't test connection to the database here, we just save database name for further access.
        /// </summary>
        /// <param name="options"></param>
        public void open(string options)
        {
            try
            {
                var args = JsonHelper.Deserialize<List<string>>(options);

                String dbName = args[0];

                if (string.IsNullOrEmpty(dbName))
                {
                    DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, "No database name provided"));
                    return;
                }

                _dbName = dbName;

            }
            catch (Exception ex)
            {
                DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, ex.Message));
            }
        }

        /// <summary>
        /// Closes connection to database.
        /// </summary>
        /// <param name="options"></param>
        public void close(string options)
        {
            if (_db != null)
            {
                _db.Dispose();
                _db = null;
            }

            DispatchCommandResult(new PluginResult(PluginResult.Status.OK));
        }

        /// <summary>
        /// Executes SQL query.
        /// </summary>
        /// <param name="options"></param>
        public void executeSql(string options)
        {
            var args = JsonHelper.Deserialize<List<string>>(options);
            try
            {
                if (_db == null)
                    _db = new SQLiteConnection(_dbName);

                var query = args[0];
                var queryParams = string.IsNullOrEmpty(args[1])
                                       ? new object[0]
                                       : JsonHelper.Deserialize<object[]>(args[1]);

                _db.RunInTransaction(() =>
                {    
                    if (query.IndexOf("DROP TABLE", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        //-- bug where drop tabe does not work
                        query = Regex.Replace(query, "DROP TABLE IF EXISTS", "DELETE FROM", RegexOptions.IgnoreCase);
                        query = Regex.Replace(query, "DROP TABLE", "DELETE FROM", RegexOptions.IgnoreCase);
                    }

                    var resultSet = new SqlResultSet();

                    foreach (var row in _db.Query2(query, queryParams))
                    {
                        var resultRow = new QueryRow();
                        resultRow.AddRange(row.column.Select(column => new QueryColumn(column.Key, column.Value)));
                        resultSet.Rows.Add(resultRow);
                    }

                    DispatchCommandResult(new PluginResult(PluginResult.Status.OK, resultSet));
                });
            }
            catch (Exception ex)
            {
                DispatchCommandResult(new PluginResult(PluginResult.Status.ERROR, ex.Message));
            }
            
        }
    }
}