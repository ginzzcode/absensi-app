import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pwdlib import PasswordHash

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "absensi_sekolah")

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

db = client[DATABASE_NAME]
users = db["users"]

password_hash = PasswordHash.recommended()


demo_users = [
    {
        "name": "Guru Demo",
        "email": "guru@absensi.test",
        "password_hash": password_hash.hash("guru123"),
        "role": "teacher"
    },
    {
        "name": "Budi Siswa",
        "nis": "12345678",
        "password_hash": password_hash.hash("siswa123"),
        "role": "student",
        "class_name": "IX-A"
    }
]


for user in demo_users:

    if user["role"] == "teacher":
        exists = users.find_one({
            "email": user["email"]
        })
    else:
        exists = users.find_one({
            "nis": user["nis"]
        })

    if exists:
        print(f"User {user['name']} sudah ada.")
    else:
        users.insert_one(user)
        print(f"User {user['name']} berhasil dibuat.")


print("Seed selesai.")