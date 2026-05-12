const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io"); // ✅ use socket.io, not ws
const multer = require("multer");
const path = require("path"); // ✅ only declared once

const app = express();
const port = process.env.PORT || 3000;

// ✅ Middleware first
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));

// ✅ Serve Angular build
app.use(express.static(path.join(__dirname, "public")));

// WebSocket handling
const server = http.createServer(app);
const wss = new Server(server); // ✅ socket.io

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    socket.broadcast.emit("message", message);
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueFileName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueFileName);
  },
});

const upload = multer({ storage: storage });

// ✅ NEW — expose connection at module level
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
      console.error("Error connecting to MySQL:", err.message);
      console.log("Retrying in 5 seconds...");
      connection = null;
      setTimeout(connectWithRetry, 5000);
    } else {
      console.log("MySQL connected!");
    }
  });

  connection.on("error", (err) => {
    console.error("MySQL connection error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      connectWithRetry(); // auto-reconnect on dropped connection
    }
  });
}

connectWithRetry();

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

//---------------------------------------------------MAIN CODE-----------------------------------------------------------//

//----------------------------SIGNUP-------------------------------//
app.post("/signup", (req, res) => {
  const user = req.body;

  const allowedDomains = ["@charlotte.edu", "@uncc.edu"];
  let isAllowedDomain = false;

  for (const domain of allowedDomains) {
    if (user.email.endsWith(domain)) {
      isAllowedDomain = true;
      break;
    }
  }

  if (!isAllowedDomain) {
    return res.status(400).json({ message: "Email address not allowed" });
  }

  const checkUserQuery = "SELECT * FROM users WHERE username = ? OR email = ?";
  const checkUserValues = [user.userName, user.email];

  connection.query(
    checkUserQuery,
    checkUserValues,
    (checkUserErr, checkUserResults) => {
      if (checkUserErr) {
        console.error("Error checking user:", checkUserErr);
        return res.status(500).json({ message: "Error checking user" });
      }

      if (checkUserResults.length > 0) {
        return res
          .status(400)
          .json({ message: "Username or email already exists" });
      }

      // Encode password in base64
      const encodedPassword = Buffer.from(user.password).toString("base64");

      const sql =
        "INSERT INTO users (firstname, lastname, username, email, password, privacy) VALUES (?, ?, ?, ?, ?, 0)";
      const values = [
        user.firstname,
        user.lastname,
        user.userName,
        user.email,
        encodedPassword,
      ];

      connection.query(sql, values, (signupErr, signupResults) => {
        if (signupErr) {
          console.error("Error signing up:", signupErr);
          return res.status(500).json({ message: "Error signing up" });
        }

        console.log("User signed up successfully");
        return res.status(200).json({ message: "User signed up successfully" });
      });
    },
  );
});

