from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date

# Table 1: Daily Tasks (Jo abhi chal raha hai)
class Task(SQLModel, table=True):
    __tablename__ = "missions"
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    is_done: bool = Field(default=False)
    is_mandatory: bool = Field(default=False)
    created_at: date = Field(default_factory=date.today)

# Table 2: Habits (Naya Grid System)
class Habit(SQLModel, table=True):
    __tablename__ = "habits"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    # Hum days ko comma se jodkar save karenge (e.g., "1,5,12,28")
    completed_days: str = Field(default="")