using System;
using System.Collections.Generic;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using Community.CsharpSqlite.SQLiteClient;

namespace SQLite.Proxy
{
    public sealed class SQLiteProxy
    {
        private static Dictionary<long, SqliteConnection> _dbConnections = new Dictionary<long, SqliteConnection>();
        private static int _retriesCount = 3;

        public static string ConnectToDb(string dbname)
        {
            var result = new ConnectionInfo();

            for (int i = 0; i < _retriesCount; i++)
            {
                try
                {
                    var connectionString = string.Format("Version=3,uri=file:{0}", dbname);
                    var connection = new SqliteConnection(connectionString);
                    connection.Open();

                    var newId = _dbConnections.Keys.DefaultIfEmpty(0).Max() + 1;
                    _dbConnections.Add(newId, connection);
                    result.Id = newId;

                    break;
                }
                catch (Exception ex)
                {
                    if (i == _retriesCount - 1)
                        return Serialize(typeof(InvocationError), new InvocationError(ex));
                }
            }

            return Serialize(typeof(ConnectionInfo), result);
        }

        public static string Disconnect(long connectionId)
        {
            try
            {
                var connection = _dbConnections[connectionId];
                connection.Close();
                _dbConnections.Remove(connectionId);
            }
            catch (Exception ex)
            {
                return Serialize(typeof(InvocationError), new InvocationError(ex));
            }
            return "{}";
        }

        public static string executeSql(long connectionId, [ReadOnlyArray()] object[] args)
        {
            try
            {
                var query = (string)args[0];
                var queryParams = (object[])args[1];

                var cmd = _dbConnections[connectionId].CreateCommand();
                cmd.CommandText = query;
                foreach (var queryParam in queryParams)
                {
                    var parameter = cmd.CreateParameter();
                    parameter.Value = queryParam;
                    cmd.Parameters.Add(parameter);
                }
               
                var reader = cmd.ExecuteReader();

                var resultSet = new SqlResultSet();
                while (reader.Read())
                {
                    resultSet.Rows.Add(ReadResultSetRow(reader));
                }

                resultSet.RowsAffected = reader.RecordsAffected;
                resultSet.InsertId = _dbConnections[connectionId].LastInsertRowId;
                return Serialize(typeof(SqlResultSet), resultSet);
            }
            catch (Exception ex)
            {
                // You can't access the original message text from JavaScript code.
                // http://msdn.microsoft.com/en-US/library/windows/apps/br230301.aspx#ThrowingExceptions
                // so we return it via custom object
                return Serialize(typeof(InvocationError), new InvocationError(ex));
            }
        }

        private static QueryRow ReadResultSetRow(DbDataReader reader)
        {
            var row = new QueryRow();

            for (int i = 0; i < reader.FieldCount; i++)
            {
                row.Add(new QueryColumn(reader.GetName(i), reader.GetValue(i)));
            }

            return row;
        }

        private class QueryRow : List<QueryColumn> { }

        private class SqlResultSetRowList : List<QueryRow> { }

        [DataContract]
        private class ConnectionInfo
        {
            [DataMember(Name = "connectionId")]
            public long Id;
        }

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
            [DataMember(Name = "message")]
            private string Message;

            [DataMember(Name = "code")]
            private int Code;

            public InvocationError(Exception ex)
            {
                Message = ex.Message;

                if (ex is SqliteException)
                    Code = ((SqliteException)ex).SqliteErrorCode;
            }
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