//---------------------------LOGIN-----------------------------//
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please enter both email and password" });
  }

  const sqlEmail = "SELECT * FROM users WHERE email = ?";
  const valuesEmail = [email];

  connection.query(sqlEmail, valuesEmail, (err, resultsEmail) => {
    if (err) {
      console.error("Error during email check:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (resultsEmail.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Decode the base64-encoded password from the database
    const storedPassword = Buffer.from(
      resultsEmail[0].password,
      "base64",
    ).toString("utf-8");

    // Compare the decoded password with the provided password
    if (storedPassword !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const username = resultsEmail[0].username;

    res.status(200).json({
      message: "Login successful",
      username: username,
    });
  });
});

//--------------------------FORGOT PASSWORD-----------------------------//
app.post("/forgotPassword", (req, res) => {
  const { email, username, newPassword } = req.body;

  const verifyQuery = "SELECT * FROM users WHERE email = ? AND username = ?";

  connection.query(verifyQuery, [email, username], (verifyErr, results) => {
    if (verifyErr) {
      console.error(verifyErr);
      res.status(500).json({ error: "Database error" });
    } else {
      if (results.length === 1) {
        // Encode the new password in base64
        const encodedNewPassword = Buffer.from(newPassword).toString("base64");

        const updateQuery =
          "UPDATE users SET password = ? WHERE email = ? AND username = ?";
        connection.query(
          updateQuery,
          [encodedNewPassword, email, username],
          (updateErr, updateResult) => {
            if (updateErr) {
              console.error(updateErr);
              res.status(500).json({ error: "Password update error" });
            } else {
              res.status(200).json({ message: "Password reset successfully" });
            }
          },
        );
      } else {
        res.status(400).json({ error: "Invalid email or username" });
      }
    }
  });
});

//------------------------------------------ ACCOUNT SECTION------------------------------------------//

//-----------------USERDATA DISPLAY--------------------//
app.get("/account/userdata", (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  const query =
    "SELECT firstname, lastname, email, username FROM users WHERE username = ?";
  connection.query(query, [username], (err, results) => {
    if (err) {
      console.error("Error fetching user data:", err);
      return res.status(500).json({ message: "Error fetching user data" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = results[0];
    res.status(200).json(userData);
  });
});

//----------------------------UPDATE USER DATA----------------------------//
app.put("/account/updatedata", (req, res) => {
  const username = req.body.username;
  const userData = req.body;

  const validEmailFormats = /^(.+)@(charlotte\.edu|uncc\.edu)$/i;

  if (!validEmailFormats.test(userData.email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const query =
    "UPDATE users SET firstname = ?, lastname = ?, email = ? WHERE username = ?";

  connection.query(
    query,
    [userData.firstname, userData.lastname, userData.email, username],
    (err, results) => {
      if (err) {
        console.error("Error updating personal info:", err);
        res.status(500).json({ message: "Error updating personal info" });
      } else {
        res.status(200).json({ message: "Personal info updated successfully" });
      }
    },
  );
});

//---------------------------CHANGE USER PASSWORD------------------------//
app.put("/account/changepassword", (req, res) => {
  const { username, newPassword } = req.body;
  const updateQuery = "UPDATE users SET password = ? WHERE username = ?";
  connection.query(updateQuery, [newPassword, username], (err, results) => {
    if (err) {
      console.error("Error changing user password:", err);
      return res.status(500).json({ message: "Error changing user password" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Password changed successfully" });
  });
});

//-----------------------------FETCH PRIVACY STATUS-------------------------------//
app.get("/account/fetchprivacy/:username", (req, res) => {
  const username = req.params.username;

  const query = "SELECT privacy FROM users WHERE username = ?";
  connection.query(query, [username], (err, results) => {
    if (err) {
      console.error("Error fetching user privacy status:", err);
      return res
        .status(500)
        .json({ message: "Error fetching user privacy status" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found in the database" });
    }

    const privacyStatus = results[0].privacy;
    res.status(200).json({ privacy: privacyStatus });
  });
});

//----------------------------------UPDATE USER PRIVACY STATUS--------------------------------//
app.post("/account/updateprivacy/:username", (req, res) => {
  const username = req.params.username;
  const newPrivacy = req.body.privacy;

  const updateQuery = "UPDATE users SET privacy = ? WHERE username = ?";
  connection.query(updateQuery, [newPrivacy, username], (err, results) => {
    if (err) {
      console.error("Error updating user privacy status:", err);
      return res
        .status(500)
        .json({ message: "Error updating user privacy status" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Privacy status updated successfully" });
  });
});

//----------------------------------USER DELETE----------------------------------//
app.delete("/account/userdelete/:username", (req, res) => {
  const username = req.params.username;

  const deleteQueryUsers = "DELETE FROM users WHERE username = ?";
  connection.query(deleteQueryUsers, [username], (errUsers, resultsUsers) => {
    if (errUsers) {
      console.error("Error deleting user from users table:", errUsers);
      return res.status(500).json({ message: "Error deleting user" });
    }

    if (resultsUsers.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateFriendsQuery =
      "UPDATE users SET friends = REPLACE(friends, ?, '')";
    connection.query(updateFriendsQuery, [username], (errUpdateFriends) => {
      if (errUpdateFriends) {
        console.error("Error updating friends column:", errUpdateFriends);
        return res
          .status(500)
          .json({ message: "Error updating friends column" });
      }

      const updateRequestQuery =
        "UPDATE users SET request = REPLACE(request, ?, '')";
      connection.query(updateRequestQuery, [username], (errUpdateRequest) => {
        if (errUpdateRequest) {
          console.error("Error updating request column:", errUpdateRequest);
          return res
            .status(500)
            .json({ message: "Error updating request column" });
        }

        const deleteQueryEvents = "DELETE FROM events WHERE username = ?";
        connection.query(
          deleteQueryEvents,
          [username],
          (errEvents, resultsEvents) => {
            if (errEvents) {
              console.error("Error deleting events:", errEvents);
              return res.status(500).json({ message: "Error deleting events" });
            }

            const deleteQueryMeetings =
              "DELETE FROM meetings WHERE username = ?";
            connection.query(
              deleteQueryMeetings,
              [username],
              (errMeetings, resultsMeetings) => {
                if (errMeetings) {
                  console.error("Error deleting meetings:", errMeetings);
                  return res
                    .status(500)
                    .json({ message: "Error deleting meetings" });
                }

                res.status(204).end();
              },
            );
          },
        );
      });
    });
  });
});

//----------------------------CALENDAR SECTION----------------------------//

//-----------------Fetch remainders----------------------------//
app.get("/get-reminders", (req, res) => {
  const currentDate = new Date().toISOString().split("T")[0]; // Get the current date in YYYY-MM-DD format
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ message: "Username not provided" });
  }

  const sql =
    "SELECT * FROM meetings WHERE (date = ? AND username = ?) OR (date = ? AND FIND_IN_SET(?, invitees) > 0)";
  const values = [currentDate, username, currentDate, username];

  connection.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error getting reminders:", err);
      return res.status(500).json({ message: "Server error" });
    }

    res.status(200).json(results);
  });
});

//-----------------Fetch meetings----------------------------//
app.get("/calendar/meetings", (req, res) => {
  // Assuming the username is stored in session storage
  const username = req.query.username;

  if (!username) {
    res.status(400).json({ message: "Username is required." });
    return;
  }

  const sql = `
    SELECT * FROM meetings 
    WHERE username = ? OR invitees LIKE ?
    ORDER BY date DESC
  `;

  const likePattern = `%${username}%`;

  connection.query(sql, [username, likePattern], (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ message: "Error fetching events" });
    } else {
      res.status(200).json(results);
    }
  });
});

//------------------Fetch all events-------------------------//
app.get("/calendar/events", (req, res) => {
  const username = req.query.username;
  if (!username) {
    res.status(400).json({ message: "Username is required." });
    return;
  }

  const sql = "SELECT * FROM events WHERE username = ?";

  connection.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ message: "Error fetching events" });
    } else {
      res.status(200).json(results);
    }
  });
});

//-------------------------------------add meeting--------------------------------//
app.post("/calendar", (req, res) => {
  const meetingData = req.body;

  if (
    !meetingData.meetingName ||
    !meetingData.startTime ||
    !meetingData.endTime ||
    !meetingData.meetingMode ||
    !meetingData.date ||
    !meetingData.username
  ) {
    res.status(400).json({ error: "Please fill in all fields." });
    return;
  }

  const checkDuplicateSql =
    "SELECT * FROM meetings WHERE date = ? AND start_time = ? AND username = ?";
  connection.query(
    checkDuplicateSql,
    [meetingData.date, meetingData.startTime, meetingData.username],
    (err, results) => {
      if (err) {
        console.error("Error checking for duplicate meeting:", err);
        res.status(500).json({ error: "Error checking for duplicate meeting" });
      } else {
        if (results.length > 0) {
          res.status(200).json({ message: "Duplicate meeting found" });
        } else {
          const insertSql =
            "INSERT INTO meetings (meeting_name, start_time, end_time, meeting_mode, date, username, invitees) VALUES (?, ?, ?, ?, ?, ?, ?)";
          connection.query(
            insertSql,
            [
              meetingData.meetingName,
              meetingData.startTime,
              meetingData.endTime,
              meetingData.meetingMode,
              meetingData.date,
              meetingData.username,
              meetingData.invitees,
            ],
            (insertErr, result) => {
              if (insertErr) {
                console.error("Error inserting meeting:", insertErr);
                res.status(500).json({ error: "Error inserting meeting" });
              } else {
                res.status(200).json({ message: "Meeting added successfully" });
              }
            },
          );
        }
      }
    },
  );
});

//--------------------------------UPDATE MEETING--------------------------------//

app.put("/calendar/:sno", (req, res) => {
  const sno = req.params.sno;
  const username = req.query.username;
  const updatedMeeting = req.body;

  if (
    !updatedMeeting.meeting_name ||
    !updatedMeeting.date ||
    !updatedMeeting.start_time ||
    !updatedMeeting.end_time ||
    !updatedMeeting.meeting_mode
  ) {
    res.status(400).json({ message: "Please fill in all fields" });
    return;
  }

  const duplicateCheckSql =
    "SELECT * FROM meetings WHERE date = ? AND start_time = ? AND sno != ? AND username = ?";
  connection.query(
    duplicateCheckSql,
    [updatedMeeting.date, updatedMeeting.start_time, sno, username],
    (err, results) => {
      if (err) {
        console.error("Error checking for duplicate meeting:", err);
        res.status(500).json({ message: "Error updating meeting" });
      } else if (results.length > 0) {
        res.status(200).json({ message: "Duplicate meeting found" });
      } else {
        const updateSql =
          "UPDATE meetings SET meeting_name=?, date=?, start_time=?, end_time=?, meeting_mode=? WHERE sno=? AND username = ?";
        const values = [
          updatedMeeting.meeting_name,
          updatedMeeting.date,
          updatedMeeting.start_time,
          updatedMeeting.end_time,
          updatedMeeting.meeting_mode,
          sno,
          username,
        ];
        connection.query(updateSql, values, (updateErr, updateResult) => {
          if (updateErr) {
            console.error("Error updating meeting:", updateErr);
            res.status(500).json({ message: "Error updating meeting" });
          } else {
            res.status(200).json({ message: "Meeting updated successfully" });
          }
        });
      }
    },
  );
});

//-----------------------------Delete meeting------------------------------//
app.delete("/calendar/:sno", (req, res) => {
  const sno = req.params.sno;
  const username = req.query.username;

  if (!sno || !username) {
    res
      .status(400)
      .json({ message: "Select a meeting and provide a username to delete" });
    return;
  }

  const checkSql = "SELECT * FROM meetings WHERE sno = ? AND username = ?";
  connection.query(checkSql, [sno, username], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Error checking meeting:", checkErr);
      res.status(500).json({ message: "Error deleting meeting" });
    } else if (checkResults.length === 0) {
      res.status(404).json({ message: "Meeting not found" });
    } else {
      const deleteSql = "DELETE FROM meetings WHERE sno = ? AND username = ?";
      connection.query(deleteSql, [sno, username], (err, results) => {
        if (err) {
          console.error("Error deleting meeting:", err);
          res.status(500).json({ message: "Error deleting meeting" });
        } else {
          res.status(200).json({ message: "Meeting deleted successfully" });
        }
      });
    }
  });
});

