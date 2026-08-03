# Create a thread-safe SQLite connection with sqlite_vec extension
def create_thread_safe_connection(db_file: str):
    import sqlite3
    import sqlite_vec
    
    connection = sqlite3.connect(db_file, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.enable_load_extension(True)
    sqlite_vec.load(connection)
    connection.enable_load_extension(False)
    return connection

