import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "absensi_sekolah")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI belum diatur di .env")

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY belum diatur di .env")

if len(JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY harus memiliki minimal 32 karakter"
    )


# =========================================================
# CONSTANTS
# =========================================================

APP_VERSION = "1.4.0"

LOCAL_TIMEZONE = ZoneInfo("Asia/Jakarta")

CLASS_LETTERS = list("ABCDEFGHIJK")

VALID_CLASSES = [
    f"{grade}{letter}"
    for grade in [7, 8, 9]
    for letter in CLASS_LETTERS
]

VALID_ROLES = {
    "student",
    "teacher",
    "admin",
}

VALID_PERMISSION_STATUSES = {
    "pending",
    "approved",
    "rejected",
}

VALID_ATTENDANCE_STATUSES = {
    "hadir",
    "izin",
    "alpha",
}

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8
ATTENDANCE_SESSION_MINUTES = 30


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Absensi Sekolah API",
    version=APP_VERSION,
)


# =========================================================
# CORS
# =========================================================

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.101.5:5173",

    "https://absensi-app-ginzz.vercel.app",
    "https://absensi-app-git-main-ginzz.vercel.app",
    "https://absensi-cp3gb2nw4-ginzz.vercel.app",
    "https://absensi-qbo6x3znp-ginzz.vercel.app",
]

ENV_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "",
)

ALLOWED_ORIGINS = list(DEFAULT_ALLOWED_ORIGINS)

if ENV_ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.extend(
        origin.strip()
        for origin in ENV_ALLOWED_ORIGINS.split(",")
        if origin.strip()
    )

# Hapus duplikat
ALLOWED_ORIGINS = list(dict.fromkeys(ALLOWED_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


# =========================================================
# MONGODB
# =========================================================

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000,
)

db = client[DATABASE_NAME]

users_collection = db["users"]

attendance_sessions_collection = db[
    "attendance_sessions"
]

attendance_collection = db[
    "attendance"
]

permissions_collection = db[
    "permissions"
]


# =========================================================
# PASSWORD
# =========================================================

password_hash = PasswordHash.recommended()


# =========================================================
# AUTHENTICATION
# =========================================================

security = HTTPBearer(
    auto_error=False,
)


# =========================================================
# PYDANTIC MODELS
# =========================================================

class LoginRequest(BaseModel):
    identifier: str = Field(
        min_length=1,
        max_length=100,
    )
    password: str = Field(
        min_length=1,
        max_length=256,
    )
    role: str = Field(
        min_length=1,
        max_length=20,
    )


class CreateAttendanceSessionRequest(BaseModel):
    class_name: str = Field(
        min_length=1,
        max_length=20,
    )


class ScanAttendanceRequest(BaseModel):
    session_code: str = Field(
        min_length=1,
        max_length=200,
    )


class CreatePermissionRequest(BaseModel):
    date: str = Field(
        min_length=10,
        max_length=10,
    )
    reason: str = Field(
        min_length=1,
        max_length=100,
    )
    description: str = Field(
        min_length=1,
        max_length=1000,
    )


class UpdatePermissionRequest(BaseModel):
    status: str = Field(
        min_length=1,
        max_length=20,
    )
    teacher_reply: str = Field(
        min_length=1,
        max_length=1000,
    )


class CreateUserRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150,
    )
    role: str = Field(
        min_length=1,
        max_length=20,
    )
    password: str = Field(
        min_length=1,
        max_length=256,
    )
    nis: str | None = Field(
        default=None,
        max_length=50,
    )
    email: str | None = Field(
        default=None,
        max_length=254,
    )
    class_name: str | None = Field(
        default=None,
        max_length=20,
    )


class UpdateUserPasswordRequest(BaseModel):
    password: str = Field(
        min_length=1,
        max_length=256,
    )


class ChangeStudentPasswordRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=256,
    )
    new_password: str = Field(
        min_length=1,
        max_length=256,
    )


class ManualAttendanceRequest(BaseModel):
    student_id: str = Field(
        min_length=1,
        max_length=100,
    )
    date: str = Field(
        min_length=10,
        max_length=10,
    )
    status: str = Field(
        min_length=1,
        max_length=20,
    )
    password: str = Field(
        min_length=1,
        max_length=256,
    )


# =========================================================
# GENERAL HELPERS
# =========================================================

def get_local_now() -> datetime:
    return datetime.now(LOCAL_TIMEZONE)


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_object_id(value: str | None):
    if not value:
        return None

    try:
        return ObjectId(value)
    except Exception:
        return None


def normalize_class_name(class_name: str | None) -> str:
    if not class_name:
        return ""

    value = str(class_name).strip().upper()

    value = value.replace(" ", "")
    value = value.replace("-", "")

    roman_to_number = {
        "VIII": "8",
        "VII": "7",
        "IX": "9",
    }

    for roman, number in roman_to_number.items():
        if value.startswith(roman):
            value = number + value[len(roman):]
            break

    return value