//-------------------------------------------------------ACCOUNTS SECTION-----------------------------------------------------//

//----------------------------------fetch classes----------------------------------//
app.get("/account/events", (req, res) => {
  const username = req.query.username;

  if (!username) {
    res.status(400).json({ message: "Username is required." });
    return;
  }

  const sql = "SELECT * FROM events WHERE username = ?";

  connection.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ message: "Error fetching events" });
    } else {
      res.status(200).json(results);
    }
  });
});

//-------------------------------------fetch meetings --------------------------------//

app.get("/account/meetings", (req, res) => {
  const username = req.query.username;

  if (!username) {
    res.status(400).json({ message: "Username is required." });
    return;
  }

  const sql = `
    SELECT * FROM meetings 
    WHERE username = ? OR invitees LIKE ?
    ORDER BY date DESC
  `;

  const likePattern = `%${username}%`;

  connection.query(sql, [username, likePattern], (err, results) => {
    if (err) {
      console.error("Error fetching meetings:", err);
      res.status(500).json({ message: "Error fetching meetings" });
    } else {
      res.status(200).json(results);
    }
  });
});

//-------------------------------------get course codes---------------------------------//

app.get("/account/codes", (req, res) => {
  const prefix = req.query.prefix;

  if (!prefix) {
    return res.status(400).json({ message: "Course prefix is required" });
  }

  const sql =
    "SELECT DISTINCT code FROM courses_list WHERE prefix = ? ORDER BY code ASC";
  const values = [prefix];

  connection.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error fetching course codes by prefix:", err);
      res.status(500).json({ message: "Error fetching course codes" });
    } else {
      const courseCodes = results.map((row) => row.code);
      res.status(200).json(courseCodes);
    }
  });
});

