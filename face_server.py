from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import base64
import numpy as np
import cv2

app = Flask(__name__)
CORS(app)

# In-memory storage for simplicity
known_faces = {}

def decode_image(image_data):
    # Decode base64 image
    image_bytes = base64.b64decode(image_data.split(",")[1])
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

@app.route("/register_face", methods=["POST"])
def register_face():
    data = request.json
    student_id = str(data.get("student_id"))
    image = data.get("image")

    if not student_id or not image:
        return jsonify({"message": "Missing student_id or image"}), 400

    rgb_frame = decode_image(image)
    encodings = face_recognition.face_encodings(rgb_frame)

    if len(encodings) == 0:
        return jsonify({"message": "No face detected"}), 400

    known_faces[student_id] = encodings[0]
    print("Registered Student:", student_id)
    print("Total Known Faces:", len(known_faces))
    return jsonify({"message": "Face registered successfully"})

@app.route("/recognize_face", methods=["POST"])
def recognize_face():
    data = request.json
    image = data.get("image")

    if not image:
        return jsonify({"status": "No image provided"}), 400

    rgb_frame = decode_image(image)
    encodings = face_recognition.face_encodings(rgb_frame)

    if len(encodings) == 0:
        return jsonify({"status": "No Face Found"}), 400

    unknown_encoding = encodings[0]
    best_match_id = None
    lowest_distance = 1.0

    for student_id, stored_encoding in known_faces.items():
        distance = face_recognition.face_distance([stored_encoding], unknown_encoding)[0]
        if distance < lowest_distance:
            lowest_distance = distance
            best_match_id = student_id

    if best_match_id and lowest_distance < 0.45:
        return jsonify({"status": "Match Found", "student_id": int(best_match_id)})

    return jsonify({"status": "No Match Found"})

@app.route("/")
def home():
    return "Face Server Running 🚀"

if __name__ == "__main__":
    app.run(port=5000)