def validate_class_name(class_name: str) -> str:
    normalized = normalize_class_name(class_name)

    if normalized not in VALID_CLASSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kelas tidak valid. "
                "Gunakan 7A-7K, 8A-8K, atau 9A-9K"
            ),
        )

    return normalized


def validate_date(date: str) -> str:
    date = date.strip()

    try:
        datetime.strptime(
            date,
            "%Y-%m-%d",
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Format tanggal harus YYYY-MM-DD",
        )

    return date


def validate_password(password: str) -> str:
    if not password or not password.strip():
        raise HTTPException(
            status_code=400,
            detail="Password wajib diisi",
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password minimal 6 karakter",
        )

    if len(password) > 256:
        raise HTTPException(
            status_code=400,
            detail="Password terlalu panjang",
        )

    return password


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    try:
        return password_hash.verify(
            plain_password,
            hashed_password,
        )
    except Exception:
        return False


def serialize_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)


# =========================================================
# JWT
# =========================================================

def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user["_id"]),
        "role": user["role"],
        "name": user["name"],
        "iat": now,
        "exp": now + timedelta(
            hours=JWT_EXPIRE_HOURS
        ),
        "jti": secrets.token_urlsafe(16),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authorization token tidak ditemukan",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    token = credentials.credentials.strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization token tidak ditemukan",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={
                "require": [
                    "sub",
                    "role",
                    "name",
                    "iat",
                    "exp",
                    "jti",
                ]
            },
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token sudah expired",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Token tidak valid",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    role = payload.get("role")

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=401,
            detail="Role pada token tidak valid",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    user_id = get_object_id(
        payload.get("sub")
    )

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="ID pengguna pada token tidak valid",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # Pastikan akun masih ada.
    user = users_collection.find_one(
        {
            "_id": user_id,
            "role": role,
        },
        {
            "password_hash": 0,
        },
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Akun tidak ditemukan atau sudah tidak aktif",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    payload["user"] = user

    return payload


def require_role(
    required_role: str,
    payload: dict,
):
    if payload.get("role") != required_role:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Akses hanya untuk {required_role}"
            ),
        )

    return payload


def require_teacher(
    payload: dict = Depends(get_current_user),
):
    return require_role(
        "teacher",
        payload,
    )


def require_student(
    payload: dict = Depends(get_current_user),
):
    return require_role(
        "student",
        payload,
    )


def require_admin(
    payload: dict = Depends(get_current_user),
):
    return require_role(
        "admin",
        payload,
    )


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "Absensi Sekolah API berjalan",
        "version": APP_VERSION,
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():
    try:
        client.admin.command("ping")

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception:
        return {
            "status": "error",
            "database": "disconnected",
        }


# =========================================================
# LOGIN
# =========================================================

@app.post("/api/auth/login")
def login(data: LoginRequest):
    role = data.role.strip().lower()
    identifier = data.identifier.strip()
    password = data.password

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Role tidak valid",
        )

    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Identifier wajib diisi",
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password wajib diisi",
        )

    if role == "student":
        user = users_collection.find_one(
            {
                "nis": identifier,
                "role": "student",
            }
        )

    else:
        user = users_collection.find_one(
            {
                "email": {
                    "$regex": (
                        f"^{re.escape(identifier)}$"
                    ),
                    "$options": "i",
                },
                "role": role,
            }
        )

    # Jangan memberikan informasi terlalu spesifik
    # mengenai apakah akun atau password yang salah.
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Identifier atau password salah",
        )

    if not verify_password(
        password,
        user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=401,
            detail="Identifier atau password salah",
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
            "class_name": user.get("class_name"),
        },
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/api/auth/me")
def auth_me(
    payload: dict = Depends(get_current_user),
):
    user = payload["user"]

    return {
        "user_id": str(user["_id"]),
        "name": user.get("name"),
        "role": user.get("role"),
        "nis": user.get("nis"),
        "email": user.get("email"),
        "class_name": user.get("class_name"),
    }


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@app.get("/api/admin/dashboard")
def admin_dashboard(
    admin: dict = Depends(require_admin),
):
    today = get_local_now().strftime("%Y-%m-%d")

    total_students = users_collection.count_documents(
        {
            "role": "student"
        }
    )

    total_teachers = users_collection.count_documents(
        {
            "role": "teacher"
        }
    )

    total_admins = users_collection.count_documents(
        {
            "role": "admin"
        }
    )

    attendance_today = attendance_collection.count_documents(
        {
            "date": today
        }
    )

    permissions_pending = permissions_collection.count_documents(
        {
            "status": "pending"
        }
    )

    return {
        "statistics": {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_classes": len(VALID_CLASSES),
            "total_admins": total_admins,
            "attendance_today": attendance_today,
            "permissions_pending": permissions_pending,
        }
    }