//--------------------------------add class---------------------------//
app.post("/account", (req, res) => {
  const eventData = req.body;

  if (
    !eventData.coursePrefix ||
    !eventData.courseCode ||
    !eventData.section ||
    !eventData.startTime ||
    !eventData.endTime ||
    !eventData.courseMode ||
    !eventData.daysOfWeek ||
    !eventData.username
  ) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }

  const courseQuery =
    "SELECT name FROM courses_list WHERE prefix = ? AND code = ?";
  const courseValues = [eventData.coursePrefix, eventData.courseCode];

  connection.query(courseQuery, courseValues, (courseErr, courseResults) => {
    if (courseErr) {
      console.error("Error fetching course name:", courseErr);
      return res.status(500).json({ message: "Error adding event" });
    }

    if (courseResults.length > 0) {
      const courseName = courseResults[0].name;

      const sql =
        "INSERT INTO events (course_prefix, course_code, section, start_time, end_time, course_mode, days_of_week, course_name, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const values = [
        eventData.coursePrefix,
        eventData.courseCode,
        eventData.section,
        eventData.startTime,
        eventData.endTime,
        eventData.courseMode,
        eventData.daysOfWeek,
        courseName,
        eventData.username,
      ];

      connection.query(sql, values, (err, results) => {
        if (err) {
          console.error("Error inserting event:", err);
          return res.status(500).json({ message: "Error adding event" });
        }

        // After adding the event, check the groups table
        const checkGroupsQuery =
          "SELECT * FROM `groups` WHERE course_name = ? AND section = ?";
        const checkGroupsValues = [courseName, eventData.section];

        connection.query(
          checkGroupsQuery,
          checkGroupsValues,
          (groupsErr, groupsResults) => {
            if (groupsErr) {
              console.error("Error checking groups:", groupsErr);
              return res.status(500).json({ message: "Error adding event" });
            }

            if (groupsResults.length > 0) {
              // If matching record found in groups table, update participants
              const existingParticipants = groupsResults[0].participants;
              const updatedParticipants = existingParticipants
                ? `${existingParticipants},${eventData.username}`
                : eventData.username;

              const updateGroupsQuery =
                "UPDATE `groups` SET participants = ? WHERE course_name = ? AND section = ?";
              const updateGroupsValues = [
                updatedParticipants,
                courseName,
                eventData.section,
              ];

              connection.query(
                updateGroupsQuery,
                updateGroupsValues,
                (updateGroupsErr, updateGroupsResults) => {
                  if (updateGroupsErr) {
                    console.error("Error updating groups:", updateGroupsErr);
                    return res
                      .status(500)
                      .json({ message: "Error adding event" });
                  }

                  return res.status(201).json(eventData);
                },
              );
            } else {
              // If no matching record found in groups table, check events table
              const checkEventsQuery =
                "SELECT * FROM events WHERE course_name = ? AND section = ?";
              const checkEventsValues = [courseName, eventData.section];

              connection.query(
                checkEventsQuery,
                checkEventsValues,
                (eventsErr, eventsResults) => {
                  if (eventsErr) {
                    console.error("Error checking events:", eventsErr);
                    return res
                      .status(500)
                      .json({ message: "Error adding event" });
                  }

                  if (eventsResults.length > 0) {
                    // If matching record found in events table, update participants
                    const existingParticipants = eventsResults
                      .map((event) => event.username)
                      .join(",");
                    const updatedParticipants = existingParticipants
                      ? `${existingParticipants},${eventData.username}`
                      : eventData.username;

                    const insertGroupsQuery =
                      "INSERT INTO `groups` (course_name, section, participants) VALUES (?, ?, ?)";
                    const insertGroupsValues = [
                      courseName,
                      eventData.section,
                      updatedParticipants,
                    ];

                    connection.query(
                      insertGroupsQuery,
                      insertGroupsValues,
                      (insertGroupsErr, insertGroupsResults) => {
                        if (insertGroupsErr) {
                          console.error(
                            "Error inserting into groups:",
                            insertGroupsErr,
                          );
                          return res
                            .status(500)
                            .json({ message: "Error adding event" });
                        }

                        return res.status(201).json(eventData);
                      },
                    );
                  } else {
                    // If no matching record found in events table, simply return success
                    return res.status(201).json(eventData);
                  }
                },
              );
            }
          },
        );
      });
    } else {
      console.error("Course not found for the provided prefix and code");
      return res.status(404).json({ message: "Course not found" });
    }
  });
});

