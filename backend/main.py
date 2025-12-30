from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta
from typing import List, Optional

# --- DATABASE SETUP ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./kronix.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MODELS ---
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, index=True)
    is_done = Column(Boolean, default=False)
    is_mandatory = Column(Boolean, default=False)
    created_at = Column(String, default=date.today().isoformat())

class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    completed_days = Column(String, default="") # "1,2,5"

# NEW: SLEEP TABLE
class SleepLog(Base):
    __tablename__ = "sleep_logs"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True) # Har din ka ek hi record hoga
    hours = Column(Integer)

Base.metadata.create_all(bind=engine)

# --- APP SETUP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---
class TaskCreate(BaseModel):
    content: str
    is_done: bool = False
    is_mandatory: bool = False

class HabitCreate(BaseModel):
    name: str

class SleepRequest(BaseModel):
    hours: int

# --- API ENDPOINTS (TASKS) ---
@app.get("/tasks")
def read_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return {"tasks": tasks}

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    db_task.is_done = task.is_done
    db.commit()
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"message": "Deleted"}

# --- API ENDPOINTS (HABITS) ---
@app.get("/habits")
def get_habits(db: Session = Depends(get_db)):
    return db.query(Habit).all()

@app.post("/habits")
def create_habit(habit: HabitCreate, db: Session = Depends(get_db)):
    new_habit = Habit(name=habit.name)
    db.add(new_habit)
    db.commit()
    return new_habit

@app.put("/habits/{habit_id}/toggle/{day}")
def toggle_habit(habit_id: int, day: str, db: Session = Depends(get_db)):
    habit = db.query(Habit).filter(Habit.id == habit_id).first()
    days = habit.completed_days.split(',') if habit.completed_days else []
    
    if day in days: days.remove(day)
    else: days.append(day)
    
    habit.completed_days = ",".join(days)
    db.commit()
    return habit

@app.delete("/habits/{habit_id}")
def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    habit = db.query(Habit).filter(Habit.id == habit_id).first()
    db.delete(habit)
    db.commit()
    return {"msg": "Deleted"}

# --- API ENDPOINTS (SLEEP / RECOVERY) ---
@app.get("/sleep")
def get_sleep_data(db: Session = Depends(get_db)):
    # Calculate last 7 days range
    today = date.today()
    start_date = today - timedelta(days=6)
    
    # Fetch logs from DB
    logs = db.query(SleepLog).filter(SleepLog.date >= start_date).all()
    
    result = []
    # Loop last 7 days to ensure graph always has 7 points
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        log = next((l for l in logs if l.date == current_date), None)
        
        result.append({
            "day": current_date.strftime("%a"), # Mon, Tue, etc.
            "full_date": current_date.strftime("%Y-%m-%d"),
            "hours": log.hours if log else 0
        })
    return result

@app.post("/sleep")
def log_sleep(req: SleepRequest, db: Session = Depends(get_db)):
    today = date.today()
    existing_log = db.query(SleepLog).filter(SleepLog.date == today).first()
    
    if existing_log:
        existing_log.hours = req.hours # Update agar aaj already enter kiya tha
    else:
        new_log = SleepLog(date=today, hours=req.hours) # Naya entry
        db.add(new_log)
    
    db.commit()
    return {"message": "Sleep logged"}