# =========================================================
# ADMIN - GET USERS
# =========================================================

@app.get("/api/admin/users")
def admin_get_users(
    role: str | None = None,
    class_name: str | None = None,
    admin: dict = Depends(require_admin),
):
    query = {}

    if role:
        role = role.strip().lower()

        if role not in VALID_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Role tidak valid",
            )

        query["role"] = role

    if class_name:
        normalized_class = validate_class_name(
            class_name
        )

        query["class_name"] = normalized_class

    users = list(
        users_collection.find(
            query,
            {
                "password_hash": 0
            },
        ).sort(
            "name",
            1,
        )
    )

    result = []

    for user in users:
        result.append(
            {
                "id": str(user["_id"]),
                "name": user.get("name", "-"),
                "role": user.get("role", "-"),
                "nis": user.get("nis"),
                "email": user.get("email"),
                "class_name": (
                    normalize_class_name(
                        user.get("class_name")
                    )
                    or None
                ),
            }
        )

    return {
        "users": result,
        "total": len(result),
    }


# =========================================================
# ADMIN - CREATE USER
# =========================================================

@app.post("/api/admin/users")
def admin_create_user(
    data: CreateUserRequest,
    admin: dict = Depends(require_admin),
):
    name = data.name.strip()
    role = data.role.strip().lower()
    password = validate_password(data.password)

    nis = (
        data.nis.strip()
        if data.nis
        else None
    )

    email = (
        data.email.strip().lower()
        if data.email
        else None
    )

    class_name = (
        normalize_class_name(data.class_name)
        if data.class_name
        else None
    )

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Nama wajib diisi",
        )

    if role not in {
        "student",
        "teacher",
    }:
        raise HTTPException(
            status_code=400,
            detail="Role akun harus student atau teacher",
        )

    if role == "student":
        if not nis:
            raise HTTPException(
                status_code=400,
                detail="NIS wajib diisi untuk siswa",
            )

        if not class_name:
            raise HTTPException(
                status_code=400,
                detail="Kelas wajib diisi untuk siswa",
            )

        class_name = validate_class_name(
            class_name
        )

        existing_nis = users_collection.find_one(
            {
                "nis": nis
            }
        )

        if existing_nis:
            raise HTTPException(
                status_code=400,
                detail="NIS sudah digunakan",
            )

    if role == "teacher":
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email wajib diisi untuk guru",
            )

        if "@" not in email:
            raise HTTPException(
                status_code=400,
                detail="Format email tidak valid",
            )

        existing_email = users_collection.find_one(
            {
                "email": email
            }
        )

        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email sudah digunakan",
            )

    now = get_utc_now()

    user = {
        "name": name,
        "role": role,
        "password_hash": password_hash.hash(
            password
        ),
        "created_at": now,
        "updated_at": now,
    }

    if role == "student":
        user["nis"] = nis
        user["class_name"] = class_name

    if role == "teacher":
        user["email"] = email

    try:
        result = users_collection.insert_one(user)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="Data akun sudah digunakan",
        )

    return {
        "message": "Akun berhasil dibuat",
        "user": {
            "id": str(result.inserted_id),
            "name": name,
            "role": role,
            "nis": nis,
            "email": email,
            "class_name": class_name,
        },
    }


# =========================================================
# ADMIN - UPDATE PASSWORD
# =========================================================

@app.put("/api/admin/users/{user_id}/password")
def admin_update_password(
    user_id: str,
    data: UpdateUserPasswordRequest,
    admin: dict = Depends(require_admin),
):
    object_id = get_object_id(user_id)

    if not object_id:
        raise HTTPException(
            status_code=400,
            detail="ID akun tidak valid",
        )

    password = validate_password(
        data.password
    )

    user = users_collection.find_one(
        {
            "_id": object_id
        }
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Akun tidak ditemukan",
        )

    # Admin tidak boleh mengubah password admin lain
    # melalui endpoint ini.
    if user.get("role") == "admin":
        raise HTTPException(
            status_code=403,
            detail="Password akun admin tidak dapat diubah melalui endpoint ini",
        )

    users_collection.update_one(
        {
            "_id": object_id
        },
        {
            "$set": {
                "password_hash": password_hash.hash(
                    password
                ),
                "updated_at": get_utc_now(),
            }
        },
    )

    return {
        "message": "Password berhasil diubah"
    }


