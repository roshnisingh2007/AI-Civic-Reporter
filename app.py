import os
import io
import base64
import sqlite3
import random
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Vercel / AWS Lambda serverless read-only filesystem handling
IS_SERVERLESS = bool(os.environ.get('VERCEL')) or bool(os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))
if IS_SERVERLESS or not os.access(BASE_DIR, os.W_OK):
    DB_PATH = '/tmp/civic_reporter.db'
    UPLOAD_FOLDER = '/tmp/uploads'
else:
    DB_PATH = os.path.join(BASE_DIR, 'civic_reporter.db')
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

try:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
except Exception:
    pass

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            location TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'Medium',
            status TEXT NOT NULL DEFAULT 'Pending',
            image_url TEXT,
            geotag_lat REAL,
            geotag_lng REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add geotag columns if table existed without them
    try:
        cursor.execute('ALTER TABLE complaints ADD COLUMN geotag_lat REAL')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE complaints ADD COLUMN geotag_lng REAL')
    except sqlite3.OperationalError:
        pass
    conn.commit()

    # Seed sample complaints if table is empty
    cursor.execute('SELECT COUNT(*) as count FROM complaints')
    count = cursor.fetchone()['count']
    if count == 0:
        samples = [
            (
                'CR1001',
                'Rajesh Sharma',
                'Pothole',
                'Huge dangerous pothole near Sector 14 market roundabout. Vehicles getting damaged and severe accident risk.',
                'Sector 14 Market, Main Road (📍 Geotag: 28.6139, 77.2090)',
                'High',
                'Pending',
                None,
                28.6139,
                77.2090,
                datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ),
            (
                'CR1002',
                'Priya Verma',
                'Garbage',
                'Garbage bin overflowing for past 4 days near community park, causing foul smell and health hazard.',
                'Green Park, Block C Gate 2 (📍 Geotag: 28.5583, 77.2024)',
                'Medium',
                'In Progress',
                None,
                28.5583,
                77.2024,
                (datetime.datetime.now() - datetime.timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
            ),
            (
                'CR1003',
                'Amit Patel',
                'Broken Streetlight',
                'Streetlight pole #42 is not working at night making the lane completely dark and unsafe for pedestrians.',
                'Lane 5, Sunrise Colony (📍 Geotag: 28.6280, 77.2189)',
                'Low',
                'Resolved',
                None,
                28.6280,
                77.2189,
                (datetime.datetime.now() - datetime.timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
            )
        ]
        cursor.executemany('''
            INSERT INTO complaints (id, name, category, description, location, priority, status, image_url, geotag_lat, geotag_lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', samples)
        conn.commit()

    conn.close()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_exif_gps_from_bytes(image_bytes):
    """Extract EXIF GPS coordinates from raw image bytes in-memory."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif()
        if not exif:
            return None, None
        gps_ifd = exif.get_ifd(0x8825)
        if not gps_ifd:
            return None, None

        lat_raw = gps_ifd.get(2)
        lat_ref = gps_ifd.get(1)
        lon_raw = gps_ifd.get(4)
        lon_ref = gps_ifd.get(3)

        if lat_raw and lon_raw:
            def to_decimal(val, ref):
                d = float(val[0])
                m = float(val[1])
                s = float(val[2])
                res = d + (m / 60.0) + (s / 3600.0)
                if ref in ['S', 'W']:
                    res = -res
                return round(res, 6)

            return to_decimal(lat_raw, lat_ref), to_decimal(lon_raw, lon_ref)
    except Exception:
        pass
    return None, None


def analyze_civic_issue(description, category=""):
    text = f"{description} {category}".lower()

    urgent_words = [
        "danger", "emergency", "accident", "overflow", "severe", "broken",
        "leak", "hazard", "fire", "electric", "wire", "shock", "collapse",
        "deep", "sinkhole", "toxic", "injury", "flood", "caved", "urgent"
    ]
    minor_words = [
        "paint", "minor", "dust", "flicker", "cosmetic", "small", "cleaning"
    ]

    priority = "Medium"
    for word in urgent_words:
        if word in text:
            priority = "High"
            break

    if priority != "High":
        for word in minor_words:
            if word in text:
                priority = "Low"
                break

    if len(text.strip()) < 15 and priority != "High":
        priority = "Low"

    return priority


# ---------------- API ROUTES ----------------

@app.route('/api/stats', methods=['GET'])
def get_stats():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as total FROM complaints')
    total = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as pending FROM complaints WHERE status = 'Pending'")
    pending = cursor.fetchone()['pending']

    cursor.execute("SELECT COUNT(*) as in_progress FROM complaints WHERE status = 'In Progress'")
    in_progress = cursor.fetchone()['in_progress']

    cursor.execute("SELECT COUNT(*) as resolved FROM complaints WHERE status = 'Resolved'")
    resolved = cursor.fetchone()['resolved']

    conn.close()
    return jsonify({
        "success": True,
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved
    })


@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    init_db()
    status = request.args.get('status')
    category = request.args.get('category')
    search = request.args.get('search')

    query = 'SELECT * FROM complaints WHERE 1=1'
    params = []

    if status and status != 'All':
        query += ' AND status = ?'
        params.append(status)

    if category and category != 'All':
        query += ' AND category = ?'
        params.append(category)

    if search:
        query += ' AND (id LIKE ? OR name LIKE ? OR location LIKE ? OR description LIKE ?)'
        like_str = f"%{search}%"
        params.extend([like_str, like_str, like_str, like_str])

    query += ' ORDER BY created_at DESC'

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    complaints = [dict(row) for row in rows]
    return jsonify({
        "success": True,
        "count": len(complaints),
        "complaints": complaints
    })


@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def get_single_complaint(complaint_id):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints WHERE UPPER(id) = UPPER(?)', (complaint_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "message": "Complaint not found"}), 404

    return jsonify({"success": True, "complaint": dict(row)})


@app.route('/api/complaints', methods=['POST'])
def submit_complaint():
    init_db()
    name = request.form.get('name', '').strip()
    category = request.form.get('category', '').strip()
    description = request.form.get('description', '').strip()
    location = request.form.get('location', '').strip()
    priority = request.form.get('priority')

    # Basic field validation
    if not name or not category or not description or not location:
        return jsonify({
            "success": False,
            "message": "All required fields (Name, Category, Description, Location) must be filled."
        }), 400

    # 1. Image is strictly compulsory
    if 'image' not in request.files or not request.files['image'].filename:
        return jsonify({
            "success": False,
            "message": "Image upload is compulsory! You must upload a photo of the civic issue."
        }), 400

    file = request.files['image']
    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "message": "Invalid image format. Allowed formats: PNG, JPG, JPEG, WEBP."
        }), 400

    file_bytes = file.read()

    # Convert to Data URL for serverless resilience (works without persistent disk)
    mime_type = file.content_type or 'image/jpeg'
    b64_data = base64.b64encode(file_bytes).decode('utf-8')
    image_url = f"data:{mime_type};base64,{b64_data}"

    # Also save to disk if folder is available
    try:
        rand_prefix = random.randint(100000, 999999)
        safe_name = f"{rand_prefix}_{secure_filename(file.filename)}"
        save_path = os.path.join(UPLOAD_FOLDER, safe_name)
        with open(save_path, 'wb') as f:
            f.write(file_bytes)
    except Exception:
        pass

    # 2. Strict Geotag Validation (In-memory EXIF check or live form coords)
    exif_lat, exif_lng = extract_exif_gps_from_bytes(file_bytes)

    form_lat = request.form.get('geotag_lat')
    form_lng = request.form.get('geotag_lng')

    final_lat = exif_lat
    final_lng = exif_lng

    if final_lat is None and form_lat and form_lng:
        try:
            plat = float(form_lat)
            plng = float(form_lng)
            if -90 <= plat <= 90 and -180 <= plng <= 180:
                final_lat = round(plat, 6)
                final_lng = round(plng, 6)
        except ValueError:
            pass

    # If image does not have verified geotag, reject
    if final_lat is None or final_lng is None:
        return jsonify({
            "success": False,
            "message": "Rejection: Uploaded image is NOT geotagged! Civic reports strictly require a geotagged photo with verified GPS coordinates. Non-geotagged photos cannot be submitted."
        }), 400

    # Auto-classify priority if not provided
    if not priority:
        priority = analyze_civic_issue(description, category)

    # Ensure GPS coordinate is recorded in location string if not already
    coord_str = f"{final_lat}, {final_lng}"
    if coord_str not in location:
        location = f"{location} (📍 {coord_str})"

    # Generate unique Complaint ID
    conn = get_db()
    cursor = conn.cursor()

    while True:
        complaint_id = f"CR{random.randint(1000, 9999)}"
        cursor.execute('SELECT 1 FROM complaints WHERE id = ?', (complaint_id,))
        if not cursor.fetchone():
            break

    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute('''
        INSERT INTO complaints (id, name, category, description, location, priority, status, image_url, geotag_lat, geotag_lng, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
    ''', (complaint_id, name, category, description, location, priority, image_url, final_lat, final_lng, now_str, now_str))
    conn.commit()

    cursor.execute('SELECT * FROM complaints WHERE id = ?', (complaint_id,))
    new_record = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        "success": True,
        "message": "Complaint submitted successfully with verified geotagged photo",
        "complaint_id": complaint_id,
        "geotag": {"latitude": final_lat, "longitude": final_lng},
        "complaint": new_record
    }), 201


@app.route('/api/complaints/<complaint_id>/status', methods=['PATCH', 'PUT', 'POST'])
def update_status(complaint_id):
    init_db()
    data = request.get_json(silent=True) or request.form
    new_status = data.get('status', '').strip()

    valid_statuses = {'Pending', 'In Progress', 'Resolved'}
    if new_status not in valid_statuses:
        return jsonify({"success": False, "message": f"Invalid status. Must be one of {valid_statuses}"}), 400

    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE complaints
        SET status = ?, updated_at = ?
        WHERE UPPER(id) = UPPER(?)
    ''', (new_status, now_str, complaint_id))
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"success": False, "message": "Complaint not found"}), 404

    cursor.execute('SELECT * FROM complaints WHERE UPPER(id) = UPPER(?)', (complaint_id,))
    updated_record = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Status updated to {new_status}",
        "complaint": updated_record
    })


@app.route('/api/complaints/<complaint_id>', methods=['DELETE'])
def delete_complaint(complaint_id):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT image_url FROM complaints WHERE UPPER(id) = UPPER(?)', (complaint_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Complaint not found"}), 404

    cursor.execute('DELETE FROM complaints WHERE UPPER(id) = UPPER(?)', (complaint_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Complaint {complaint_id} deleted successfully"})


@app.route('/api/ai/analyze', methods=['POST'])
def ai_analyze():
    data = request.get_json() or {}
    description = data.get('description', '')
    category = data.get('category', '')
    priority = analyze_civic_issue(description, category)
    return jsonify({
        "success": True,
        "suggested_priority": priority,
        "category": category
    })


# ---------------- STATIC FILE SERVING ----------------

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    if os.path.exists(os.path.join(UPLOAD_FOLDER, filename)):
        return send_from_directory(UPLOAD_FOLDER, filename)
    return jsonify({"error": "File not found"}), 404


@app.route('/<path:filename>')
def serve_static(filename):
    if os.path.exists(os.path.join(BASE_DIR, filename)):
        return send_from_directory(BASE_DIR, filename)
    return jsonify({"error": "File not found"}), 404


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] AI Civic Reporter Python Backend running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
