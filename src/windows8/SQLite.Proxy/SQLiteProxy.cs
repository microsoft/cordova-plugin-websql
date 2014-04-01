/*
 * Copyright (c) Microsoft Open Technologies, Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 */
using SQLitePCL;
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;

namespace SQLite.Proxy
{
    public sealed class SQLiteProxy
    {
        public static string executeSql(string dbname, [ReadOnlyArray()] object[] args)
        {
            try
            {
                var query = (string)args[0];
                var queryParams = (object[])args[1];

                using (var connection = new SQLiteConnection(dbname))
                {
                    using (var statement = connection.Prepare(query))
                    {
                        // pass query arguments
                        for (int argIdx = 0; argIdx < queryParams.Length; argIdx++)
                        {
                            // bind index starts from 1
                            statement.Bind(argIdx + 1, queryParams[argIdx]);
                        }

                        var resultSet = new SqlResultSet();

                        while (true)
                        {
                            var queryStatus = statement.Step();

                            if (queryStatus == SQLiteResult.ROW)
                            {
                                resultSet.Rows.Add(ReadResultSetRow(statement));
                                continue;
                            }

                            if (queryStatus == SQLiteResult.OK || queryStatus == SQLiteResult.DONE)
                            {
                                return Serialize(typeof(SqlResultSet), resultSet);
                            }

                            // ERROR
                            throw new Exception("Query failed with status: " + queryStatus);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // You can't access the original message text from JavaScript code.
                // http://msdn.microsoft.com/en-US/library/windows/apps/br230301.aspx#ThrowingExceptions
                // so we return it via custom object
                return Serialize(typeof(InvocationError), new InvocationError(ex));
            }
        }

        private class QueryRow : List<QueryColumn> { }

        private class SqlResultSetRowList : List<QueryRow> { }

        [DataContract]
        private class SqlResultSet
        {
            [DataMember(Name = "insertId")]
            public long InsertId;
            [DataMember(Name = "rowsAffected")]
            public long RowsAffected;
            [DataMember(Name = "rows")]
            public readonly SqlResultSetRowList Rows = new SqlResultSetRowList();
        };

        [DataContract]
        private class QueryColumn
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
        private class InvocationError
        {
            [DataMember(Name = "_invocationError")]
            private string Error;

            public InvocationError(Exception ex)
            {
                Error = ex.Message;
            }
        }

        private static QueryRow ReadResultSetRow(ISQLiteStatement statement)
        {
            var row = new QueryRow();

            int columnIdx = 0;

            while (true)
            {
                var key = statement.ColumnName(columnIdx);

                if (String.IsNullOrWhiteSpace(key))
                {
                    break;
                }

                row.Add(new QueryColumn(key, statement[columnIdx]));

                columnIdx++;
            }

            return row;
        }

        private static string Serialize(Type type, object obj)
        {
            using (var stream = new MemoryStream())
            {
                var jsonSer = new DataContractJsonSerializer(type);
                jsonSer.WriteObject(stream, obj);
                stream.Position = 0;
                return new StreamReader(stream).ReadToEnd();
            }
        }
    }
}