# =========================================================
# ADMIN - DELETE USER
# =========================================================

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: str,
    admin: dict = Depends(require_admin),
):
    object_id = get_object_id(user_id)

    if not object_id:
        raise HTTPException(
            status_code=400,
            detail="ID akun tidak valid",
        )

    if user_id == admin.get("sub"):
        raise HTTPException(
            status_code=400,
            detail="Akun admin yang sedang digunakan tidak dapat dihapus",
        )

    user = users_collection.find_one(
        {
            "_id": object_id
        }
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Akun tidak ditemukan",
        )

    if user.get("role") == "admin":
        raise HTTPException(
            status_code=403,
            detail="Akun admin tidak dapat dihapus melalui panel",
        )

    users_collection.delete_one(
        {
            "_id": object_id
        }
    )

    # Bersihkan data sesi aktif milik user
    if user.get("role") == "teacher":
        attendance_sessions_collection.update_many(
            {
                "teacher_id": user_id,
                "active": True,
            },
            {
                "$set": {
                    "active": False
                }
            },
        )

    return {
        "message": "Akun berhasil dihapus",
        "user_id": user_id,
    }


# =========================================================
# TEACHER - CLASSES
# =========================================================

@app.get("/api/teacher/classes")
def get_teacher_classes(
    teacher: dict = Depends(require_teacher),
):
    return {
        "classes": VALID_CLASSES,
        "total": len(VALID_CLASSES),
    }


# =========================================================
# TEACHER - STUDENTS
# =========================================================

@app.get("/api/teacher/students")
def get_students(
    class_name: str,
    teacher: dict = Depends(require_teacher),
):
    class_name = validate_class_name(
        class_name
    )

    students = list(
        users_collection.find(
            {
                "role": "student",
                "class_name": class_name,
            },
            {
                "password_hash": 0
            },
        ).sort(
            "name",
            1,
        )
    )

    result = []

    for student in students:
        result.append(
            {
                "id": str(student["_id"]),
                "name": student.get(
                    "name",
                    "-",
                ),
                "nis": student.get(
                    "nis",
                    "-",
                ),
                "class_name": class_name,
            }
        )

    return {
        "class_name": class_name,
        "students": result,
        "total": len(result),
    }


# =========================================================
# STUDENT - ATTENDANCE HISTORY
# =========================================================

@app.get("/api/student/attendance/history")
def get_student_attendance_history(
    student: dict = Depends(require_student),
):
    records = list(
        attendance_collection.find(
            {
                "student_id": student["sub"]
            }
        ).sort(
            "timestamp",
            -1,
        )
    )

    history = []

    for record in records:
        timestamp = record.get("timestamp")

        if timestamp and timestamp.tzinfo is None:
            timestamp = timestamp.replace(
                tzinfo=timezone.utc
            )

        history.append(
            {
                "id": str(record["_id"]),
                "date": (
                    record.get("date")
                    or (
                        timestamp.astimezone(
                            LOCAL_TIMEZONE
                        ).strftime("%Y-%m-%d")
                        if timestamp
                        else "-"
                    )
                ),
                "time": (
                    record.get("time")
                    or (
                        timestamp.astimezone(
                            LOCAL_TIMEZONE
                        ).strftime("%H:%M")
                        if timestamp
                        else "-"
                    )
                ),
                "status": record.get(
                    "status",
                    "hadir",
                ),
                "class_name": record.get(
                    "class_name",
                    "-",
                ),
                "teacher_name": record.get(
                    "teacher_name",
                    "-",
                ),
            }
        )

    return {
        "history": history
    }


# =========================================================
# TEACHER - TODAY ATTENDANCE
# =========================================================

@app.get("/api/teacher/attendance/today")
def get_today_attendance(
    class_name: str,
    teacher: dict = Depends(require_teacher),
):
    class_name = validate_class_name(
        class_name
    )

    today = get_local_now().strftime(
        "%Y-%m-%d"
    )

    students = list(
        users_collection.find(
            {
                "role": "student",
                "class_name": class_name,
            },
            {
                "password_hash": 0
            },
        ).sort(
            "name",
            1,
        )
    )

    attendance_records = list(
        attendance_collection.find(
            {
                "date": today
            }
        )
    )

    attendance_map = {}

    for record in attendance_records:
        record_class = normalize_class_name(
            record.get(
                "class_name",
                "",
            )
        )

        if record_class != class_name:
            continue

        student_id = str(
            record.get("student_id", "")
        )

        if student_id:
            attendance_map[student_id] = record

    result = []

    for student in students:
        student_id = str(
            student["_id"]
        )

        attendance = attendance_map.get(
            student_id
        )

        result.append(
            {
                "student_id": student_id,
                "name": student.get(
                    "name",
                    "-",
                ),
                "nis": student.get(
                    "nis",
                    "-",
                ),
                "class_name": class_name,
                "status": (
                    attendance.get(
                        "status",
                        "belum_absen",
                    )
                    if attendance
                    else "belum_absen"
                ),
                "time": (
                    attendance.get("time")
                    if attendance
                    else None
                ),
            }
        )

    return {
        "date": today,
        "class_name": class_name,
        "students": result,
    }


# =========================================================
# ATTENDANCE RECAP
# =========================================================

