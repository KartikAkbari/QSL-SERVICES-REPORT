import os
import random
import datetime
from datetime import timedelta

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import jwt

# -------------------- APP & CONFIG --------------------
app = Flask(__name__)

# CORS (relaxed for local dev; tighten for prod)
CORS(app, resources={r"/*": {"origins": ["https://qsl-services-report.vercel.app","http://localhost:3000", "http://127.0.0.1:3000"]}}, supports_credentials=True)

# SQLite
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///portal.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Uploads
app.config["UPLOAD_FOLDER"] = "uploads"
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xlsx", "xls", "csv", "png", "jpg", "jpeg"}
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Admins & Secrets via env
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "admin@example.com").split(",")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# Mail (set env vars for production)
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", "587"))
app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"])

# JWT secret
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

db = SQLAlchemy(app)
mail = Mail(app)

# -------------------- MODELS --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # "admin" | "client"

class AllowedClient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    status = db.Column(db.String(10), default="active")  # "active" | "inactive"
    added_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("allowed_client.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    client = db.relationship(
        "AllowedClient",
        backref=db.backref("projects", lazy=True, cascade="all, delete")
    )

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)        # original filename
    filename = db.Column(db.String(300), nullable=False)    # stored unique filename
    version = db.Column(db.Integer, nullable=False, default=1)
    uploaded_by = db.Column(db.String(120), nullable=False) # admin or client email
    uploaded_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    project = db.relationship(
        "Project",
        backref=db.backref("reports", lazy=True, cascade="all, delete")
    )

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("report.id"), nullable=False)
    user_email = db.Column(db.String(120), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# -------------------- HELPERS --------------------
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def json_dt(dt: datetime.datetime):
    return dt.isoformat() if isinstance(dt, datetime.datetime) else dt

def send_otp_email(recipient: str, otp_code: str) -> bool:
    # In dev, if mail creds aren't configured, just print OTP
    if not app.config["MAIL_USERNAME"] or not app.config["MAIL_PASSWORD"] or not app.config["MAIL_DEFAULT_SENDER"]:
        print(f"[DEV] OTP for {recipient}: {otp_code}")
        return True
    try:
        msg = Message("Your OTP for Report Portal", recipients=[recipient])
        msg.body = f"Your OTP is {otp_code}. It will expire in 5 minutes."
        mail.send(msg)
        return True
    except Exception as e:
        print("Error sending email:", e)
        return False

def serialize_client(client: AllowedClient):
    return {
        "id": client.id,
        "email": client.email,
        "status": client.status,
        "added_at": json_dt(client.added_at),
    }

def serialize_report(r: Report):
    return {
        "id": r.id,
        "name": r.name,
        "version": r.version,
        "uploaded_by": r.uploaded_by,
        "uploaded_at": json_dt(r.uploaded_at),
        "project_id": r.project_id,
        "download_url": f"/download/{r.id}",
    }

def serialize_project(p: Project):
    # Sort reports newest version first
    reports_sorted = sorted(p.reports, key=lambda rr: (rr.version, rr.uploaded_at), reverse=True)
    return {
        "id": p.id,
        "title": p.title,
        "client_id": p.client_id,
        "client_email": p.client.email if p.client else None,
        "created_at": json_dt(p.created_at),
        "reports": [serialize_report(r) for r in reports_sorted],
    }

# -------------------- AUTH HELPERS (JWT) --------------------
def create_token(email: str, role: str, days_valid: int = 7) -> str:
    payload = {
        "email": email,
        "role": role,
        "exp": datetime.datetime.utcnow() + timedelta(days=days_valid),
        "iat": datetime.datetime.utcnow(),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    # jwt.encode returns str in PyJWT>=2, bytes in older; ensure str
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token

def decode_token(token: str):
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload
    except Exception as e:
        return None

@app.route("/me", methods=["GET"])
def me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Authorization header missing"}), 401
    token = auth.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401
    return jsonify({"email": payload.get("email"), "role": payload.get("role")}), 200

# -------------------- AUTH --------------------
@app.route("/generate-otp", methods=["POST"])
def generate_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email required"}), 400

    # Admins use password flow
    if email in [adm.strip().lower() for adm in ADMIN_EMAILS]:
        return jsonify({"error": "Admins must login with password"}), 403

    # Only active allowed clients can request OTP
    if not AllowedClient.query.filter_by(email=email, status="active").first():
        return jsonify({"error": "Email not registered"}), 403

    # Basic rate limit: 1/min
    # (simple implementation using OTP table if exists)
    last_otp = None
    if 'OTP' in globals():
        last_otp = OTP.query.filter_by(email=email).order_by(OTP.created_at.desc()).first()
    if last_otp and (datetime.datetime.utcnow() - last_otp.created_at) < timedelta(seconds=60):
        remaining = 60 - int((datetime.datetime.utcnow() - last_otp.created_at).total_seconds())
        return jsonify({"error": f"Please wait {remaining}s before requesting a new OTP"}), 429

    otp_code = f"{random.randint(100000, 999999)}"
    otp_entry = OTP(email=email, otp=otp_code)
    db.session.add(otp_entry)
    db.session.commit()

    if not send_otp_email(email, otp_code):
        return jsonify({"error": "Failed to send OTP"}), 500

    return jsonify({"message": f"OTP sent to {email}"}), 200

class OTP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    otp = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

@app.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()

    if not email or not otp_code:
        return jsonify({"error": "Email and OTP required"}), 400

    entry = OTP.query.filter_by(email=email, otp=otp_code).order_by(OTP.created_at.desc()).first()
    if not entry:
        return jsonify({"error": "Invalid OTP"}), 400

    if datetime.datetime.utcnow() - entry.created_at > timedelta(minutes=5):
        return jsonify({"error": "OTP expired"}), 400

    user = User(email=email, role="client")
    db.session.add(user)
    db.session.commit()

    token = create_token(email, "client")
    return jsonify({"message": "Login successful", "user": {"email": email, "role": "client"}, "token": token}), 200

@app.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if email not in [adm.strip().lower() for adm in ADMIN_EMAILS]:
        return jsonify({"error": "Not an admin"}), 403

    if password != ADMIN_PASSWORD:
        return jsonify({"error": "Invalid password"}), 401

    user = User(email=email, role="admin")
    db.session.add(user)
    db.session.commit()

    token = create_token(email, "admin")
    return jsonify({"message": "Admin login successful", "user": {"email": email, "role": "admin"}, "token": token}), 200

# -------------------- CLIENT MANAGEMENT --------------------
@app.route("/admin/add-client", methods=["POST"])
def add_allowed_client():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email required"}), 400

    if AllowedClient.query.filter_by(email=email).first():
        return jsonify({"error": "Client already exists"}), 400

    client = AllowedClient(email=email)
    db.session.add(client)
    db.session.commit()

    return jsonify({"message": f"Client {email} added successfully", "client": serialize_client(client)}), 200

@app.route("/admin/clients", methods=["GET"])
def get_clients():
    clients = AllowedClient.query.order_by(AllowedClient.added_at.desc()).all()
    return jsonify([serialize_client(c) for c in clients]), 200

@app.route("/admin/update-client/<int:client_id>", methods=["PUT"])
def update_client(client_id):
    data = request.get_json(silent=True) or {}
    new_email = (data.get("email") or "").strip().lower()

    client = AllowedClient.query.get(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404

    if not new_email:
        return jsonify({"error": "Email required"}), 400

    client.email = new_email
    db.session.commit()
    return jsonify({"message": "Client updated", "client": serialize_client(client)}), 200

@app.route("/admin/delete-client/<int:client_id>", methods=["DELETE"])
def delete_client(client_id):
    client = AllowedClient.query.get(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404

    db.session.delete(client)
    db.session.commit()
    return jsonify({"message": "Client deleted"}), 200

@app.route("/admin/toggle-client/<int:client_id>", methods=["PATCH"])
def toggle_client(client_id):
    client = AllowedClient.query.get(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404

    client.status = "inactive" if client.status == "active" else "active"
    db.session.commit()
    return jsonify({"message": f"Client {client.email} set to {client.status}", "client": serialize_client(client)}), 200

# -------------------- PROJECTS & REPORTS --------------------
@app.route("/admin/create-project", methods=["POST"])
def create_project():
    """
    Multipart form-data:
      - title: str
      - client_id: int
      - email: admin email
      - file: first report file
    """
    title = (request.form.get("title") or "").strip()
    client_id = request.form.get("client_id")
    email = (request.form.get("email") or "").strip().lower()
    file = request.files.get("file")

    if not title or not client_id or not file:
        return jsonify({"error": "Title, client, and file required"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    client = AllowedClient.query.get(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404

    # save with a unique filename to avoid collisions
    stored_name = f"{datetime.datetime.utcnow().timestamp()}_{file.filename}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], stored_name))

    project = Project(title=title, client_id=client.id)
    db.session.add(project)
    db.session.commit()

    first_report = Report(
        name=file.filename,
        filename=stored_name,
        version=1,
        uploaded_by=email or "admin@example.com",
        project_id=project.id
    )
    db.session.add(first_report)
    db.session.commit()

    return jsonify({"message": "Project created", "project": serialize_project(project)}), 200

@app.route("/project/<int:project_id>/add-report", methods=["POST"])
def add_followup(project_id):
    """
    Multipart form-data:
      - email: who uploads (admin or client email)
      - file: follow-up report file
    """
    file = request.files.get("file")
    email = (request.form.get("email") or "").strip().lower()

    if not file or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file"}), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # compute next version
    last = Report.query.filter_by(project_id=project.id).order_by(Report.version.desc()).first()
    new_version = 1 if not last else last.version + 1

    stored_name = f"{datetime.datetime.utcnow().timestamp()}_{file.filename}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], stored_name))

    report = Report(
        name=file.filename,
        filename=stored_name,
        version=new_version,
        uploaded_by=email or "unknown",
        project_id=project.id
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({"message": "Follow-up report added", "report": serialize_report(report)}), 200

@app.route("/projects", methods=["GET"])
def get_projects():
    """
    Query param:
      - email: requester email; admins get all projects, clients get their own
    Sorted by latest activity (most recent report uploaded_at).
    """
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email required"}), 400

    is_admin = email in [adm.strip().lower() for adm in ADMIN_EMAILS]
    if is_admin:
        projects = Project.query.all()
    else:
        client = AllowedClient.query.filter_by(email=email).first()
        if not client:
            return jsonify([]), 200
        projects = Project.query.filter_by(client_id=client.id).all()

    # sort by latest activity (latest report uploaded_at), fallback to created_at
    def latest_activity(p: Project):
        if p.reports:
            return max(r.uploaded_at for r in p.reports)
        return p.created_at

    projects_sorted = sorted(projects, key=latest_activity, reverse=True)
    return jsonify([serialize_project(p) for p in projects_sorted]), 200

# Optional legacy endpoint: flat list of reports (kept for compatibility)
@app.route("/reports", methods=["GET"])
def get_reports():
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email required"}), 400

    is_admin = email in [adm.strip().lower() for adm in ADMIN_EMAILS]
    if is_admin:
        reports = Report.query.order_by(Report.uploaded_at.desc()).all()
    else:
        client = AllowedClient.query.filter_by(email=email).first()
        if not client:
            return jsonify([]), 200
        reports = (
            Report.query.join(Project, Report.project_id == Project.id)
            .filter(Project.client_id == client.id)
            .order_by(Report.uploaded_at.desc())
            .all()
        )

    return jsonify([serialize_report(r) for r in reports]), 200

@app.route("/download/<int:report_id>", methods=["GET"])
def download_report(report_id):
    r = Report.query.get(report_id)
    if not r:
        return jsonify({"error": "Not found"}), 404
    directory = os.path.abspath(app.config["UPLOAD_FOLDER"])
    return send_from_directory(directory, r.filename, as_attachment=True, download_name=r.name)

# -------------------- COMMENTS --------------------
@app.route("/comments/<int:report_id>", methods=["GET"])
def get_comments(report_id):
    comments = Comment.query.filter_by(report_id=report_id).order_by(Comment.created_at.desc()).all()
    result = [{
        "id": c.id,
        "text": c.text,
        "user_email": c.user_email,
        "created_at": json_dt(c.created_at)
    } for c in comments]
    return jsonify(result), 200

@app.route("/comments/<int:report_id>", methods=["POST"])
def add_comment(report_id):
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    email = (data.get("email") or "").strip().lower()

    if not text or not email:
        return jsonify({"error": "Missing text/email"}), 400

    if not Report.query.get(report_id):
        return jsonify({"error": "Report not found"}), 404

    cmt = Comment(report_id=report_id, user_email=email, text=text)
    db.session.add(cmt)
    db.session.commit()

    return jsonify({
        "message": "Comment added",
        "comment": {
            "id": cmt.id,
            "text": cmt.text,
            "user_email": cmt.user_email,
            "created_at": json_dt(cmt.created_at)
        }
    }), 200

# -------------------- HEALTH --------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.datetime.utcnow().isoformat()}), 200

# -------------------- INIT --------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)
