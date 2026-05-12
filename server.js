const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));
app.use(express.static(path.join(__dirname, "public")));

// ── HTTP + Socket.io ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new Server(server, {
  cors: { origin: "*" }, // adjust in production
});

// FIX: Register each user into their own room so targeted emits work
wss.on("connection", (socket) => {
  socket.on("register", (username) => {
    socket.join(username);
    console.log(`Socket registered for user: ${username}`);
  });

  socket.on("message", (message) => {
    socket.broadcast.emit("message", message);
  });
});

// ── File upload ───────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

// ── MySQL connection with auto-retry ─────────────────────────────────────────
// FIX: 'connection' declared at module level so all routes can access it
let connection;

function connectWithRetry() {
  connection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect((err) => {
    if (err) {
      console.error("MySQL connection failed:", err.message);
      console.log("Retrying in 5 seconds...");
      connection = null;
      setTimeout(connectWithRetry, 5000);
      return;
    }
    console.log("MySQL connected!");
  });

  connection.on("error", (err) => {
    console.error("MySQL error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      connectWithRetry();
    }
  });
}

connectWithRetry();

// ── Helper: promisify DB queries for cleaner async/await usage ────────────────
function query(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// ── Catch-all for Angular (must be LAST) ─────────────────────────────────────
// Moved to bottom of file — otherwise it intercepts all API routes

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════════

// SIGNUP
app.post("/signup", async (req, res) => {
  const user = req.body;
  const allowedDomains = ["@charlotte.edu", "@uncc.edu"];

  if (!allowedDomains.some((d) => user.email.endsWith(d))) {
    return res.status(400).json({ message: "Email address not allowed" });
  }

  try {
    const existing = await query(
      "SELECT 1 FROM users WHERE username = ? OR email = ?",
      [user.userName, user.email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const encodedPassword = Buffer.from(user.password).toString("base64");
    await query(
      "INSERT INTO users (firstname, lastname, username, email, password, privacy) VALUES (?, ?, ?, ?, ?, 0)",
      [user.firstname, user.lastname, user.userName, user.email, encodedPassword]
    );

    res.status(200).json({ message: "User signed up successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Error during signup" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Please enter both email and password" });
  }

  try {
    const results = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (results.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    const storedPassword = Buffer.from(results[0].password, "base64").toString("utf-8");
    if (storedPassword !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    res.status(200).json({ message: "Login successful", username: results[0].username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// FORGOT PASSWORD
app.post("/forgotPassword", async (req, res) => {
  const { email, username, newPassword } = req.body;

  try {
    const results = await query(
      "SELECT 1 FROM users WHERE email = ? AND username = ?",
      [email, username]
    );
    if (results.length !== 1) {
      return res.status(400).json({ error: "Invalid email or username" });
    }

    const encodedNewPassword = Buffer.from(newPassword).toString("base64");
    await query(
      "UPDATE users SET password = ? WHERE email = ? AND username = ?",
      [encodedNewPassword, email, username]
    );

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ACCOUNT
// ═══════════════════════════════════════════════════════════════════════════════

// GET user data
app.get("/account/userdata", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(401).json({ message: "User not authenticated" });

  try {
    const results = await query(
      "SELECT firstname, lastname, email, username FROM users WHERE username = ?",
      [username]
    );
    if (results.length === 0) return res.status(404).json({ message: "User not found" });
    res.status(200).json(results[0]);
  } catch (err) {
    console.error("Fetch user data error:", err);
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// UPDATE user data
app.put("/account/updatedata", async (req, res) => {
  const { username, firstname, lastname, email } = req.body;
  const validEmail = /^(.+)@(charlotte\.edu|uncc\.edu)$/i;

  if (!validEmail.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    await query(
      "UPDATE users SET firstname = ?, lastname = ?, email = ? WHERE username = ?",
      [firstname, lastname, email, username]
    );
    res.status(200).json({ message: "Personal info updated successfully" });
  } catch (err) {
    console.error("Update user data error:", err);
    res.status(500).json({ message: "Error updating personal info" });
  }
});

// CHANGE PASSWORD
app.put("/account/changepassword", async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const results = await query(
      "UPDATE users SET password = ? WHERE username = ?",
      [newPassword, username]
    );
    if (results.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Error changing user password" });
  }
});

// FETCH PRIVACY
app.get("/account/fetchprivacy/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query("SELECT privacy FROM users WHERE username = ?", [username]);
    if (results.length === 0) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ privacy: results[0].privacy });
  } catch (err) {
    console.error("Fetch privacy error:", err);
    res.status(500).json({ message: "Error fetching privacy status" });
  }
});

// UPDATE PRIVACY
app.post("/account/updateprivacy/:username", async (req, res) => {
  const { username } = req.params;
  const { privacy } = req.body;

  try {
    const results = await query(
      "UPDATE users SET privacy = ? WHERE username = ?",
      [privacy, username]
    );
    if (results.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Privacy status updated successfully" });
  } catch (err) {
    console.error("Update privacy error:", err);
    res.status(500).json({ message: "Error updating privacy status" });
  }
});

// DELETE USER
app.delete("/account/userdelete/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await query("DELETE FROM users WHERE username = ?", [username]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });

    // Clean up all references to the deleted user
    await Promise.all([
      query("UPDATE users SET friends = TRIM(BOTH ',' FROM REPLACE(friends, ?, '')) WHERE 1", [username]),
      query("UPDATE users SET request = TRIM(BOTH ',' FROM REPLACE(request, ?, '')) WHERE 1", [username]),
      query("DELETE FROM events WHERE username = ?", [username]),
      query("DELETE FROM meetings WHERE username = ?", [username]),
    ]);

    res.status(204).end();
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

// GET reminders
app.get("/get-reminders", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: "Username not provided" });

  const currentDate = new Date().toISOString().split("T")[0];

  try {
    const results = await query(
      "SELECT * FROM meetings WHERE (date = ? AND username = ?) OR (date = ? AND FIND_IN_SET(?, invitees) > 0)",
      [currentDate, username, currentDate, username]
    );
    res.status(200).json(results);
  } catch (err) {
    console.error("Reminders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET calendar meetings
app.get("/calendar/meetings", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const results = await query(
      "SELECT * FROM meetings WHERE username = ? OR invitees LIKE ? ORDER BY date DESC",
      [username, `%${username}%`]
    );
    res.status(200).json(results);
  } catch (err) {
    console.error("Calendar meetings error:", err);
    res.status(500).json({ message: "Error fetching meetings" });
  }
});

// GET calendar events
app.get("/calendar/events", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const results = await query("SELECT * FROM events WHERE username = ?", [username]);
    res.status(200).json(results);
  } catch (err) {
    console.error("Calendar events error:", err);
    res.status(500).json({ message: "Error fetching events" });
  }
});

// ADD meeting
app.post("/calendar", async (req, res) => {
  const m = req.body;
  if (!m.meetingName || !m.startTime || !m.endTime || !m.meetingMode || !m.date || !m.username) {
    return res.status(400).json({ error: "Please fill in all fields." });
  }

  try {
    const dupe = await query(
      "SELECT 1 FROM meetings WHERE date = ? AND start_time = ? AND username = ?",
      [m.date, m.startTime, m.username]
    );
    if (dupe.length > 0) return res.status(200).json({ message: "Duplicate meeting found" });

    await query(
      "INSERT INTO meetings (meeting_name, start_time, end_time, meeting_mode, date, username, invitees) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [m.meetingName, m.startTime, m.endTime, m.meetingMode, m.date, m.username, m.invitees]
    );
    res.status(200).json({ message: "Meeting added successfully" });
  } catch (err) {
    console.error("Add meeting error:", err);
    res.status(500).json({ error: "Error inserting meeting" });
  }
});

// UPDATE meeting
app.put("/calendar/:sno", async (req, res) => {
  const { sno } = req.params;
  const { username } = req.query;
  const m = req.body;

  if (!m.meeting_name || !m.date || !m.start_time || !m.end_time || !m.meeting_mode) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }

  try {
    const dupe = await query(
      "SELECT 1 FROM meetings WHERE date = ? AND start_time = ? AND sno != ? AND username = ?",
      [m.date, m.start_time, sno, username]
    );
    if (dupe.length > 0) return res.status(200).json({ message: "Duplicate meeting found" });

    await query(
      "UPDATE meetings SET meeting_name=?, date=?, start_time=?, end_time=?, meeting_mode=? WHERE sno=? AND username=?",
      [m.meeting_name, m.date, m.start_time, m.end_time, m.meeting_mode, sno, username]
    );
    res.status(200).json({ message: "Meeting updated successfully" });
  } catch (err) {
    console.error("Update meeting error:", err);
    res.status(500).json({ message: "Error updating meeting" });
  }
});

// DELETE meeting
app.delete("/calendar/:sno", async (req, res) => {
  const { sno } = req.params;
  const { username } = req.query;

  if (!sno || !username) {
    return res.status(400).json({ message: "Select a meeting and provide a username to delete" });
  }

  try {
    const check = await query("SELECT 1 FROM meetings WHERE sno = ? AND username = ?", [sno, username]);
    if (check.length === 0) return res.status(404).json({ message: "Meeting not found" });

    await query("DELETE FROM meetings WHERE sno = ? AND username = ?", [sno, username]);
    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (err) {
    console.error("Delete meeting error:", err);
    res.status(500).json({ message: "Error deleting meeting" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENTS / CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

// GET account events
app.get("/account/events", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const results = await query("SELECT * FROM events WHERE username = ?", [username]);
    res.status(200).json(results);
  } catch (err) {
    console.error("Account events error:", err);
    res.status(500).json({ message: "Error fetching events" });
  }
});

// GET account meetings
app.get("/account/meetings", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const results = await query(
      "SELECT * FROM meetings WHERE username = ? OR invitees LIKE ? ORDER BY date DESC",
      [username, `%${username}%`]
    );
    res.status(200).json(results);
  } catch (err) {
    console.error("Account meetings error:", err);
    res.status(500).json({ message: "Error fetching meetings" });
  }
});

// GET course codes
app.get("/account/codes", async (req, res) => {
  const { prefix } = req.query;
  if (!prefix) return res.status(400).json({ message: "Course prefix is required" });

  try {
    const results = await query(
      "SELECT DISTINCT code FROM courses_list WHERE prefix = ? ORDER BY code ASC",
      [prefix]
    );
    res.status(200).json(results.map((r) => r.code));
  } catch (err) {
    console.error("Course codes error:", err);
    res.status(500).json({ message: "Error fetching course codes" });
  }
});

// ADD class/event
app.post("/account", async (req, res) => {
  const e = req.body;
  if (!e.coursePrefix || !e.courseCode || !e.section || !e.startTime || !e.endTime || !e.courseMode || !e.daysOfWeek || !e.username) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }

  try {
    const courseResults = await query(
      "SELECT name FROM courses_list WHERE prefix = ? AND code = ?",
      [e.coursePrefix, e.courseCode]
    );
    if (courseResults.length === 0) return res.status(404).json({ message: "Course not found" });

    const courseName = courseResults[0].name;

    await query(
      "INSERT INTO events (course_prefix, course_code, section, start_time, end_time, course_mode, days_of_week, course_name, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [e.coursePrefix, e.courseCode, e.section, e.startTime, e.endTime, e.courseMode, e.daysOfWeek, courseName, e.username]
    );

    // Update or create group
    const groupResults = await query(
      "SELECT * FROM `groups` WHERE course_name = ? AND section = ?",
      [courseName, e.section]
    );

    if (groupResults.length > 0) {
      const updated = groupResults[0].participants
        ? `${groupResults[0].participants},${e.username}`
        : e.username;
      await query(
        "UPDATE `groups` SET participants = ? WHERE course_name = ? AND section = ?",
        [updated, courseName, e.section]
      );
    } else {
      const eventsResults = await query(
        "SELECT username FROM events WHERE course_name = ? AND section = ?",
        [courseName, e.section]
      );
      if (eventsResults.length > 0) {
        const participants = [...eventsResults.map((r) => r.username), e.username].join(",");
        await query(
          "INSERT INTO `groups` (course_name, section, participants) VALUES (?, ?, ?)",
          [courseName, e.section, participants]
        );
      }
    }

    res.status(201).json(e);
  } catch (err) {
    console.error("Add class error:", err);
    res.status(500).json({ message: "Error adding event" });
  }
});

// UPDATE class
app.put("/account/:sno", async (req, res) => {
  const { sno } = req.params;
  const e = req.body;

  if (!sno || !e) return res.status(400).json({ message: "Invalid request" });

  try {
    await query(
      "UPDATE events SET start_time = ?, end_time = ?, course_mode = ?, days_of_week = ? WHERE sno = ?",
      [e.start_time, e.end_time, e.course_mode, e.days_of_week, sno]
    );
    res.status(200).json({ message: "Event updated successfully" });
  } catch (err) {
    console.error("Update class error:", err);
    res.status(500).json({ message: "Error updating event" });
  }
});

// DELETE class
app.delete("/account/:sno", async (req, res) => {
  const { sno } = req.params;
  const { username } = req.query;

  if (!sno) return res.status(400).json({ message: "Please select an event to delete." });
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const results = await query(
      "DELETE FROM events WHERE sno = ? AND username = ?",
      [sno, username]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found for the provided username and sno." });
    }
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Delete class error:", err);
    res.status(500).json({ message: "Error deleting event" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FRIENDS
// ═══════════════════════════════════════════════════════════════════════════════

// GET groups
app.get("/groups/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query(
      "SELECT * FROM `groups` WHERE participants LIKE ?",
      [`%${username}%`]
    );
    res.json(results);
  } catch (err) {
    console.error("Groups error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET primary friends
app.get("/friends/primary/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query("SELECT friends FROM users WHERE username = ?", [username]);
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ friends: results[0].friends });
  } catch (err) {
    console.error("Primary friends error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET friend user data
app.get("/friends/users/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query(
      "SELECT username, firstname, lastname, email FROM users WHERE username = ?",
      [username]
    );
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  } catch (err) {
    console.error("Friend user data error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET friend requests
app.get("/friends/request/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query("SELECT request FROM users WHERE username = ?", [username]);
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ request: results[0].request });
  } catch (err) {
    console.error("Friend requests error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET friend suggestions
app.get("/friends/suggestions/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query(
      "SELECT username FROM users WHERE username LIKE ?",
      [`%${username}%`]
    );
    res.json({ suggestions: results.map((r) => r.username) });
  } catch (err) {
    console.error("Friend suggestions error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ADD friend (send request)
app.post("/friends/add", async (req, res) => {
  const { username, friendUsername } = req.body;
  if (!friendUsername || friendUsername.trim() === "") {
    return res.status(400).json({ error: "Friend username is required" });
  }

  try {
    const [sessionUser] = await query("SELECT friends FROM users WHERE username = ?", [username]);
    if (!sessionUser) return res.status(404).json({ success: false, message: "Session user not found" });

    if (sessionUser.friends && sessionUser.friends.split(",").includes(friendUsername)) {
      return res.json({ success: false, message: "User is already a friend" });
    }

    const [friendUser] = await query("SELECT request FROM users WHERE username = ?", [friendUsername]);
    if (!friendUser) return res.json({ success: false, message: "Friend not found" });

    if (friendUser.request && friendUser.request.split(",").includes(username)) {
      return res.json({ success: false, message: "Friend request already sent" });
    }

    const newRequests = friendUser.request ? `${friendUser.request},${username}` : username;
    await query("UPDATE users SET request = ? WHERE username = ?", [newRequests, friendUsername]);
    res.json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("Add friend error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ACCEPT friend request
app.post("/friends/accept", async (req, res) => {
  const { username, friendUsername } = req.body;

  try {
    const [sessionUser] = await query(
      "SELECT request, friends FROM users WHERE username = ?",
      [username]
    );
    if (!sessionUser) return res.status(404).json({ error: "Session user data not found" });

    // Remove request entry
    await query(
      "UPDATE users SET request = TRIM(BOTH ',' FROM REPLACE(request, ?, '')) WHERE username = ?",
      [friendUsername, username]
    );

    // Add to friends list (both sides)
    const myFriends = sessionUser.friends ? `${sessionUser.friends},${friendUsername}` : friendUsername;
    await query("UPDATE users SET friends = ? WHERE username = ?", [myFriends, username]);

    const [friendUser] = await query(
      "SELECT request, friends FROM users WHERE username = ?",
      [friendUsername]
    );
    if (friendUser) {
      await query(
        "UPDATE users SET request = TRIM(BOTH ',' FROM REPLACE(request, ?, '')) WHERE username = ?",
        [username, friendUsername]
      );
      const theirFriends = friendUser.friends ? `${friendUser.friends},${username}` : username;
      await query("UPDATE users SET friends = ? WHERE username = ?", [theirFriends, friendUsername]);
    }

    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("Accept friend error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE friend request
app.post("/friends/delete", async (req, res) => {
  const { username, friendUsername } = req.body;

  try {
    await Promise.all([
      query(
        "UPDATE users SET request = TRIM(TRAILING ',' FROM REPLACE(request, ?, '')) WHERE username = ?",
        [username, friendUsername]
      ),
      query(
        "UPDATE users SET request = TRIM(TRAILING ',' FROM REPLACE(request, ?, '')) WHERE username = ?",
        [friendUsername, username]
      ),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete friend request error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// UNFRIEND
app.post("/friends/unfriend", async (req, res) => {
  const { username, friendUsername } = req.body;

  try {
    await Promise.all([
      query(
        "UPDATE users SET friends = TRIM(BOTH ',' FROM REPLACE(friends, ?, '')) WHERE username = ?",
        [friendUsername, username]
      ),
      query(
        "UPDATE users SET friends = TRIM(BOTH ',' FROM REPLACE(friends, ?, '')) WHERE username = ?",
        [username, friendUsername]
      ),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Unfriend error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET friend privacy
app.get("/users/privacy/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const results = await query("SELECT privacy FROM users WHERE username = ?", [username]);
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ privacy: results[0].privacy });
  } catch (err) {
    console.error("Friend privacy error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET friend schedule
app.get("/users/schedule/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const [events, meetings] = await Promise.all([
      query("SELECT * FROM events WHERE username = ?", [username]),
      query("SELECT * FROM meetings WHERE username = ?", [username]),
    ]);
    res.json({ events, meetings });
  } catch (err) {
    console.error("Friend schedule error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

// Upload files
app.post("/upload", upload.array("files"), (req, res) => {
  const uploadedFiles = req.files.map((file) => file.filename);
  res.json({ files: uploadedFiles });
});

// POST direct message
app.post("/messages", async (req, res) => {
  const { sender, receiver, message, files } = req.body;
  const timestamp = new Date();

  try {
    await query(
      "INSERT INTO messages (sender, receiver, message, files, timestamp) VALUES (?, ?, ?, ?, ?)",
      [sender, receiver, message, files ? JSON.stringify(files) : null, timestamp]
    );

    // FIX: use socket.io room emit to target receiver only
    wss.to(receiver).emit("message", { sender, receiver, message, files, timestamp });
    res.json({ sender, receiver, message, files, timestamp });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET direct messages
app.get("/messages/:username/:friend", async (req, res) => {
  const { username, friend } = req.params;

  try {
    const results = await query(
      "SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY timestamp",
      [username, friend, friend, username]
    );
    res.json(results);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST group message
app.post("/group-messages", async (req, res) => {
  const { sender, group, message, files } = req.body;
  const timestamp = new Date();

  try {
    await query(
      "INSERT INTO group_messages (sender, group_name, message, files, timestamp) VALUES (?, ?, ?, ?, ?)",
      [sender, group, message, files ? JSON.stringify(files) : null, timestamp]
    );

    // FIX: emit to group room
    wss.to(group).emit("group-message", { sender, group, message, files, timestamp });
    res.json({ sender, group, message, files, timestamp });
  } catch (err) {
    console.error("Send group message error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET group messages
app.get("/group-messages/:group", async (req, res) => {
  const { group } = req.params;

  try {
    const results = await query(
      "SELECT * FROM group_messages WHERE group_name = ? ORDER BY timestamp",
      [group]
    );
    res.json(results);
  } catch (err) {
    console.error("Fetch group messages error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// POST friend request notification
app.post("/notifications", async (req, res) => {
  const notification = req.body;
  notification.content = `Friend request - ${notification.sender} sent you a friend request`;

  try {
    await query("INSERT INTO notifications SET ?, timestamp = NOW()", notification);
    // FIX: emit only to the target user's room
    wss.to(notification.receiver).emit("notification", notification);
    res.status(200).json({ success: true, message: "Notification saved" });
  } catch (err) {
    console.error("Notification error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST user-to-user notification
app.post("/notifications/:username/:friendUsername", async (req, res) => {
  const { username } = req.params;
  const notification = req.body;

  try {
    await query("INSERT INTO notifications SET ?, timestamp = NOW()", notification);
    // FIX: emit to the specific user's room
    wss.to(username).emit("notification", notification);
    res.status(200).json({ success: true, message: "Notification saved" });
  } catch (err) {
    console.error("User notification error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST meeting notifications (multi-receiver)
app.post("/notifications/meeting", async (req, res) => {
  const notification = req.body;
  const receivers = notification.receiver.split(",").map((r) => r.trim());

  try {
    await Promise.all(
      receivers.map((receiver) =>
        query("INSERT INTO notifications SET ?, timestamp = NOW()", {
          ...notification,
          receiver,
        })
      )
    );

    // FIX: emit to each receiver's room individually
    receivers.forEach((receiver) => {
      wss.to(receiver).emit("notification", { ...notification, receiver });
    });

    res.status(200).json({ success: true, message: "Meeting notifications saved" });
  } catch (err) {
    console.error("Meeting notification error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET notifications
app.get("/notifications/:username", async (req, res) => {
  const { username } = req.params;

  try {
    // FIX: filter done in SQL — no need to re-filter in JS
    const results = await query(
      "SELECT * FROM notifications WHERE receiver = ? ORDER BY timestamp DESC",
      [username]
    );
    res.status(200).json({ success: true, notifications: results });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE all notifications for user
app.delete("/notifications/clear/:username", async (req, res) => {
  const { username } = req.params;

  try {
    await query("DELETE FROM notifications WHERE receiver = ?", [username]);
    res.status(200).json({ success: true, message: "Notifications cleared successfully" });
  } catch (err) {
    console.error("Clear notifications error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE single notification
app.delete("/notifications/:username/:sno", async (req, res) => {
  const { username, sno } = req.params;

  try {
    await query("DELETE FROM notifications WHERE receiver = ? AND sno = ?", [username, sno]);
    res.status(200).json({ success: true, message: "Notification closed successfully" });
  } catch (err) {
    console.error("Delete notification error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ── Angular catch-all (MUST be last) ─────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ── Start server ──────────────────────────────────────────────────────────────
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