@app.get("/api/attendance/recap")
def get_attendance_recap(
    date: str,
    class_name: str,
    current_user: dict = Depends(get_current_user),
):
    date = validate_date(date)

    requested_class = validate_class_name(
        class_name
    )

    role = current_user.get("role")

    # -----------------------------------------------------
    # STUDENT
    # -----------------------------------------------------

    if role == "student":
        student = current_user.get("user")

        student_class = normalize_class_name(
            student.get(
                "class_name",
                "",
            )
        )

        if student_class != requested_class:
            raise HTTPException(
                status_code=403,
                detail="Kamu hanya dapat melihat rekap kelas kamu",
            )

    elif role in {
        "teacher",
        "admin",
    }:
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Akses tidak diizinkan",
        )

    # -----------------------------------------------------
    # STUDENTS
    # -----------------------------------------------------

    all_students = list(
        users_collection.find(
            {
                "role": "student",
            },
            {
                "password_hash": 0,
            },
        ).sort(
            "name",
            1,
        )
    )

    students = []

    for student in all_students:
        student_class = normalize_class_name(
            student.get(
                "class_name",
                "",
            )
        )

        if student_class == requested_class:
            students.append(student)

    # -----------------------------------------------------
    # ATTENDANCE
    # -----------------------------------------------------

    all_records = list(
        attendance_collection.find(
            {
                "date": date,
            }
        )
    )

    attendance_map = {}

    for record in all_records:
        record_class = normalize_class_name(
            record.get(
                "class_name",
                "",
            )
        )

        if record_class != requested_class:
            continue

        student_id = str(
            record.get(
                "student_id",
                "",
            )
        )

        if student_id:
            attendance_map[student_id] = record

    # -----------------------------------------------------
    # BUILD RESULT
    # -----------------------------------------------------

    result = []

    for student in students:
        student_id = str(
            student["_id"]
        )

        attendance = attendance_map.get(
            student_id
        )

        if attendance:
            status = str(
                attendance.get(
                    "status",
                    "alpha",
                )
            ).lower()

            time = attendance.get(
                "time"
            )

        else:
            status = "belum_absen"
            time = None

        result.append(
            {
                "student_id": student_id,
                "name": student.get(
                    "name",
                    "-",
                ),
                "nis": student.get(
                    "nis",
                    "-",
                ),
                "class_name": requested_class,
                "date": date,
                "status": status,
                "time": time,
            }
        )

    return {
        "date": date,
        "class_name": requested_class,
        "students": result,
        "total": len(result),
    }


# =========================================================
# TEACHER - CREATE ATTENDANCE SESSION
# =========================================================

@app.post("/api/teacher/attendance/session")
def create_attendance_session(
    data: CreateAttendanceSessionRequest,
    teacher: dict = Depends(require_teacher),
):
    class_name = validate_class_name(
        data.class_name
    )

    # Nonaktifkan sesi lama pada kelas tersebut.
    attendance_sessions_collection.update_many(
        {
            "class_name": class_name,
            "active": True,
        },
        {
            "$set": {
                "active": False
            }
        },
    )

    session_code = secrets.token_urlsafe(
        24
    )

    now = get_utc_now()

    expires_at = now + timedelta(
        minutes=ATTENDANCE_SESSION_MINUTES
    )

    session = {
        "session_code": session_code,
        "class_name": class_name,
        "teacher_id": teacher["sub"],
        "teacher_name": teacher["name"],
        "created_at": now,
        "expires_at": expires_at,
        "active": True,
    }

    attendance_sessions_collection.insert_one(
        session
    )

    return {
        "message": "Sesi absensi berhasil dibuat",
        "session_code": session_code,
        "class_name": class_name,
        "expires_at": expires_at.isoformat(),
        "active": True,
    }


# =========================================================
# TEACHER - STOP ATTENDANCE SESSION
# =========================================================

@app.post(
    "/api/teacher/attendance/session/{session_code}/stop"
)
def stop_attendance_session(
    session_code: str,
    teacher: dict = Depends(require_teacher),
):
    session_code = session_code.strip()

    session = attendance_sessions_collection.find_one(
        {
            "session_code": session_code,
            "teacher_id": teacher["sub"],
        }
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Sesi tidak ditemukan",
        )

    attendance_sessions_collection.update_one(
        {
            "_id": session["_id"],
            "teacher_id": teacher["sub"],
        },
        {
            "$set": {
                "active": False
            }
        },
    )

    return {
        "message": "Sesi absensi diakhiri"
    }


# =========================================================
# STUDENT - SCAN ATTENDANCE
# =========================================================

