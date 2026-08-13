import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from pwdlib import PasswordHash


# =========================================
# ENVIRONMENT
# =========================================

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv(
    "DATABASE_NAME",
    "absensi_sekolah"
)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI belum diatur di .env"
    )

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY belum diatur di .env"
    )


# =========================================
# APP
# =========================================

app = FastAPI(
    title="Absensi Sekolah API",
    version="1.1.0"
)


# =========================================
# CORS
# =========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.101.5:5173",
        "https://absensi-app-ginzz.vercel.app",
        "https://absensi-app-git-main-ginzz.vercel.app",
        "https://absensi-14i66ap7e-ginzz.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# MONGODB
# =========================================

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

db = client[DATABASE_NAME]

users_collection = db["users"]
attendance_sessions_collection = db[
    "attendance_sessions"
]
attendance_collection = db["attendance"]

# COLLECTION BARU UNTUK IZIN
permissions_collection = db["permissions"]


# =========================================
# PASSWORD HASH
# =========================================

password_hash = PasswordHash.recommended()


# =========================================
# MODELS
# =========================================

class LoginRequest(BaseModel):
    identifier: str
    password: str
    role: str


class CreateAttendanceSessionRequest(BaseModel):
    class_name: str


class ScanAttendanceRequest(BaseModel):
    session_code: str


class CreatePermissionRequest(BaseModel):
    date: str
    reason: str
    description: str


class UpdatePermissionRequest(BaseModel):
    status: str
    teacher_reply: str


# =========================================
# HELPER
# =========================================

def normalize_class_name(class_name):
    """
    Mengubah berbagai format kelas menjadi
    kode kelas sederhana.

    Contoh:
    A       -> A
    a       -> A
    IX-A    -> A
    VIII-B  -> B
    9A      -> A
    """
    if not class_name:
        return ""

    value = str(class_name).strip().upper()

    # Format seperti IX-A / VIII-B / VII-C
    if "-" in value:
        last_part = value.split("-")[-1].strip()

        if last_part in list("ABCDEFGHIJK"):
            return last_part

    # Format seperti 9A / 8B / 7C
    for letter in "ABCDEFGHIJK":
        if value.endswith(letter):
            return letter

    if value in list("ABCDEFGHIJK"):
        return value

    return value


def get_object_id(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


# =========================================
# JWT
# =========================================

def create_access_token(user):
    payload = {
        "sub": str(user["_id"]),
        "role": user["role"],
        "name": user["name"],
        "exp": (
            datetime.now(timezone.utc)
            + timedelta(hours=8)
        ),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm="HS256"
    )


def get_current_user(
    authorization: str | None = Header(default=None)
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token tidak ditemukan"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Format token tidak valid"
        )

    token = authorization.split(
        " ",
        1
    )[1]

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token sudah expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Token tidak valid"
        )


def require_teacher(
    authorization: str | None = Header(default=None)
):
    payload = get_current_user(authorization)

    if payload.get("role") != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Akses hanya untuk guru"
        )

    return payload


def require_student(
    authorization: str | None = Header(default=None)
):
    payload = get_current_user(authorization)

    if payload.get("role") != "student":
        raise HTTPException(
            status_code=403,
            detail="Akses hanya untuk siswa"
        )

    return payload


# =========================================
# ROOT
# =========================================

@app.get("/")
def root():
    return {
        "message": "Absensi Sekolah API berjalan"
    }


# =========================================
# HEALTH CHECK
# =========================================

@app.get("/api/health")
def health_check():

    try:
        client.admin.command("ping")

        return {
            "status": "ok",
            "database": "connected"
        }

    except Exception as e:

        return {
            "status": "error",
            "database": "disconnected",
            "detail": str(e)
        }


# =========================================
# LOGIN
# =========================================

@app.post("/api/auth/login")
def login(data: LoginRequest):

    role = data.role.lower().strip()
    identifier = data.identifier.strip()

    if role not in [
        "student",
        "teacher"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Role tidak valid"
        )

    # STUDENT
    if role == "student":

        user = users_collection.find_one({
            "nis": identifier,
            "role": "student"
        })

    # TEACHER
    else:

        user = users_collection.find_one({
            "email": identifier.lower(),
            "role": "teacher"
        })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Akun tidak ditemukan"
        )

    try:

        password_valid = password_hash.verify(
            data.password,
            user["password_hash"]
        )

    except Exception:

        password_valid = False

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Password salah"
        )

    token = create_access_token(user)

    return {
        "message": "Login berhasil",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "role": user["role"],
            "nis": user.get("nis"),
            "email": user.get("email"),
            "class_name": user.get(
                "class_name"
            ),
        }
    }


