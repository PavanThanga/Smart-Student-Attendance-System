#  Smart Student Attendance System 

An intelligent attendance system that uses **Face Recognition (FaceNet)** to automatically mark student attendance in real-time. Designed for classrooms to eliminate manual attendance and improve accuracy.
---
##  Features

*  Face Recognition using **FaceNet (facenet-pytorch)**
*  Automatic attendance marking
*  Timetable-based period detection
*  Teacher dashboard
*  Attendance reports
*  Student management (Add / Update / Delete)
*  Holiday / Day disable system
*  FastAPI backend with real-time processing

---

##  Tech Stack

**Frontend**
* HTML, CSS, JavaScript

**Backend**
* FastAPI
* Uvicorn

**Database**
* MongoDB (PyMongo)

**AI / ML**
* FaceNet (facenet-pytorch)
* MTCNN (Face Detection)
* NumPy, OpenCV, Pillow

---

##  Project Structure

```
Smart-Student-Attendance-System/
│
├── backend/
│   ├── app.py
│   ├── database.py
│
├── index.html
├── styles.css
├── script.js
├── requirements.txt
└── README.md
```
##  Setup Instructions

### 1️⃣ Clone Repository
```
git clone https://github.com/PavanThanga/Smart-Student-Attendance-System.git
cd Smart-Student-Attendance-System
```
### 2️⃣ Create Virtual Environment
```
python -m venv venv
venv\Scripts\activate
```
### 3️⃣ Install Dependencies
```
pip install -r requirements.txt
```
### 4️⃣ Start MongoDB
Make sure MongoDB is running:
```
mongod
```
### 5️⃣ Run Backend Server
```
cd backend
uvicorn app:app --reload
```
### 6️⃣ Run Frontend
Open `index.html` in your browser
( use Live Server)
---

##  How It Works

1. Capture image from webcam
2. Detect face using **MTCNN**
3. Generate embedding using **FaceNet**
4. Compare with stored embeddings
5. If match found → mark attendance

Thank You!!