@app.post("/api/student/attendance/scan")
def scan_attendance(
    data: ScanAttendanceRequest,
    student: dict = Depends(require_student),
):
    session_code = data.session_code.strip()

    if not session_code:
        raise HTTPException(
            status_code=400,
            detail="Kode sesi wajib diisi",
        )

    session = attendance_sessions_collection.find_one(
        {
            "session_code": session_code,
            "active": True,
        }
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="QR tidak valid atau sesi sudah berakhir",
        )

    now = get_utc_now()

    expires_at = session.get(
        "expires_at"
    )

    if not expires_at:
        raise HTTPException(
            status_code=500,
            detail="Data waktu sesi tidak valid",
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
            },
        )

        raise HTTPException(
            status_code=400,
            detail="QR sudah kedaluwarsa",
        )

    student_id = get_object_id(
        student["sub"]
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid",
        )

    student_data = users_collection.find_one(
        {
            "_id": student_id,
            "role": "student",
        }
    )

    if not student_data:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan",
        )

    student_class = normalize_class_name(
        student_data.get(
            "class_name",
            "",
        )
    )

    session_class = normalize_class_name(
        session.get(
            "class_name",
            "",
        )
    )

    if student_class != session_class:
        raise HTTPException(
            status_code=403,
            detail=(
                "QR ini bukan untuk kelas kamu"
            ),
        )

    # Cegah siswa absen dua kali pada tanggal yang sama.
    today = now.astimezone(
        LOCAL_TIMEZONE
    ).strftime("%Y-%m-%d")

    existing = attendance_collection.find_one(
        {
            "student_id": student["sub"],
            "date": today,
        }
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Kamu sudah melakukan absensi hari ini",
        )

    local_now = now.astimezone(
        LOCAL_TIMEZONE
    )

    current_time = local_now.strftime(
        "%H:%M:%S"
    )

    attendance = {
        "session_code": session_code,
        "student_id": student["sub"],
        "student_name": student_data.get(
            "name",
            "-",
        ),
        "nis": student_data.get("nis"),
        "class_name": student_class,
        "teacher_id": session["teacher_id"],
        "teacher_name": session["teacher_name"],
        "status": "hadir",
        "date": today,
        "time": current_time,
        "timestamp": now,
        "manual": False,
    }

    try:
        attendance_collection.insert_one(
            attendance
        )

    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="Kamu sudah melakukan absensi hari ini",
        )

    return {
        "message": "Absensi berhasil",
        "status": "hadir",
        "student_name": student_data.get(
            "name",
            "-",
        ),
        "class_name": student_class,
        "timestamp": local_now.isoformat(),
    }


# =========================================================
# STUDENT - CREATE PERMISSION
# =========================================================

@app.post("/api/student/permissions")
def create_permission(
    data: CreatePermissionRequest,
    student: dict = Depends(require_student),
):
    date = validate_date(data.date)

    reason = data.reason.strip()
    description = data.description.strip()

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Alasan izin wajib diisi",
        )

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Keterangan izin wajib diisi",
        )

    student_id = get_object_id(
        student["sub"]
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid",
        )

    student_data = users_collection.find_one(
        {
            "_id": student_id,
            "role": "student",
        }
    )

    if not student_data:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan",
        )

    class_name = normalize_class_name(
        student_data.get(
            "class_name",
            "",
        )
    )

    if class_name not in VALID_CLASSES:
        raise HTTPException(
            status_code=400,
            detail="Kelas siswa tidak valid",
        )

    existing = permissions_collection.find_one(
        {
            "student_id": student["sub"],
            "date": date,
            "status": "pending",
        }
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kamu masih memiliki pengajuan izin "
                "yang menunggu persetujuan untuk tanggal tersebut"
            ),
        )

    now = get_utc_now()

    permission = {
        "student_id": student["sub"],
        "student_name": student_data.get(
            "name",
            "-",
        ),
        "nis": student_data.get("nis"),
        "class_name": class_name,
        "date": date,
        "reason": reason,
        "description": description,
        "status": "pending",
        "teacher_reply": None,
        "teacher_id": None,
        "teacher_name": None,
        "created_at": now,
        "updated_at": now,
    }

    result = permissions_collection.insert_one(
        permission
    )

    return {
        "message": "Pengajuan izin berhasil dikirim",
        "id": str(result.inserted_id),
        "status": "pending",
    }


# =========================================================
# STUDENT - GET PERMISSIONS
# =========================================================

@app.get("/api/student/permissions")
def get_student_permissions(
    student: dict = Depends(require_student),
):
    records = list(
        permissions_collection.find(
            {
                "student_id": student["sub"]
            }
        ).sort(
            "created_at",
            -1,
        )
    )

    result = []

    for record in records:
        result.append(
            {
                "id": str(record["_id"]),
                "date": record.get(
                    "date",
                    "-",
                ),
                "reason": record.get(
                    "reason",
                    "-",
                ),
                "description": record.get(
                    "description",
                    "-",
                ),
                "status": record.get(
                    "status",
                    "pending",
                ),
                "teacher_reply": record.get(
                    "teacher_reply"
                ),
                "teacher_name": record.get(
                    "teacher_name"
                ),
                "created_at": serialize_datetime(
                    record.get("created_at")
                ),
                "updated_at": serialize_datetime(
                    record.get("updated_at")
                ),
            }
        )

    return {
        "permissions": result
    }