# =========================================
# CURRENT USER
# =========================================

@app.get("/api/auth/me")
def auth_me(
    authorization: str | None = Header(default=None)
):

    payload = get_current_user(
        authorization
    )

    return {
        "user_id": payload["sub"],
        "name": payload["name"],
        "role": payload["role"]
    }


# =========================================
# GET STUDENTS
# =========================================

@app.get("/api/teacher/students")
def get_students(
    class_name: str,
    authorization: str | None = Header(default=None)
):

    require_teacher(authorization)

    class_name = normalize_class_name(
        class_name
    )

    if class_name not in list("ABCDEFGHIJK"):
        raise HTTPException(
            status_code=400,
            detail="Kelas tidak valid"
        )

    students = list(
        users_collection.find(
            {
                "role": "student"
            },
            {
                "password_hash": 0
            }
        ).sort("name", 1)
    )

    result = []

    for student in students:

        student_class = normalize_class_name(
            student.get("class_name", "")
        )

        if student_class != class_name:
            continue

        result.append({
            "id": str(student["_id"]),
            "name": student.get(
                "name",
                "-"
            ),
            "nis": student.get(
                "nis",
                "-"
            ),
            "class_name": student_class
        })

    return {
        "class_name": class_name,
        "students": result,
        "total": len(result)
    }


# =========================================
# HISTORI ABSENSI SISWA
# =========================================

@app.get("/api/student/attendance/history")
def get_student_attendance_history(
    authorization: str | None = Header(default=None)
):

    student = require_student(
        authorization
    )

    records = list(
        attendance_collection.find({
            "student_id": student["sub"]
        }).sort(
            "timestamp",
            -1
        )
    )

    history = []

    for record in records:

        timestamp = record.get(
            "timestamp"
        )

        history.append({
            "id": str(record["_id"]),

            "date": (
                record.get("date")
                or (
                    timestamp.strftime(
                        "%Y-%m-%d"
                    )
                    if timestamp
                    else "-"
                )
            ),

            "time": (
                record.get("time")
                or (
                    timestamp.strftime(
                        "%H:%M"
                    )
                    if timestamp
                    else "-"
                )
            ),

            "status": record.get(
                "status",
                "hadir"
            ),

            "class_name": record.get(
                "class_name",
                "-"
            ),

            "teacher_name": record.get(
                "teacher_name",
                "-"
            )
        })

    return {
        "history": history
    }


# =========================================
# TODAY ATTENDANCE
# =========================================

@app.get("/api/teacher/attendance/today")
def get_today_attendance(
    class_name: str,
    authorization: str | None = Header(default=None)
):

    require_teacher(authorization)

    class_name = normalize_class_name(
        class_name
    )

    today = datetime.now(
        timezone.utc
    ).strftime("%Y-%m-%d")

    students = list(
        users_collection.find(
            {
                "role": "student"
            },
            {
                "password_hash": 0
            }
        ).sort("name", 1)
    )

    attendance_records = list(
        attendance_collection.find({
            "date": today
        })
    )

    attendance_map = {}

    for record in attendance_records:

        record_class = normalize_class_name(
            record.get("class_name", "")
        )

        if record_class != class_name:
            continue

        attendance_map[
            str(record.get("student_id"))
        ] = record

    result = []

    for student in students:

        student_class = normalize_class_name(
            student.get("class_name", "")
        )

        if student_class != class_name:
            continue

        student_id = str(
            student["_id"]
        )

        attendance = attendance_map.get(
            student_id
        )

        result.append({
            "student_id": student_id,

            "name": student.get(
                "name",
                "-"
            ),

            "nis": student.get(
                "nis",
                "-"
            ),

            "class_name": student_class,

            "status": (
                attendance.get(
                    "status",
                    "belum_absen"
                )
                if attendance
                else "belum_absen"
            ),

            "time": (
                attendance.get("time")
                if attendance
                else None
            )
        })

    return {
        "date": today,
        "class_name": class_name,
        "students": result
    }