//----------------------------------update class-------------------------------//
app.put("/account/:sno", (req, res) => {
  const sno = req.params.sno;
  const updatedEvent = req.body;

  if (!sno || !updatedEvent) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const sql =
    "UPDATE events SET start_time = ?, end_time = ?, course_mode = ?, days_of_week = ? WHERE sno = ?";
  const values = [
    updatedEvent.start_time,
    updatedEvent.end_time,
    updatedEvent.course_mode,
    updatedEvent.days_of_week,
    sno,
  ];

  connection.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error updating event:", err);
      return res.status(500).json({ message: "Error updating event" });
    } else {
      return res.status(200).json({ message: "Event updated successfully" });
    }
  });
});

//--------------------------------------delete class---------------------------------//
app.delete("/account/:sno", (req, res) => {
  const sno = req.params.sno;
  const username = req.query.username;
  if (sno === null || sno === undefined) {
    return res
      .status(400)
      .json({ message: "Please select an event to delete." });
  }

  if (!username) {
    return res.status(400).json({ message: "Username is required." });
  }

  const sql = "DELETE FROM events WHERE sno = ? AND username = ?";
  const values = [sno, username];

  connection.query(sql, values, (err, results) => {
    if (err) {
      console.error("Error deleting event:", err);
      res.status(500).json({ message: "Error deleting event" });
    } else {
      if (results.affectedRows > 0) {
        res.status(200).json({ message: "Event deleted successfully" });
      } else {
        res.status(404).json({
          message: "Event not found for the provided username and sno.",
        });
      }
    }
  });
});

