from fastapi import FastAPI, File, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image
import io
from database import save_student,get_all_students,mark_attendance,attendance_collection,get_timetable, save_full_timetable,students_collection,set_today_status,is_today_active,settings_collection
from facenet_pytorch import MTCNN, InceptionResnetV1

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all (for dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Face detection model
mtcnn = MTCNN(image_size=160, margin=10)

# FaceNet model (embedding generator)
resnet = InceptionResnetV1(pretrained='vggface2').eval()

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    
    return {
        "filename": file.filename,
        "size": len(contents),
        "message": "Image received ✅"
    }

def get_embedding(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Detect face
    face = mtcnn(img)

    if face is None:
        return None

    # Add batch dimension
    face = face.unsqueeze(0)

    # Generate embedding
    embedding = resnet(face).detach().numpy()[0]

    return embedding

@app.post("/test-embedding")
async def test_embedding(file: UploadFile = File(...)):
    contents = await file.read()

    embedding = get_embedding(contents)

    if embedding is None:
        return {"success": False, "message": "No face detected"}

    return {
        "success": True,
        "embedding_length": len(embedding)
    }

def compare_faces(emb1, emb2):
    return np.linalg.norm(emb1 - emb2)

from datetime import datetime

def get_current_period():
    now = datetime.now()
    current_time = now.strftime("%H:%M")

    day = now.strftime("%A")  # Monday, Tuesday...

    timetable = get_timetable()  # from DB

    for t in timetable:
        if t["day"] == day:
            if t["startTime"] <= current_time <= t["endTime"]:
                return t

    return None

known_faces = []

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    if not is_today_active():
        return {"success": False,"reason":"disabled_day", "message": "Attendance disabled for today"}
    today = datetime.now().strftime("%A")
    if today == "Sunday":
        return {
            "success": False,
            "reason": "holiday",
            "message": "No classes today"
        }
    contents = await file.read()

    new_embedding = get_embedding(contents)

    if new_embedding is None:
        return {"success": False, "message": "No face detected"}

    students = get_all_students()  # from DB

    best_match = None
    min_dist=999

    for stu in students:
        stored_embedding = np.array(stu["embedding"])

        distance = np.linalg.norm(new_embedding - stored_embedding)

        if distance < min_dist:
            min_dist = distance
            best_match = stu

    # 🔥 Threshold (IMPORTANT)
    if min_dist > 0.7:
        return {"success": False, "message": "Face not recognized"}
    cp = get_current_period()

    if not cp:
        return {"success": False, "message": "No active period"}
    
    attendance_result=mark_attendance(best_match,cp["periodNo"],cp["subject"],cp["startTime"],cp["endTime"])
    return {
            "success": True,
            "name": best_match["name"],
            "roll": best_match["roll"],
            "status":attendance_result["status"],
            "attendance_status":attendance_result.get("attendance_status"),
            "period":f"P{cp['periodNo']} - {cp['subject']}"
        }


#Database connection
from database import save_student

@app.post("/register")
async def register_student(
    name: str = Form(...),
    roll: str = Form(...),
    student_class: str = Form(...),
    phone: str = Form(None),
    dob: str = Form(None),
    parent: str = Form(None),
    parent_phone:str=Form(None),
    address: str = Form(None),
    file: UploadFile = File(...)
):
    contents = await file.read()

    embedding = get_embedding(contents)

    if embedding is None:
        return {"success": False, "message": "No face detected"}

    save_student(name, roll, student_class, embedding,phone,dob,parent,parent_phone,address)

    return {"success": True, "message": "Student registered ✅"}

#Dashboard
@app.get("/students")
def get_students():
    students = get_all_students()
    return {
        "success": True,
        "students": students
    }
@app.get("/attendance")
def get_attendance():
    data = list(attendance_collection.find({}, {"_id": 0}))
    return {
        "success": True,
        "attendance": data
    }
@app.put("/update_student")
async def update_student(data: dict):

    students_collection.update_one(
        {"roll": data["roll"]},
        {"$set": {
            "class": data["class"],
            "phone": data.get("phone"),
            "dob": data.get("dob"),
            "parent": data.get("parent"),
            "Parent_Phone":data.get("Parent_Phone"),
            "address": data.get("address")
        }}
    )

    return {"success": True}
@app.delete("/delete_student/{roll}")
def delete_student(roll: str):

    # 🔥 delete student
    students_collection.delete_one({"roll": roll})

    # 🔥 delete ALL attendance
    attendance_collection.delete_many({"roll": roll})

    return {"success": True}
#Holiday
@app.post("/toggle-day")
def toggle_day(data: dict = Body(...)):
    return set_today_status(data.get("active", True))


@app.get("/day-status")
def get_day_status():
    return {"active": is_today_active()}
@app.get("/day-settings")
def get_day_settings():
    data = list(settings_collection.find({}, {"_id": 0}))
    return {
        "success": True,
        "days": data
    }
#Timetable
@app.get("/timetable")
def fetch_timetable():
    return {
        "success": True,
        "timetable": get_timetable()
    }
@app.post("/timetable")
def save_timetable(data: list = Body(...)):
    return save_full_timetable(data)