# =========================================
# CREATE ATTENDANCE SESSION
# =========================================

@app.post(
    "/api/teacher/attendance/session"
)
def create_attendance_session(
    data: CreateAttendanceSessionRequest,
    authorization: str | None = Header(default=None)
):

    teacher = require_teacher(
        authorization
    )

    class_name = normalize_class_name(
        data.class_name
    )

    if class_name not in list("ABCDEFGHIJK"):
        raise HTTPException(
            status_code=400,
            detail="Kelas tidak valid"
        )

    # Nonaktifkan sesi lama
    attendance_sessions_collection.update_many(
        {
            "class_name": class_name,
            "active": True
        },
        {
            "$set": {
                "active": False
            }
        }
    )

    session_code = secrets.token_urlsafe(
        24
    )

    now = datetime.now(
        timezone.utc
    )

    expires_at = (
        now
        + timedelta(minutes=30)
    )

    session = {
        "session_code": session_code,
        "class_name": class_name,
        "teacher_id": teacher["sub"],
        "teacher_name": teacher["name"],
        "created_at": now,
        "expires_at": expires_at,
        "active": True
    }

    attendance_sessions_collection.insert_one(
        session
    )

    return {
        "message": "Sesi absensi berhasil dibuat",
        "session_code": session_code,
        "class_name": class_name,
        "expires_at": expires_at.isoformat(),
        "active": True
    }


# =========================================
# END ATTENDANCE SESSION
# =========================================

@app.post(
    "/api/teacher/attendance/session/{session_code}/stop"
)
def stop_attendance_session(
    session_code: str,
    authorization: str | None = Header(default=None)
):

    teacher = require_teacher(
        authorization
    )

    session = attendance_sessions_collection.find_one({
        "session_code": session_code,
        "teacher_id": teacher["sub"]
    })

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Sesi tidak ditemukan"
        )

    attendance_sessions_collection.update_one(
        {
            "_id": session["_id"]
        },
        {
            "$set": {
                "active": False
            }
        }
    )

    return {
        "message": "Sesi absensi diakhiri"
    }


# =========================================
# SCAN ATTENDANCE
# =========================================

