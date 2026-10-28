import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

try:
    with psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=5,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            database_name = cursor.fetchone()[0]

    print(f"Database connection successful: {database_name}")

except Exception as error:
    print(f"Database connection failed: {type(error).__name__}: {error}")