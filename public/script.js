// Replace with your actual Ngrok link when deployed
const baseURL = ""; 

let videoStream;

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
    const user = JSON.parse(localStorage.getItem("user"));
    const resultEl = document.getElementById("result");

    if (!user || !user.id) {
        alert("User not logged in");
        return;
    }

    resultEl.innerText = "Registering face...";
    try {
        const response = await fetch(baseURL + "/register-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image })
        });
        const data = await response.json();
        resultEl.innerText = data.message;
    } catch (err) {
        console.error(err);
        resultEl.innerText = "Face registration failed!";
    }
}

// Mark attendance
async function markAttendance() {
    const image = getCapturedImage();
    const resultEl = document.getElementById("result");

    resultEl.innerText = "Recognizing face...";
    try {
        const response = await fetch(baseURL + "/recognize-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image })
        });
        const data = await response.json();
        resultEl.innerText = data.message;
    } catch (err) {
        console.error(err);
        resultEl.innerText = "Face recognition failed!";
    }
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