@app.post(
    "/api/student/attendance/scan"
)
def scan_attendance(
    data: ScanAttendanceRequest,
    authorization: str | None = Header(default=None)
):

    student = require_student(
        authorization
    )

    session_code = (
        data.session_code.strip()
    )

    session = attendance_sessions_collection.find_one({
        "session_code": session_code,
        "active": True
    })

    if not session:
        raise HTTPException(
            status_code=404,
            detail="QR tidak valid atau sesi sudah berakhir"
        )

    now = datetime.now(
        timezone.utc
    )

    # MongoDB kadang mengembalikan datetime
    # tanpa timezone.
    expires_at = session.get(
        "expires_at"
    )

    if expires_at is None:
        raise HTTPException(
            status_code=500,
            detail="Data waktu sesi tidak valid"
        )

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at <= now:

        attendance_sessions_collection.update_one(
            {
                "_id": session["_id"]
            },
            {
                "$set": {
                    "active": False
                }
            }
        )

        raise HTTPException(
            status_code=400,
            detail="QR sudah kedaluwarsa"
        )

    # Cari data siswa
    student_id = get_object_id(
        student["sub"]
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid"
        )

    student_data = users_collection.find_one({
        "_id": student_id,
        "role": "student"
    })

    if not student_data:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan"
        )

    # NORMALISASI KELAS
    student_class = normalize_class_name(
        student_data.get(
            "class_name",
            ""
        )
    )

    session_class = normalize_class_name(
        session.get(
            "class_name",
            ""
        )
    )

    # IX-A dan A sekarang dianggap sama
    if student_class != session_class:
        raise HTTPException(
            status_code=403,
            detail=(
                "QR ini bukan untuk kelas kamu "
                f"(kelas kamu: {student_class}, "
                f"QR: {session_class})"
            )
        )

    # Cek sudah absen
    existing = attendance_collection.find_one({
        "session_code": session_code,
        "student_id": student["sub"]
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Kamu sudah melakukan absensi"
        )

    today = now.strftime(
        "%Y-%m-%d"
    )

    current_time = now.strftime(
        "%H:%M:%S"
    )

    attendance = {
        "session_code": session_code,
        "student_id": student["sub"],
        "student_name": student_data["name"],
        "nis": student_data.get("nis"),
        "class_name": student_class,
        "teacher_id": session["teacher_id"],
        "teacher_name": session["teacher_name"],
        "status": "hadir",
        "date": today,
        "time": current_time,
        "timestamp": now
    }

    attendance_collection.insert_one(
        attendance
    )

    return {
        "message": "Absensi berhasil",
        "status": "hadir",
        "student_name": student_data["name"],
        "class_name": student_class,
        "timestamp": now.isoformat()
    }


# =========================================
# IZIN SISWA
# =========================================

@app.post(
    "/api/student/permissions"
)
def create_permission(
    data: CreatePermissionRequest,
    authorization: str | None = Header(default=None)
):

    student = require_student(
        authorization
    )

    date = data.date.strip()
    reason = data.reason.strip()
    description = data.description.strip()

    if not date:
        raise HTTPException(
            status_code=400,
            detail="Tanggal izin wajib diisi"
        )

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Alasan izin wajib diisi"
        )

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Keterangan izin wajib diisi"
        )

    # Validasi format tanggal
    try:
        datetime.strptime(
            date,
            "%Y-%m-%d"
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Format tanggal harus YYYY-MM-DD"
        )

    student_id = get_object_id(
        student["sub"]
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid"
        )

    student_data = users_collection.find_one({
        "_id": student_id,
        "role": "student"
    })

    if not student_data:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan"
        )

    class_name = normalize_class_name(
        student_data.get(
            "class_name",
            ""
        )
    )

    # Cek pengajuan yang masih pending
    existing = permissions_collection.find_one({
        "student_id": student["sub"],
        "date": date,
        "status": "pending"
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kamu masih memiliki pengajuan "
                "izin yang menunggu persetujuan "
                "untuk tanggal tersebut"
            )
        )

    now = datetime.now(
        timezone.utc
    )

    permission = {
        "student_id": student["sub"],
        "student_name": student_data.get(
            "name",
            "-"
        ),
        "nis": student_data.get(
            "nis"
        ),
        "class_name": class_name,

        "date": date,

        "reason": reason,

        "description": description,

        "status": "pending",

        "teacher_reply": None,

        "teacher_id": None,

        "teacher_name": None,

        "created_at": now,

        "updated_at": now
    }

    result = permissions_collection.insert_one(
        permission
    )

    return {
        "message": "Pengajuan izin berhasil dikirim",
        "id": str(result.inserted_id),
        "status": "pending"
    }


# =========================================
# RIWAYAT IZIN SISWA
# =========================================

@app.get(
    "/api/student/permissions"
)
def get_student_permissions(
    authorization: str | None = Header(default=None)
):

    student = require_student(
        authorization
    )

    records = list(
        permissions_collection.find({
            "student_id": student["sub"]
        }).sort(
            "created_at",
            -1
        )
    )

    result = []

    for record in records:

        created_at = record.get(
            "created_at"
        )

        updated_at = record.get(
            "updated_at"
        )

        result.append({
            "id": str(record["_id"]),

            "date": record.get(
                "date",
                "-"
            ),

            "reason": record.get(
                "reason",
                "-"
            ),

            "description": record.get(
                "description",
                "-"
            ),

            "status": record.get(
                "status",
                "pending"
            ),

            "teacher_reply": record.get(
                "teacher_reply"
            ),

            "teacher_name": record.get(
                "teacher_name"
            ),

            "created_at": (
                created_at.isoformat()
                if created_at
                else None
            ),

            "updated_at": (
                updated_at.isoformat()
                if updated_at
                else None
            )
        })

    return {
        "permissions": result
    }


# =========================================
# GET SEMUA IZIN UNTUK GURU
# =========================================

