import pymysql
import config

print("Intentando conectar...")
try:
    db = pymysql.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        port=getattr(config, 'DB_PORT', 3306),
        connect_timeout=5
    )
    print("¡Conexión exitosa!")
    db.close()
except Exception as e:
    print("Error de conexión:", e)
