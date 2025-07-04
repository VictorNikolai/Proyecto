from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import pymysql
import config
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = config.SECRET_KEY

def get_db():
    return pymysql.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        port=getattr(config, 'DB_PORT', 3306),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=5
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth/<user_type>')
def auth_options(user_type):
    return render_template('auth_options.html', user_type=user_type)

@app.route('/login/<user_type>', methods=['GET', 'POST'])
def login(user_type):
    error = None
    if request.method == 'POST':
        user = request.form['username']
        dni = request.form['dni']
        pwd = request.form['password']
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT * FROM users WHERE username=%s AND user_type=%s", (user, user_type))
        row = cur.fetchone()
        if row and row['dni'] == dni and check_password_hash(row['password_hash'], pwd):
            session['user_type'] = user_type
            session['user_id'] = row['id']
            return redirect(url_for('operadora_dashboard' if user_type=='operadora' else 'bombero_dashboard'))
        error = "Credenciales inválidas"
    return render_template('login.html', user_type=user_type, error=error)

@app.route('/register/<user_type>', methods=['GET','POST'])
def register(user_type):
    error = None
    if request.method == 'POST':
        user = request.form['username']
        dni = request.form['dni']
        pwd = request.form['password']
        pwd_hash = generate_password_hash(pwd)
        try:
            print('Conectando a BD...') # Debug
            db = get_db()
            cur = db.cursor()
            print('Ejecutando INSERT...') # Debug
            cur.execute("INSERT INTO users (username,dni,password_hash,user_type) VALUES (%s,%s,%s,%s)",
                        (user, dni, pwd_hash, user_type))
            db.commit()
            print('Registro exitoso.') # Debug
            return redirect(url_for('login', user_type=user_type))
        except Exception as e:
            print("Error en el registro:", e)
            error = "Error en el registro. ¿Usuario ya existe?"
    return render_template('register.html', user_type=user_type, error=error)

@app.route('/dashboard/operadora')
def operadora_dashboard():
    if session.get('user_type') != 'operadora':
        return redirect(url_for('index'))
    return render_template('operadora_dashboard.html')

@app.route('/dashboard/bombero')
def bombero_dashboard():
    if session.get('user_type') != 'bombero':
        return redirect(url_for('index'))
    return "<h2>Dashboard Bombero (pendiente)</h2>"

# --------------------
# NUEVOS ENDPOINTS API
# --------------------

@app.route('/api/companias')
def api_companias():
    db = get_db()
    cur = db.cursor()
    cur.execute("""
        SELECT id, nombre, lat, lng, 
               bomberos_disponibles, vehiculos_disponibles, 
               nombre_responsable, cargo_responsable
        FROM CompaniaBomberos
    """)
    data = []
    for row in cur:
        data.append({
            "id": row['id'],
            "nombre": row['nombre'],
            "lat": float(row['lat']),
            "lng": float(row['lng']),
            "bomberos_disponibles": row.get('bomberos_disponibles', 0),
            "vehiculos_disponibles": row.get('vehiculos_disponibles', 0),
            "nombre_responsable": row.get('nombre_responsable', ''),
            "cargo_responsable": row.get('cargo_responsable', '')
        })
    return jsonify(data)

@app.route('/api/fabricas')
def api_fabricas():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT idFabrica, nombre, actividad, lat, lng FROM Fabrica")
    data = []
    for row in cur:
        data.append({
            "idFabrica": row['idFabrica'],
            "nombre": row['nombre'],
            "actividad": row['actividad'],
            "lat": float(row['lat']),
            "lng": float(row['lng'])
        })
    return jsonify(data)

@app.route('/api/estaciones')
def get_estaciones():
    try:
        with open('static/json/servicio.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/hidrantes')
def api_hidrantes():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT ID, NIS, nombre, estado, lat, lng FROM Hidrante")
    data = []
    for row in cur:
        data.append({
            "ID": row['ID'],
            "NIS": row['NIS'],
            "nombre": row['nombre'],
            "estado": row['estado'],
            "lat": float(row['lat']),
            "lng": float(row['lng'])
        })
    return jsonify(data)

# -------------------
# FIN NUEVOS ENDPOINTS
# -------------------

# ----------- AQUI AGREGA LA RUTA DE FASE 2 -------------
@app.route('/fase2')
def fase2():
    return render_template('fase2_recursos.html')
# --------------------------------------------------------

if __name__ == '__main__':
    app.run(debug=True)
