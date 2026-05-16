from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import base64
import numpy as np
import cv2

app = Flask(__name__)
CORS(app)

# In-memory storage (for testing only)
known_faces = {}

# -----------------------------
# SAFE IMAGE DECODER
# -----------------------------
def decode_image(image_data):
    try:
        if not image_data or "," not in image_data:
            print("❌ Invalid image format")
            return None

        image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)

        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            print("❌ cv2 failed to decode image")
            return None

        return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    except Exception as e:
        print("❌ Decode error:", str(e))
        return None


# -----------------------------
# REGISTER FACE
# -----------------------------
@app.route("/register_face", methods=["POST"])
def register_face():

    try:
        data = request.json

        student_id = str(data.get("student_id"))
        image = data.get("image")

        print("\n🔥 Register request received for ID:", student_id)

        rgb_frame = decode_image(image)
        cv2.imwrite("debug_face.jpg", cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR))

        if rgb_frame is None:
            return jsonify({
                "success": False,
                "message": "Image decode failed"
            }), 400

        # Detect face locations first
        face_locations = face_recognition.face_locations(rgb_frame)

        print("📍 Face locations:", face_locations)

        if len(face_locations) == 0:
            return jsonify({
                "success": False,
                "message": "No face detected. Move closer to camera."
            }), 400

        # Generate encodings
        encodings = face_recognition.face_encodings(
            rgb_frame,
            face_locations
        )

        print("👀 Faces detected:", len(encodings))

        encoding = encodings[0]

        known_faces[student_id] = encoding

        print("✅ Registered Student:", student_id)

        return jsonify({
            "success": True,
            "message": "Face registered successfully"
        })

    except Exception as e:

        print("❌ Register error:", str(e))

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500
# -----------------------------
# RECOGNIZE FACE
# -----------------------------
@app.route("/recognize_face", methods=["POST"])
def recognize_face():

    try:
        data = request.json

        if not data:
            return jsonify({"status": "error", "message": "No data received"})

        image_data = data.get("image")

        rgb_image = decode_image(image_data)

        if rgb_image is None:
            return jsonify({"status": "error", "message": "Image decode failed"})

        encodings = face_recognition.face_encodings(rgb_image)

        print("👀 Recognition faces found:", len(encodings))

        if len(encodings) == 0:
            return jsonify({"status": "No Face Found"})

        unknown_encoding = encodings[0]

        best_match_id = None
        lowest_distance = 1.0

        # Compare with stored faces
        for student_id, stored_encoding in known_faces.items():

            distance = face_recognition.face_distance(
                [stored_encoding],
                unknown_encoding
            )[0]

            print(f"🔍 Checking {student_id} → Distance: {distance}")

            if distance < lowest_distance:
                lowest_distance = distance
                best_match_id = student_id

        # Threshold tuning
        if lowest_distance < 0.45:
            print("🎯 MATCH FOUND:", best_match_id)

            return jsonify({
                "status": "Match Found",
                "student_id": int(best_match_id)
            })

        return jsonify({"status": "No Match Found"})

    except Exception as e:
        print("❌ Recognition error:", str(e))
        return jsonify({"status": "error", "message": str(e)})


# -----------------------------
# HOME
# -----------------------------
@app.route("/")
def home():
    return "Smart Campus Face Recognition Backend Running 🚀"


# -----------------------------
# START SERVER
# -----------------------------
if __name__ == "__main__":
    print("🚀 Face Recognition Server Starting on port 5001...")
    app.run(host="127.0.0.1", port=5001, debug=True)