@app.get(
    "/api/teacher/permissions"
)
def get_teacher_permissions(
    status: str | None = None,
    class_name: str | None = None,
    authorization: str | None = Header(default=None)
):

    require_teacher(authorization)

    query = {}

    if status:
        status = status.strip().lower()

        if status not in [
            "pending",
            "approved",
            "rejected"
        ]:
            raise HTTPException(
                status_code=400,
                detail="Status tidak valid"
            )

        query["status"] = status

    if class_name:
        query["class_name"] = normalize_class_name(
            class_name
        )

    records = list(
        permissions_collection.find(
            query
        ).sort(
            "created_at",
            -1
        )
    )

    result = []

    for record in records:

        created_at = record.get(
            "created_at"
        )

        updated_at = record.get(
            "updated_at"
        )

        result.append({
            "id": str(record["_id"]),

            "student_id": record.get(
                "student_id"
            ),

            "student_name": record.get(
                "student_name",
                "-"
            ),

            "nis": record.get(
                "nis",
                "-"
            ),

            "class_name": normalize_class_name(
                record.get(
                    "class_name",
                    ""
                )
            ),

            "date": record.get(
                "date",
                "-"
            ),

            "reason": record.get(
                "reason",
                "-"
            ),

            "description": record.get(
                "description",
                "-"
            ),

            "status": record.get(
                "status",
                "pending"
            ),

            "teacher_reply": record.get(
                "teacher_reply"
            ),

            "teacher_name": record.get(
                "teacher_name"
            ),

            "created_at": (
                created_at.isoformat()
                if created_at
                else None
            ),

            "updated_at": (
                updated_at.isoformat()
                if updated_at
                else None
            )
        })

    return {
        "permissions": result,
        "total": len(result)
    }


# =========================================
# GURU MEMPROSES IZIN
# =========================================

@app.put(
    "/api/teacher/permissions/{permission_id}"
)
def update_permission(
    permission_id: str,
    data: UpdatePermissionRequest,
    authorization: str | None = Header(default=None)
):

    teacher = require_teacher(
        authorization
    )

    permission_object_id = get_object_id(
        permission_id
    )

    if not permission_object_id:
        raise HTTPException(
            status_code=400,
            detail="ID pengajuan izin tidak valid"
        )

    status = data.status.strip().lower()
    teacher_reply = data.teacher_reply.strip()

    if status not in [
        "approved",
        "rejected"
    ]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status harus approved "
                "atau rejected"
            )
        )

    if not teacher_reply:
        raise HTTPException(
            status_code=400,
            detail="Balasan guru wajib diisi"
        )

    permission = permissions_collection.find_one({
        "_id": permission_object_id
    })

    if not permission:
        raise HTTPException(
            status_code=404,
            detail="Pengajuan izin tidak ditemukan"
        )

    if permission.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Pengajuan izin ini sudah diproses"
            )
        )

    now = datetime.now(
        timezone.utc
    )

    permissions_collection.update_one(
        {
            "_id": permission_object_id
        },
        {
            "$set": {
                "status": status,
                "teacher_reply": teacher_reply,
                "teacher_id": teacher["sub"],
                "teacher_name": teacher["name"],
                "updated_at": now
            }
        }
    )

    # Jika disetujui, masukkan sebagai izin
    # ke data absensi.
    if status == "approved":

        student_id = permission.get(
            "student_id"
        )

        permission_date = permission.get(
            "date"
        )

        existing_attendance = attendance_collection.find_one({
            "student_id": student_id,
            "date": permission_date
        })

        if not existing_attendance:

            attendance_collection.insert_one({
                "student_id": student_id,

                "student_name": permission.get(
                    "student_name",
                    "-"
                ),

                "nis": permission.get(
                    "nis"
                ),

                "class_name": normalize_class_name(
                    permission.get(
                        "class_name",
                        ""
                    )
                ),

                "teacher_id": teacher["sub"],

                "teacher_name": teacher["name"],

                "status": "izin",

                "date": permission_date,

                "time": None,

                "permission_id": str(
                    permission_object_id
                ),

                "timestamp": now
            })

    return {
        "message": (
            "Pengajuan izin berhasil "
            + (
                "disetujui"
                if status == "approved"
                else "ditolak"
            )
        ),

        "permission_id": permission_id,

        "status": status,

        "teacher_reply": teacher_reply
    }


# =========================================
# STATUS
# =========================================

@app.get("/api/status")
def status():

    return {
        "application": "Absensi Sekolah",
        "status": "running",
        "version": "1.1.0",
        "classes": list("ABCDEFGHIJK"),
        "features": [
            "login",
            "qr_attendance",
            "attendance_history",
            "student_permission",
            "teacher_permission_approval",
            "teacher_reply"
        ]
    }