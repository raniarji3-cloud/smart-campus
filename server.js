const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");
console.log("THIS SERVER FILE IS RUNNING");
const axios = require("axios");
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(session({
  secret: "smartcampus_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // keep false for localhost
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));
app.get("/test-route", (req, res) => {
  res.send("Route Working");
});

// Root → Login page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.set("view engine", "ejs");
app.use(express.static("public"));

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to Railway MySQL");
});

// Register
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, role],
      (err) => {
        if (err) {
          return res.send("Email already exists");
        }
        res.send("Registered Successfully");
      }
    );
  } catch (error) {
    res.send("Error hashing password");
  }
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.send("Database error");
      }

      if (results.length === 0) {
        return res.send("Invalid email or password");
      }

      const user = results[0];

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.send("Invalid email or password");
      }

      // Save session
      req.session.user = user;

      // 🔥 Redirect based on role
      if (user.role === "student") {
        res.redirect("/student");
      } else if (user.role === "faculty") {
        res.redirect("/faculty");
      } else {
        res.redirect("/");
      }
    }
  );
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
    const logout = () => {
      localStorage.removeItem("user");  // clear old user
        window.location.href = "/login";
      };

  });
});

function isStudent(req, res, next) {
  if (req.session.user && req.session.user.role === "student") {
    next();
  } else {
    res.redirect("/");
  }
}
app.get("/student", isStudent, (req, res) => {

  const email = req.session.user.email;

  db.query("SELECT * FROM announcements ORDER BY created_at DESC", (err, announcements) => {
    if (err) return res.send("Error loading announcements");

    db.query("SELECT * FROM attendance WHERE student_email = ?", [email], (err, attendance) => {
      if (err) return res.send("Error loading attendance");

      let total = attendance.length;
      let presentCount = attendance.filter(a => a.status === "Present").length;
      let percentage = total > 0 ? ((presentCount / total) * 100).toFixed(2) : 0;

      res.render("student", {
        user: req.session.user,
        announcements,
        attendance,
        total,
        presentCount,
        percentage
      });
    });
  });
});
function isFaculty(req, res, next) {
    if (req.session.user && req.session.user.role === "faculty") {
        next();
      } else {
        res.redirect("/");
      }
    }
app.get("/faculty", isFaculty, (req, res) => {
    db.query("SELECT * FROM announcements ORDER BY created_at DESC", (err, announcements) => {
      if (err) return res.send("Error loading page");
      res.render("faculty", {
        user: req.session.user,
        announcements
    });
  });
});
app.post("/add-announcement", isFaculty, (req, res) => {

  const { title, message } = req.body;

  db.query(
    "INSERT INTO announcements (title, message) VALUES (?, ?)",
    [title, message],
    (err) => {
      if (err) {
        console.log(err);
        return res.send("Error adding announcement");
      }

      res.send(`
        <script>
          alert("Announcement added successfully!");
          window.location.href = "/faculty";
        </script>
      `);
    }
  );
});
app.post("/mark-attendance", isFaculty, (req, res) => {

  const { student_email, date, status } = req.body;

  db.query(
    "INSERT INTO attendance (student_email, date, status) VALUES (?, ?, ?)",
    [student_email, date, status],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.send(`
            <script>
              alert("Attendance already marked for this student on this date!");
              window.location.href = "/faculty";
            </script>
          `);
        }

        console.log(err);
        return res.send("Error marking attendance");
      }

      res.send(`
        <script>
          alert("Attendance marked successfully!");
          window.location.href = "/faculty";
        </script>
      `);
    }
  );
});
app.get("/student-attendance", isStudent, (req, res) => {

  const email = req.session.user.email;

  db.query(
    "SELECT * FROM attendance WHERE student_email = ?",
    [email],
    (err, results) => {
      if (err) {
        console.log(err);
        return res.send("Error fetching attendance");
      }

      let html = "<h2>Your Attendance</h2>";

      results.forEach(row => {
        html += `<p>${row.date} - ${row.status}</p>`;
      });

      html += `<br><a href="/student">Back</a>`;

      res.send(html);
    }
  );
});

app.post("/student-mark-attendance", (req, res) => {

  const { student_email } = req.body;

  const today = new Date().toISOString().split("T")[0];

  db.query(
    "INSERT INTO attendance (student_email, date, status) VALUES (?, ?, 'Present')",
    [student_email, today],
    (err) => {

      if (err) {

        if (err.code === "ER_DUP_ENTRY") {
          return res.json({ message: "Already marked today" });
        }

        console.log(err);
        return res.status(500).json({ message: "Database Error" });
      }

      res.json({ message: "Attendance Marked Successfully" });
    }
  );
});

app.post("/delete-announcement/:id", isFaculty, (req, res) => {

  const id = req.params.id;

  db.query("DELETE FROM announcements WHERE id = ?", [id], (err) => {
    if (err) {
      console.log(err);
      return res.send("Error deleting announcement");
    }
    console.log("Deleted ID:", id);
    res.redirect("/faculty"); // go back to faculty page
  });
});


// POST /recognize-face
app.post("/recognize-face", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    // Call Flask face recognition server
    const response = await axios.post("http://localhost:5000/recognize_face", { image });

    const data = response.data;

    if (data.status === "Match Found") {
      const studentId = data.student_id;

      // Fetch student email from your users table
      db.query("SELECT email FROM users WHERE id = ?", [studentId], (err, results) => {
        if (err) {
          console.error("DB Error:", err);
          return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
          return res.status(404).json({ success: false, message: "User not found" });
        }

        const studentEmail = results[0].email;
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Insert attendance, prevent duplicates
        db.query(
          "INSERT INTO attendance (student_email, date, status) VALUES (?, ?, 'Present')",
          [studentEmail, today],
          (err) => {
            if (err) {
              if (err.code === "ER_DUP_ENTRY") {
                return res.json({
                  success: false,
                  message: "Attendance already marked for today",
                });
              }
              console.error("Insert Error:", err);
              return res.status(500).json({ success: false, message: "Error marking attendance" });
            }

            return res.json({
              success: true,
              message: `Attendance marked successfully for ${studentEmail}`,
              student_id: studentId
            });
          }
        );
      });
    } else {
      return res.json({ success: false, message: data.status });
    }
  } catch (error) {
    console.error("Server Error:", error.message);
    return res.status(500).json({ success: false, message: "Face recognition server error" });
  }
});


// POST /register-face
app.post("/register-face", async (req, res) => {
  try {
    // Get logged-in student info from session
    const user = req.session.user;

    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    // Send face image to Flask face server
    const response = await axios.post("http://localhost:5000/register_face", {
      image: image,
      student_id: user.id
    });

    if (response.data.message) {
      return res.json({
        success: true,
        message: response.data.message
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Unexpected response from face server"
      });
    }
  } catch (error) {
    console.error("Face registration error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Face registration failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});