# =========================================================
# TEACHER - GET PERMISSIONS
# =========================================================

@app.get("/api/teacher/permissions")
def get_teacher_permissions(
    status: str | None = None,
    class_name: str | None = None,
    teacher: dict = Depends(require_teacher),
):
    query = {}

    if status:
        status = status.strip().lower()

        if status not in VALID_PERMISSION_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Status tidak valid",
            )

        query["status"] = status

    if class_name:
        normalized_class = validate_class_name(
            class_name
        )

        query["class_name"] = normalized_class

    records = list(
        permissions_collection.find(
            query
        ).sort(
            "created_at",
            -1,
        )
    )

    result = []

    for record in records:
        result.append(
            {
                "id": str(record["_id"]),
                "student_id": record.get(
                    "student_id"
                ),
                "student_name": record.get(
                    "student_name",
                    "-",
                ),
                "nis": record.get(
                    "nis",
                    "-",
                ),
                "class_name": normalize_class_name(
                    record.get(
                        "class_name",
                        "",
                    )
                ),
                "date": record.get(
                    "date",
                    "-",
                ),
                "reason": record.get(
                    "reason",
                    "-",
                ),
                "description": record.get(
                    "description",
                    "-",
                ),
                "status": record.get(
                    "status",
                    "pending",
                ),
                "teacher_reply": record.get(
                    "teacher_reply"
                ),
                "teacher_name": record.get(
                    "teacher_name"
                ),
                "created_at": serialize_datetime(
                    record.get("created_at")
                ),
                "updated_at": serialize_datetime(
                    record.get("updated_at")
                ),
            }
        )

    return {
        "permissions": result,
        "total": len(result),
    }


# =========================================================
# TEACHER - UPDATE PERMISSION
# =========================================================

