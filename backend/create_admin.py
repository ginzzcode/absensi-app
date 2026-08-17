import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pwdlib import PasswordHash


load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv(
    "DATABASE_NAME",
    "absensi_sekolah"
)

if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI belum diatur di .env"
    )


client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

db = client[DATABASE_NAME]
users_collection = db["users"]

password_hash = PasswordHash.recommended()

email = "ginzz@absensi.app"
password = "ginzzadmin17"

existing_admin = users_collection.find_one({
    "email": email
})

if existing_admin:
    print("Akun admin sudah ada.")
    print("Email:", email)
else:
    hashed_password = password_hash.hash(
        password
    )

    result = users_collection.insert_one({
        "name": "Ginzz Admin",
        "email": email,
        "role": "admin",
        "password_hash": hashed_password
    })

    print("Akun admin berhasil dibuat.")
    print("ID:", result.inserted_id)
    print("Email:", email)

client.close()