//-------------------------------------------------------FREINDS SECTION----------------------------------------------------//
app.get("/groups/:username", (req, res) => {
  const { username } = req.params;
  const query = `SELECT * FROM \`groups\` WHERE participants LIKE ?`;

  connection.query(query, [`%${username}%`], (err, results) => {
    if (err) {
      console.error("Error fetching groups:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json(results);
    }
  });
});

//--------------------------fetch primmary friends------------------------//
app.get("/friends/primary/:username", (req, res) => {
  const username = req.params.username;

  connection.query(
    "SELECT friends FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) {
        console.error("Error fetching primary friends:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (results.length > 0) {
        const friendsData = results[0].friends;
        res.json({ friends: friendsData });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    },
  );
});

//--------------------------fetch friends data------------------------//
app.get("/friends/users/:username", (req, res) => {
  const username = req.params.username;

  connection.query(
    "SELECT username, firstname, lastname, email FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) {
        console.error("Error fetching user details:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (results.length > 0) {
        const userDetails = results[0];
        res.json(userDetails);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    },
  );
});

//--------------------------unfriend--------------------------//

app.post("/friends/unfriend", (req, res) => {
  const { username, friendUsername } = req.body;

  // Remove friendUsername and the comma to its right from the friends list of username
  connection.query(
    'UPDATE users SET friends = TRIM(BOTH "," FROM REPLACE(friends, ?, "")) WHERE username = ?',
    [friendUsername, username],
    (err1, results1) => {
      if (err1) {
        console.error("Error unfriending user:", err1);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      // Remove username and the comma to its right from the friends list of friendUsername
      connection.query(
        'UPDATE users SET friends = TRIM(BOTH "," FROM REPLACE(friends, ?, "")) WHERE username = ?',
        [username, friendUsername],
        (err2, results2) => {
          if (err2) {
            console.error("Error unfriending user:", err2);
            res.status(500).json({ error: "Internal Server Error" });
            return;
          }

          res.json({ success: true });
        },
      );
    },
  );
});

//--------------------------------fetch friend privacy------------------------//
app.get("/users/privacy/:username", (req, res) => {
  const username = req.params.username;

  connection.query(
    "SELECT privacy FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) {
        console.error("Error fetching privacy setting:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      if (results.length > 0) {
        const privacySetting = results[0].privacy;
        res.json({ privacy: privacySetting });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    },
  );
});

//--------------------------fetch friends events and meetings------------------------//
app.get("/users/schedule/:username", (req, res) => {
  const username = req.params.username;

  const eventsQuery = "SELECT * FROM events WHERE username = ?";
  const meetingsQuery = "SELECT * FROM meetings WHERE username = ?";

  connection.query(eventsQuery, [username], (err1, eventsResults) => {
    if (err1) {
      console.error("Error fetching events:", err1);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    connection.query(meetingsQuery, [username], (err2, meetingsResults) => {
      if (err2) {
        console.error("Error fetching meetings:", err2);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      res.json({ events: eventsResults, meetings: meetingsResults });
    });
  });
});

//--------------------------get friend requests---------------------------//
app.get("/friends/request/:username", (req, res) => {
  const username = req.params.username;

  connection.query(
    "SELECT request FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) {
        console.error("Error fetching request friends:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (results.length > 0) {
        const requestFriendsData = results[0].request;
        res.json({ request: requestFriendsData });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    },
  );
});

//--------------------------fetch friend suggestions-------------------------//

app.get("/friends/suggestions/:username", (req, res) => {
  const username = req.params.username;
  connection.query(
    "SELECT username FROM users WHERE username LIKE ?",
    [`%${username}%`],
    (err, results) => {
      if (err) {
        console.error("Error fetching friend suggestions:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const suggestions = results.map((result) => result.username);
      res.json({ suggestions });
    },
  );
});

//--------------------------add friend------------------------------//
app.post("/friends/add", (req, res) => {
  const { username, friendUsername } = req.body;

  if (!friendUsername || friendUsername.trim() === "") {
    res.status(400).json({ error: "Friend username is required" });
    return;
  }

  // Fetch the session user's 'friends' column
  connection.query(
    "SELECT friends FROM users WHERE username = ?",
    [username],
    (sessionErr, sessionResults) => {
      if (sessionErr) {
        console.error("Error fetching session user data:", sessionErr);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (sessionResults.length > 0) {
        const sessionFriends = sessionResults[0].friends;

        // Check if friendUsername is already a friend
        if (
          sessionFriends &&
          sessionFriends.split(",").includes(friendUsername)
        ) {
          res.json({ success: false, message: "User is already a friend" });
        } else {
          // Fetch the friend's 'request' column
          connection.query(
            "SELECT request FROM users WHERE username = ?",
            [friendUsername],
            (friendErr, friendResults) => {
              if (friendErr) {
                console.error("Error fetching friend request:", friendErr);
                res.status(500).json({ error: "Internal Server Error" });
                return;
              }

              if (friendResults.length > 0) {
                const friendRequests = friendResults[0].request;

                // Check if the session username is already in the 'request' column
                if (
                  friendRequests &&
                  friendRequests.split(",").includes(username)
                ) {
                  res.json({
                    success: false,
                    message: "Friend request already sent",
                  });
                } else {
                  const newRequests = friendRequests
                    ? `${friendRequests},${username}`
                    : username;

                  // Update the 'request' column in the database for the friend
                  connection.query(
                    "UPDATE users SET request = ? WHERE username = ?",
                    [newRequests, friendUsername],
                    (updateErr) => {
                      if (updateErr) {
                        console.error(
                          "Error updating friend request:",
                          updateErr,
                        );
                        res
                          .status(500)
                          .json({ error: "Internal Server Error" });
                        return;
                      }

                      res.json({
                        success: true,
                        message: "Friend request sent",
                      });
                    },
                  );
                }
              } else {
                // Friend not found
                res.json({ success: false, message: "Friend not found" });
              }
            },
          );
        }
      } else {
        // Session user not found
        res
          .status(404)
          .json({ success: false, message: "Session user not found" });
      }
    },
  );
});

//--------------------------Accept friend req------------------------//

app.post("/friends/accept", (req, res) => {
  const { username, friendUsername } = req.body;

  connection.query(
    "SELECT request, friends FROM users WHERE username = ?",
    [username],
    (sessionErr, sessionResults) => {
      if (sessionErr) {
        console.error("Error fetching session user data:", sessionErr);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      if (sessionResults.length > 0) {
        const sessionRequests = sessionResults[0].request;
        const sessionFriends = sessionResults[0].friends;

        if (
          sessionRequests &&
          sessionRequests.split(",").includes(friendUsername)
        ) {
          connection.query(
            "UPDATE users SET request = REPLACE(request, ?, '') WHERE username = ?",
            [friendUsername, username],
            (deleteSessionRequestErr) => {
              if (deleteSessionRequestErr) {
                console.error(
                  "Error deleting session user request:",
                  deleteSessionRequestErr,
                );
                res.status(500).json({ error: "Internal Server Error" });
                return;
              }

              connection.query(
                'UPDATE users SET friends = TRIM(TRAILING "," FROM ?) WHERE username = ?',
                [
                  `${sessionFriends ? `${sessionFriends},` : ""}${friendUsername}`,
                  username,
                ],
                (updateSessionErr) => {
                  if (updateSessionErr) {
                    console.error(
                      "Error updating session user friends list:",
                      updateSessionErr,
                    );
                    res.status(500).json({ error: "Internal Server Error" });
                    return;
                  }

                  connection.query(
                    "SELECT request, friends FROM users WHERE username = ?",
                    [friendUsername],
                    (friendErr, friendResults) => {
                      if (friendErr) {
                        console.error("Error fetching friend data:", friendErr);
                        res
                          .status(500)
                          .json({ error: "Internal Server Error" });
                        return;
                      }

                      if (friendResults.length > 0) {
                        const friendRequests = friendResults[0].request;
                        const friendFriends = friendResults[0].friends;

                        if (
                          friendRequests &&
                          friendRequests.split(",").includes(username)
                        ) {
                          connection.query(
                            "UPDATE users SET request = REPLACE(request, ?, '') WHERE username = ?",
                            [username, friendUsername],
                            (deleteFriendRequestErr) => {
                              if (deleteFriendRequestErr) {
                                console.error(
                                  "Error deleting friend request:",
                                  deleteFriendRequestErr,
                                );
                                res
                                  .status(500)
                                  .json({ error: "Internal Server Error" });
                                return;
                              }

                              connection.query(
                                "UPDATE users SET friends = ? WHERE username = ?",
                                [
                                  `${friendFriends ? `${friendFriends},` : ""}${username}`,
                                  friendUsername,
                                ],
                                (friendUpdateErr) => {
                                  if (friendUpdateErr) {
                                    console.error(
                                      "Error updating friend friends list:",
                                      friendUpdateErr,
                                    );
                                    res
                                      .status(500)
                                      .json({ error: "Internal Server Error" });
                                    return;
                                  }

                                  res.json({
                                    success: true,
                                    message: "Friend request accepted",
                                  });
                                },
                              );
                            },
                          );
                        } else {
                          connection.query(
                            "UPDATE users SET friends = ? WHERE username = ?",
                            [
                              `${sessionFriends ? `${sessionFriends},` : ""}${friendUsername}`,
                              username,
                            ],
                            (updateSessionErr) => {
                              if (updateSessionErr) {
                                console.error(
                                  "Error updating session user friends list:",
                                  updateSessionErr,
                                );
                                res
                                  .status(500)
                                  .json({ error: "Internal Server Error" });
                                return;
                              }

                              connection.query(
                                "UPDATE users SET friends = ? WHERE username = ?",
                                [
                                  `${friendFriends ? `${friendFriends},` : ""}${username}`,
                                  friendUsername,
                                ],
                                (friendUpdateErr) => {
                                  if (friendUpdateErr) {
                                    console.error(
                                      "Error updating friend friends list:",
                                      friendUpdateErr,
                                    );
                                    res
                                      .status(500)
                                      .json({ error: "Internal Server Error" });
                                    return;
                                  }

                                  res.json({
                                    success: true,
                                    message: "Friend request accepted",
                                  });
                                },
                              );
                            },
                          );
                        }
                      } else {
                        res
                          .status(404)
                          .json({ error: "Friend data not found" });
                      }
                    },
                  );
                },
              );
            },
          );
        } else {
          connection.query(
            "UPDATE users SET friends = ? WHERE username = ?",
            [
              `${sessionFriends ? `${sessionFriends},` : ""}${friendUsername}`,
              username,
            ],
            (updateSessionErr) => {
              if (updateSessionErr) {
                console.error(
                  "Error updating session user friends list:",
                  updateSessionErr,
                );
                res.status(500).json({ error: "Internal Server Error" });
                return;
              }

              connection.query(
                "SELECT request, friends FROM users WHERE username = ?",
                [friendUsername],
                (friendErr, friendResults) => {
                  if (friendErr) {
                    console.error("Error fetching friend data:", friendErr);
                    res.status(500).json({ error: "Internal Server Error" });
                    return;
                  }

                  if (friendResults.length > 0) {
                    const friendRequests = friendResults[0].request;
                    const friendFriends = friendResults[0].friends;

                    if (
                      friendRequests &&
                      friendRequests.split(",").includes(username)
                    ) {
                      connection.query(
                        "UPDATE users SET request = REPLACE(request, ?, '') WHERE username = ?",
                        [username, friendUsername],
                        (deleteFriendRequestErr) => {
                          if (deleteFriendRequestErr) {
                            console.error(
                              "Error deleting friend request:",
                              deleteFriendRequestErr,
                            );
                            res
                              .status(500)
                              .json({ error: "Internal Server Error" });
                            return;
                          }

                          connection.query(
                            "UPDATE users SET friends = ? WHERE username = ?",
                            [
                              `${friendFriends ? `${friendFriends},` : ""}${username}`,
                              friendUsername,
                            ],
                            (friendUpdateErr) => {
                              if (friendUpdateErr) {
                                console.error(
                                  "Error updating friend friends list:",
                                  friendUpdateErr,
                                );
                                res
                                  .status(500)
                                  .json({ error: "Internal Server Error" });
                                return;
                              }

                              res.json({
                                success: true,
                                message: "Friend request accepted",
                              });
                            },
                          );
                        },
                      );
                    } else {
                      connection.query(
                        "UPDATE users SET friends = ? WHERE username = ?",
                        [
                          `${friendFriends ? `${friendFriends},` : ""}${username}`,
                          friendUsername,
                        ],
                        (friendUpdateErr) => {
                          if (friendUpdateErr) {
                            console.error(
                              "Error updating friend friends list:",
                              friendUpdateErr,
                            );
                            res
                              .status(500)
                              .json({ error: "Internal Server Error" });
                            return;
                          }

                          res.json({
                            success: true,
                            message: "Friend request accepted",
                          });
                        },
                      );
                    }
                  } else {
                    res.status(404).json({ error: "Friend data not found" });
                  }
                },
              );
            },
          );
        }
      } else {
        res.status(404).json({ error: "Session user data not found" });
      }
    },
  );
});

//-----------------------------delete friend request------------------------------//
app.post("/friends/delete", (req, res) => {
  const { username, friendUsername } = req.body;

  connection.query(
    "UPDATE users SET request = TRIM(TRAILING \",\" FROM REPLACE(request, ?, '')) WHERE username = ?",
    [username, friendUsername],
    (deleteFriendRequestErr) => {
      if (deleteFriendRequestErr) {
        console.error(
          "Error deleting friendUsername from sessionUsername's request column:",
          deleteFriendRequestErr,
        );
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      connection.query(
        "UPDATE users SET request = TRIM(TRAILING \",\" FROM REPLACE(request, ?, '')) WHERE username = ?",
        [friendUsername, username],
        (deleteSessionRequestErr) => {
          if (deleteSessionRequestErr) {
            console.error(
              "Error deleting sessionUsername from friendUsername's request column:",
              deleteSessionRequestErr,
            );
            res.status(500).json({ error: "Internal Server Error" });
            return;
          }

          res.json({ success: true });
        },
      );
    },
  );
});

//-----------------------------messages------------------------------//

app.post("/upload", upload.array("files"), (req, res) => {
  const uploadedFiles = req.files.map((file) => file.filename);
  console.log("Uploaded files:", uploadedFiles);
  res.json({ files: uploadedFiles });
});

app.post("/messages", (req, res) => {
  const { sender, receiver, message, files } = req.body;
  const timestamp = new Date();

  const query =
    "INSERT INTO messages (sender, receiver, message, files, timestamp) VALUES (?, ?, ?, ?, ?)";

  connection.query(
    query,
    [
      sender,
      receiver,
      message,
      files ? JSON.stringify(files) : null,
      timestamp,
    ],
    (err, result) => {
      if (err) {
        console.error("Error inserting message:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        // Broadcast the message to WebSocket clients
        wss.emit("message", { sender, receiver, message, files, timestamp });
        res.json({ sender, receiver, message, files, timestamp });
      }
    },
  );
});

app.get("/messages/:username/:friend", (req, res) => {
  const username = req.params.username;
  const friend = req.params.friend;
  connection.query(
    "SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY timestamp",
    [username, friend, friend, username],
    (err, results) => {
      if (err) {
        console.error("Error fetching chat messages:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        res.json(results);
      }
    },
  );
});

app.post("/group-messages", (req, res) => {
  const { sender, group, message, files } = req.body;
  const timestamp = new Date();

  const query =
    "INSERT INTO group_messages (sender, group_name, message, files, timestamp) VALUES (?, ?, ?, ?, ?)";

  connection.query(
    query,
    [sender, group, message, files ? JSON.stringify(files) : null, timestamp],
    (err, result) => {
      if (err) {
        console.error("Error inserting group message:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        // Broadcast the group message to WebSocket clients
        wss.emit("message", { sender, receiver, message, files, timestamp });

        res.json({ sender, group, message, files, timestamp });
      }
    },
  );
});

app.get("/group-messages/:group", (req, res) => {
  const group = req.params.group;
  connection.query(
    "SELECT * FROM group_messages WHERE group_name = ? ORDER BY timestamp",
    [group],
    (err, results) => {
      if (err) {
        console.error("Error fetching group messages:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        res.json(results);
      }
    },
  );
});

//----------------------------------------------NOTIFICATION-----------------------------------------//

app.post("/notifications", (req, res) => {
  const notification = req.body;

  notification.content = `Friend request - ${notification.sender} sent you a friend request`;

  connection.query(
    "INSERT INTO notifications SET ?, timestamp = NOW()",
    notification,
    (err, result) => {
      if (err) {
        console.error("Error inserting notification into the database:", err);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } else {
        console.log("Notification saved:", result);
        res.status(200).json({ success: true, message: "Notification saved" });
      }
    },
  );

  wss.emit("notification", notification);
});

app.post("/notifications/:username/:friendUsername", (req, res) => {
  const { username, friendUsername } = req.params;
  const notification = req.body;

  connection.query(
    "INSERT INTO notifications SET ?, timestamp = NOW()",
    notification,
    (err, result) => {
      if (err) {
        console.error("Error inserting notification into the database:", err);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } else {
        console.log("Notification saved:", result);
        res.status(200).json({ success: true, message: "Notification saved" });
      }
    },
  );

  wss.emit("notification", notification);
});

app.post("/notifications/meeting", (req, res) => {
  const notification = req.body;

  // Split the receiver usernames and insert a notification for each one
  const receivers = notification.receiver
    .split(",")
    .map((receiver) => receiver.trim());

  const insertNotification = (receiver) => {
    const notificationData = { ...notification, receiver: receiver };
    connection.query(
      "INSERT INTO notifications SET ?, timestamp = NOW()",
      notificationData,
      (err, result) => {
        if (err) {
          console.error(
            `Error inserting meeting notification for ${receiver} into the database:`,
            err,
          );
          res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        } else {
          console.log(`Meeting notification saved for ${receiver}:`, result);
        }
      },
    );
  };

  receivers.forEach(insertNotification);

  // Send notifications to WebSocket clients
  receivers.forEach((receiver) => {
    wss.to(receiver).emit("notification", notification);
  });

  res
    .status(200)
    .json({ success: true, message: "Meeting notifications saved" });
});

app.get("/notifications/:username", (req, res) => {
  const { username } = req.params;

  connection.query(
    "SELECT * FROM notifications WHERE receiver = ? ORDER BY timestamp DESC",
    [username],
    (err, results) => {
      if (err) {
        console.error("Error fetching notifications:", err);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } else {
        // Filter notifications to include only those where the logged-in user's username is in the receivers
        const filteredNotifications = results.filter(
          (notification) => notification.receiver === username,
        );

        res
          .status(200)
          .json({ success: true, notifications: filteredNotifications });
      }
    },
  );
});
app.delete("/notifications/clear/:username", (req, res) => {
  const { username } = req.params;

  connection.query(
    "DELETE FROM notifications WHERE receiver = ?",
    [username],
    (err, result) => {
      if (err) {
        console.error("Error clearing notifications:", err);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } else {
        res.status(200).json({
          success: true,
          message: "Notifications cleared successfully",
        });
      }
    },
  );
});
// Add the route to handle closing a notification
app.delete("/notifications/:username/:sno", (req, res) => {
  const { username, sno } = req.params;

  connection.query(
    "DELETE FROM notifications WHERE receiver = ? AND sno = ?",
    [username, sno],
    (err, result) => {
      if (err) {
        console.error("Error closing notification:", err);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      } else {
        res
          .status(200)
          .json({ success: true, message: "Notification closed successfully" });
      }
    },
  );
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
