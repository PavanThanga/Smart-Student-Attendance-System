from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["attendance_system"]

students_collection = db["students"]
def save_student(
    name, roll, student_class, embedding,
    phone=None, dob=None,
    parent=None, parent_phone=None,address=None
):
    students_collection.insert_one({
        "name": name,
        "roll": roll,
        "class": student_class,
        "phone": phone,
        "dob": dob,
        "parent": parent,
        "Parent_Phone":parent_phone,
        "address": address,
        "embedding": embedding.tolist()
    })
def get_all_students():
    students=list(students_collection.find({},{"_id":0}))
    return students

#Attendance Collection
attendance_collection = db["attendance"]
from datetime import datetime

def mark_attendance(student,periodNo,subject,startTime,endTime):
    today = datetime.now().strftime("%Y-%m-%d")

    # 👉 check duplicate
    existing = attendance_collection.find_one({
        "roll": student["roll"],
        "date": today,
        "periodNo":periodNo
    })

    if existing:
        return {"status": "already_marked"}
    
    status = get_attendance_status(startTime,endTime)

    if status == "Too Early":
        return {"status": "too_early"}
    if status is None:
        return {"status": "missed"}  

    # 👉 save attendance
    attendance_collection.insert_one({
        "name": student["name"],
        "roll": student["roll"],
        "class": student["class"],
        "date": today,
        "time": datetime.now().strftime("%H:%M:%S"),
        "status": status,
        "periodNo":periodNo,
        "subject":subject
    })

    return {"status": "marked","attendance_status":status}

def get_attendance_status(start_time,end_time):
    now = datetime.now()

    # convert "HH:MM" → datetime today
    st = datetime.strptime(start_time, "%H:%M").replace(
        year=now.year, month=now.month, day=now.day
    )
    et = datetime.strptime(end_time, "%H:%M").replace(
        year=now.year, month=now.month, day=now.day
    )

    diff = (now - st).total_seconds() / 60  # minutes

    if now < st:
        return "Too Early"
    if diff <= 10:
        return "Present"
    if st < now <= et:
        return "Late"
    return None
#Holiday
settings_collection = db["settings"]

def set_today_status(is_active: bool):
    today = datetime.now().strftime("%Y-%m-%d")

    data = {
        "active": is_active
    }

    # 🔥 store enable time
    if is_active:
        data["enabled_at"] = datetime.now().strftime("%H:%M")

    settings_collection.update_one(
        {"date": today},
        {"$set": data},
        upsert=True
    )

    return {"success": True}


def is_today_active():
    today = datetime.now().strftime("%Y-%m-%d")

    rec = settings_collection.find_one({"date": today})

    # default = active
    if not rec:
        return True

    return rec.get("active", True)
#TimeTable
timetable_collection = db["timetable"]

def get_timetable():
    return list(timetable_collection.find({}, {"_id": 0}))

def save_full_timetable(data):
    timetable_collection.delete_many({})  # clear old data

    if data:
        timetable_collection.insert_many(data)

    return {"success": True}