@app.put(
    "/api/teacher/permissions/{permission_id}"
)
def update_permission(
    permission_id: str,
    data: UpdatePermissionRequest,
    teacher: dict = Depends(require_teacher),
):
    permission_object_id = get_object_id(
        permission_id
    )

    if not permission_object_id:
        raise HTTPException(
            status_code=400,
            detail="ID pengajuan izin tidak valid",
        )

    status = data.status.strip().lower()
    teacher_reply = data.teacher_reply.strip()

    if status not in {
        "approved",
        "rejected",
    }:
        raise HTTPException(
            status_code=400,
            detail="Status harus approved atau rejected",
        )

    if not teacher_reply:
        raise HTTPException(
            status_code=400,
            detail="Balasan guru wajib diisi",
        )

    permission = permissions_collection.find_one(
        {
            "_id": permission_object_id
        }
    )

    if not permission:
        raise HTTPException(
            status_code=404,
            detail="Pengajuan izin tidak ditemukan",
        )

    if permission.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail="Pengajuan izin ini sudah diproses",
        )

    now = get_utc_now()

    permissions_collection.update_one(
        {
            "_id": permission_object_id,
            "status": "pending",
        },
        {
            "$set": {
                "status": status,
                "teacher_reply": teacher_reply,
                "teacher_id": teacher["sub"],
                "teacher_name": teacher["name"],
                "updated_at": now,
            }
        },
    )

    # Jika izin disetujui, otomatis masukkan
    # status izin ke absensi.
    if status == "approved":
        student_id = permission.get(
            "student_id"
        )

        permission_date = permission.get(
            "date"
        )

        existing_attendance = attendance_collection.find_one(
            {
                "student_id": student_id,
                "date": permission_date,
            }
        )

        if not existing_attendance:
            attendance_collection.insert_one(
                {
                    "student_id": student_id,
                    "student_name": permission.get(
                        "student_name",
                        "-",
                    ),
                    "nis": permission.get(
                        "nis"
                    ),
                    "class_name": normalize_class_name(
                        permission.get(
                            "class_name",
                            "",
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
                    "timestamp": now,
                    "manual": True,
                }
            )

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
        "teacher_reply": teacher_reply,
    }


# =========================================================
# STUDENT - CHANGE PASSWORD
# =========================================================

@app.put("/api/student/password")
def student_change_password(
    data: ChangeStudentPasswordRequest,
    student: dict = Depends(require_student),
):
    current_password = data.current_password
    new_password = validate_password(
        data.new_password
    )

    if not current_password.strip():
        raise HTTPException(
            status_code=400,
            detail="Password lama wajib diisi",
        )

    if current_password == new_password:
        raise HTTPException(
            status_code=400,
            detail="Password baru harus berbeda dari password lama",
        )

    student_id = get_object_id(
        student["sub"]
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid",
        )

    user = users_collection.find_one(
        {
            "_id": student_id,
            "role": "student",
        }
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan",
        )

    if not verify_password(
        current_password,
        user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=401,
            detail="Password lama salah",
        )

    users_collection.update_one(
        {
            "_id": student_id,
            "role": "student",
        },
        {
            "$set": {
                "password_hash": password_hash.hash(
                    new_password
                ),
                "updated_at": get_utc_now(),
            }
        },
    )

    return {
        "message": "Password berhasil diubah"
    }


# =========================================================
# TEACHER - MANUAL ATTENDANCE
# =========================================================

@app.put("/api/teacher/attendance/manual")
def update_manual_attendance(
    data: ManualAttendanceRequest,
    teacher: dict = Depends(require_teacher),
):
    status = data.status.strip().lower()

    if status not in VALID_ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status absensi tidak valid",
        )

    date = validate_date(
        data.date
    )

    password = data.password

    if not password.strip():
        raise HTTPException(
            status_code=400,
            detail="Password wajib diisi",
        )

    teacher_id = get_object_id(
        teacher["sub"]
    )

    if not teacher_id:
        raise HTTPException(
            status_code=400,
            detail="ID guru tidak valid",
        )

    teacher_data = users_collection.find_one(
        {
            "_id": teacher_id,
            "role": "teacher",
        }
    )

    if not teacher_data:
        raise HTTPException(
            status_code=404,
            detail="Data guru tidak ditemukan",
        )

    if not verify_password(
        password,
        teacher_data.get(
            "password_hash",
            "",
        ),
    ):
        raise HTTPException(
            status_code=401,
            detail="Password akun guru salah",
        )

    # -----------------------------------------------------
    # STUDENT
    # -----------------------------------------------------

    student_id = get_object_id(
        data.student_id
    )

    if not student_id:
        raise HTTPException(
            status_code=400,
            detail="ID siswa tidak valid",
        )

    student = users_collection.find_one(
        {
            "_id": student_id,
            "role": "student",
        }
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Data siswa tidak ditemukan",
        )

    class_name = normalize_class_name(
        student.get(
            "class_name",
            "",
        )
    )

    if class_name not in VALID_CLASSES:
        raise HTTPException(
            status_code=400,
            detail="Kelas siswa tidak valid",
        )

    # -----------------------------------------------------
    # TIME
    # -----------------------------------------------------

    now = get_utc_now()

    local_now = now.astimezone(
        LOCAL_TIMEZONE
    )

    current_time = local_now.strftime(
        "%H:%M:%S"
    )

    # -----------------------------------------------------
    # EXISTING ATTENDANCE
    # -----------------------------------------------------

    existing = attendance_collection.find_one(
        {
            "student_id": data.student_id,
            "date": date,
        }
    )

    # -----------------------------------------------------
    # UPDATE
    # -----------------------------------------------------

    if existing:
        update_data = {
            "status": status,
            "teacher_id": teacher["sub"],
            "teacher_name": teacher["name"],
            "updated_at": now,
            "manual": True,
            "class_name": class_name,
        }

        if status == "hadir":
            update_data["time"] = current_time
        else:
            update_data["time"] = None

        attendance_collection.update_one(
            {
                "_id": existing["_id"],
            },
            {
                "$set": update_data,
            },
        )

        return {
            "message": "Status absensi berhasil diperbarui",
            "student_id": data.student_id,
            "student_name": student["name"],
            "date": date,
            "status": status,
        }

    # -----------------------------------------------------
    # CREATE
    # -----------------------------------------------------

    attendance = {
        "student_id": data.student_id,
        "student_name": student.get(
            "name",
            "-",
        ),
        "nis": student.get(
            "nis"
        ),
        "class_name": class_name,
        "teacher_id": teacher["sub"],
        "teacher_name": teacher["name"],
        "status": status,
        "date": date,
        "time": (
            current_time
            if status == "hadir"
            else None
        ),
        "manual": True,
        "timestamp": now,
        "updated_at": now,
    }

    try:
        attendance_collection.insert_one(
            attendance
        )

    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="Data absensi sudah ada",
        )

    return {
        "message": "Absensi manual berhasil disimpan",
        "student_id": data.student_id,
        "student_name": student["name"],
        "date": date,
        "status": status,
    }


# =========================================================
# STATUS
# =========================================================

@app.get("/api/status")
def status():
    return {
        "application": "Absensi Sekolah",
        "status": "running",
        "version": APP_VERSION,
        "classes": VALID_CLASSES,
        "total_classes": len(VALID_CLASSES),
        "features": [
            "login",
            "admin",
            "admin_dashboard",
            "admin_user_management",
            "qr_attendance",
            "attendance_history",
            "attendance_recap",
            "manual_attendance",
            "student_permission",
            "teacher_permission_approval",
            "teacher_reply",
            "student_change_password",
        ],
    }