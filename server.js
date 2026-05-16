const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");

const app = express();

console.log("THIS SERVER FILE IS RUNNING");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(session({
  secret: "smartcampus_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60
  }
}));

app.set("view engine", "ejs");
app.use(express.static("public"));

// ================= MYSQL DATABASE =================

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "smart_campus"
});

db.query("SELECT 1", (err, result) => {
  if (err) {
    console.log("MYSQL ERROR:", err);
  } else {
    console.log("MYSQL WORKING");
  }
});
// ================= BASIC ROUTES =================

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

// ================= REGISTER =================
app.post('/register', async (req, res) => {

    console.log("🔥 REGISTER HIT");

    const { name, student_id, password, role } = req.body;

    if (!name || !student_id || !password || !role) {
        return res.send("Missing data");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = "INSERT INTO users (name, student_id, password, role) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, student_id, hashedPassword, role], (err, result) => {

        if (err) {
            console.log("DB ERROR:", err);
            return res.send(err.sqlMessage);
        }

        res.send("Registered successfully");
    });
});
// ================= LOGIN =================

app.post("/login", (req, res) => {

  const { student_id, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE student_id = ?",
    [student_id],
    async (err, results) => {

      if (err) {
        console.log(err);
        return res.send("Database Error");
      }

      if (results.length === 0) {
        return res.send("Invalid student ID or password");
      }

      const user = results[0];

      const match = await bcrypt.compare(password, user.password);


      if (!match) {
        return res.send("Invalid student ID or password");
      }

      req.session.user = user;

      if (user.role === "student") {
        return res.redirect("/student");
      }

      if (user.role === "faculty") {
        return res.redirect("/faculty");
      }

      res.redirect("/");
    }
  );
});
// ================= LOGOUT =================

app.get("/logout", (req, res) => {

  req.session.destroy(() => {
    res.redirect("/");
  });

});

// ================= MIDDLEWARE =================

function isStudent(req, res, next) {

  if (req.session.user && req.session.user.role === "student") {
    next();
  } else {
    res.redirect("/");
  }
}

function isFaculty(req, res, next) {

  if (req.session.user && req.session.user.role === "faculty") {
    next();
  } else {
    res.redirect("/");
  }
}

// ================= STUDENT DASHBOARD =================

app.get("/student", isStudent, (req, res) => {

  const studentId = req.session.user.student_id;

  db.query(
    "SELECT * FROM announcements ORDER BY created_at DESC",
    (err, announcements) => {

      if (err) {
        console.log(err);
        return res.send("Error loading announcements");
      }

      db.query(
        "SELECT * FROM attendance WHERE student_id = ?",
        [studentId],
        (err, attendance) => {

          if (err) {
            console.log(err);
            return res.send("Error loading attendance");
          }

          let total = attendance.length;

          let presentCount = attendance.filter(
            a => a.status === "Present"
          ).length;

          let percentage = total > 0
            ? ((presentCount / total) * 100).toFixed(2)
            : 0;

          res.render("student", {
            user: req.session.user,
            announcements,
            attendance,
            total,
            presentCount,
            percentage
          });

        }
      );
    }
  );
});

// ================= FACULTY DASHBOARD =================

app.get("/faculty", isFaculty, (req, res) => {

  db.query(
    "SELECT * FROM announcements ORDER BY created_at DESC",
    (err, announcements) => {

      if (err) {
        console.log(err);
        return res.send("Error loading faculty page");
      }

      res.render("faculty", {
        user: req.session.user,
        announcements
      });

    }
  );
});

// ================= ADD ANNOUNCEMENT =================

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

      res.redirect("/faculty");

    }
  );
});

// ================= MANUAL ATTENDANCE =================

app.post("/mark-attendance", isFaculty, (req, res) => {

  const { student_id, date, status } = req.body;

  db.query(
    "INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)",
    [student_id, date, status],
    (err) => {

      if (err) {
        console.log(err);
        return res.send("Attendance already marked");
      }

      res.redirect("/faculty");

    }
  );
});

// ================= FACE RECOGNITION =================
app.post("/recognize-face", async (req, res) => {

  try {

    const { image } = req.body;

    const response = await axios.post(
      "http://127.0.0.1:5001/recognize_face",
      { image }
    );

    const data = response.data;

    if (data.status === "Match Found") {

      const studentId = data.student_id;
      if (req.session.user.id != studentId) {
        return res.json({
          success: false,
          message: "Face does not match logged-in user"
        });
      }

      db.query(
        "SELECT student_id FROM users WHERE id = ?",
        [studentId],
        (err, results) => {

          if (err || results.length === 0) {

            return res.json({
              success: false,
              message: "User not found"
            });

          }

          const studentIdValue = results[0].student_id;

          const today = new Date()
            .toISOString()
            .split("T")[0];

          db.query(
            "INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)",
            [studentIdValue, today, "Present"],
            (err) => {

              if (err) {

                return res.json({
                  success: false,
                  message: "Attendance already marked"
                });

              }

              return res.json({
                success: true,
                message: "Attendance Marked Successfully"
              });

            }
          );
        }
      );

    } else {

      return res.json({
        success: false,
        message: data.status
      });

    }

  } catch (err) {

    console.log(err);

    res.json({
      success: false,
      message: "Face recognition server error"
    });

  }
});

// ================= REGISTER FACE =================

app.post("/register-face", async (req, res) => {

  try {

    const user = req.session.user;

    const { image } = req.body;

    const response = await axios.post(
      "http://127.0.0.1:5001/register_face",
      {
        image:image,
        student_id: user.id
      }
    );

    res.json(response.data);

  } catch (err) {

    console.log(err);

    res.json({
      success: false,
      message: "Face registration failed"
    });
  }
});

// ================= SERVER =================

const PORT = 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
