from sqlmodel import SQLModel, create_engine
import os
from dotenv import load_dotenv

# 1. Models ko import karna zaroori hai taaki table bane
from models import Task  

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def create_db_and_tables():
    print("⏳ Creating tables in Supabase...")
    SQLModel.metadata.create_all(engine)
    print("✅ Tables Created Successfully!")

if __name__ == "__main__":
    try:
        create_db_and_tables()
    except Exception as e:
        print(f"❌ Error: {e}")