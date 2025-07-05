from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import pymysql
import config
from werkzeug.security import generate_password_hash, check_password_hash
import json

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
            return redirect(url_for('operadora_dashboard' if user_type=='operadora' else 'dashboard_bombero'))
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
            db = get_db()
            cur = db.cursor()
            cur.execute("INSERT INTO users (username,dni,password_hash,user_type) VALUES (%s,%s,%s,%s)",
                        (user, dni, pwd_hash, user_type))
            db.commit()
            return redirect(url_for('login', user_type=user_type))
        except Exception as e:
            error = "Error en el registro. ¿Usuario ya existe?"
    return render_template('register.html', user_type=user_type, error=error)

@app.route('/dashboard/operadora')
def operadora_dashboard():
    if session.get('user_type') != 'operadora':
        return redirect(url_for('index'))
    return render_template('operadora_dashboard.html')

# --------------- FASE 2: GUARDAR REPORTE -----------------
@app.route('/fase2')
def fase2():
    return render_template('fase2_recursos.html')

@app.route('/guardar_reporte', methods=['POST'])
def guardar_reporte():
    import json
    id_bombero = session.get('user_id')
    if not id_bombero:
        return jsonify({"ok": False, "error": "No autenticado"}), 403

    data = request.json
    tipo_incidente = data.get('tipo_incidente')
    departamento = data.get('departamento')
    provincia = data.get('provincia')
    distrito = data.get('distrito')
    latitud = data.get('latitud')
    longitud = data.get('longitud')
    companias = json.dumps(data.get('companias', []))
    hidrantes = json.dumps(data.get('hidrantes', []))
    fabricas = json.dumps(data.get('fabricas', []))
    estaciones = json.dumps(data.get('estaciones', []))

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO reportes (id_bombero, tipo_incidente, departamento, provincia, distrito, latitud, longitud, companias, hidrantes, fabricas, estaciones, fecha)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            id_bombero, tipo_incidente, departamento, provincia, distrito,
            latitud, longitud, companias, hidrantes, fabricas, estaciones
        ))
        conn.commit()
    return jsonify({"ok": True})

# ----------------------------------------------------------

@app.route('/dashboard/bombero')
def dashboard_bombero():
    # Solo los bomberos pueden acceder
    if session.get('user_type') != 'bombero':
        return redirect(url_for('index'))

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.tipo_incidente, r.departamento, r.provincia, r.distrito,
                   r.latitud, r.longitud, r.companias, r.hidrantes, r.fabricas, r.estaciones, r.fecha,
                   u.username
            FROM reportes r
            JOIN users u ON r.id_bombero = u.id
            ORDER BY r.fecha DESC
        """)
        reportes = []
        for row in cur.fetchall():
            row['companias'] = json.loads(row['companias']) if row['companias'] else []
            row['hidrantes'] = json.loads(row['hidrantes']) if row['hidrantes'] else []
            row['fabricas'] = json.loads(row['fabricas']) if row['fabricas'] else []
            row['estaciones'] = json.loads(row['estaciones']) if row['estaciones'] else []
            reportes.append(row)
    return render_template('dashboard_bombero.html', reportes=reportes)
# -------------------- ENDPOINTS DE DATOS --------------------
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
# -----------------------------------------------------------

if __name__ == '__main__':
    app.run(debug=True)
