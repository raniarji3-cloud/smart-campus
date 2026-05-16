// Replace with your actual Ngrok link when deployed
const baseURL = ""; 
const collegeLat = 17.3850;
const collegeLng = 78.4867;

const ALLOWED_RADIUS = 200;

let videoStream;
function calculateDistance(lat1, lon1, lat2, lon2) {

    const R = 6371e3;

    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;

    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a =
        Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}
async function verifyGeofence() {

    return new Promise((resolve, reject) => {

        navigator.geolocation.getCurrentPosition(

            position => {

                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;

                const distance = calculateDistance(
                    userLat,
                    userLon,
                    collegeLat,
                    collegeLng
                );

                console.log("Distance:", distance);

                if(distance <= ALLOWED_RADIUS){
                    resolve(true);
                }
                else{
                    resolve(false);
                }

            },

            error => {
                reject(error);
            }

        );

    });

}

// Initialize camera
async function initCamera() {
    const video = document.getElementById("video");
    if (!video) return alert("Video element not found");

    // Stop any previous streams
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = videoStream;
    } catch (err) {
        alert("Camera error: " + err.message);
        console.error(err);
    }
}

// Capture frame as base64
function getCapturedImage() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 300;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg");
}

// Register face
async function registerFace() {

    const image = getCapturedImage();

    const resultEl = document.getElementById("result");

    resultEl.innerText = "Registering face...";

    try {

        const response = await fetch("/register-face", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ image })
        });

        const data = await response.json();

        resultEl.innerText = data.message;

    } catch (err) {

        console.error(err);

        resultEl.innerText =
            "Face registration failed!";

    }

}

// Mark attendance
async function markAttendance() {

    const resultEl = document.getElementById("result");

    resultEl.innerText = "Checking location...";

    // CHECK LOCATION

    navigator.geolocation.getCurrentPosition(async (position) => {

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        console.log("User Location:", latitude, longitude);

        // YOUR COLLEGE LOCATION
        const collegeLat = 17.3850;
        const collegeLng = 78.4867;

        // DISTANCE CHECK
        const distance =
            Math.sqrt(
                Math.pow(latitude - collegeLat, 2) +
                Math.pow(longitude - collegeLng, 2)
            );

        // GEOFENCE LIMIT
        if (distance > 0.01) {

            resultEl.innerText =
                "❌ You are outside college campus";

            return;
        }

        resultEl.innerText =
            "✅ Location verified. Recognizing face...";

        // FACE RECOGNITION

        const image = getCapturedImage();

        try {

            const response = await fetch("/recognize-face", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ image })
            });

            const data = await response.json();

            resultEl.innerText = data.message;

        } catch (err) {

            console.log(err);

            resultEl.innerText =
                "❌ Face recognition failed";

        }

    },

    (error) => {

        console.log(error);

        resultEl.innerText =
            "❌ Please allow location access";

    });

}
// Load dashboard data
function loadDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) document.getElementById("welcome").innerText = "Welcome " + user.name;

    initCamera();

    // Fetch attendance
    fetch(baseURL + "/attendance/" + (user ? user.id : ""))
        .then(res => res.json())
        .then(data => {
            if (data.length > 0) {
                document.getElementById("attendance").innerText = data[0].percentage + "%";
            }
        });

    // Fetch announcements
    fetch(baseURL + "/announcements")
        .then(res => res.json())
        .then(data => {
            let output = "";
            data.forEach(a => {
                output += `<p><b>${a.title}</b>: ${a.message}</p>`;
            });
            document.getElementById("announcements").innerHTML = output;
        });
}