// backend/index.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Data structure to track queues and stage
const instruments = ["Guitar", "Bass", "Drums", "Percussion", "Horns", "Piano", "Vocals"];
const state = {
  queues: {},
  stage: {},
  musicians: {} // { id: { name, instrument, status, songsPlayed } }
};

instruments.forEach(inst => {
  state.queues[inst] = [];
  state.stage[inst] = null;
});

// Generate a simple ID for musicians
const generateId = () => Math.random().toString(36).substr(2, 9);

io.on("connection", (socket) => {
  console.log("A user connected");

  // Send current state to the client
  socket.emit("stateInit", state);

  // Musician signs up
  socket.on("signup", ({ name, instrument }) => {
    const id = generateId();
    const musician = {
      id,
      name,
      instrument,
      status: "queue",
      songsPlayed: 0
    };

    state.musicians[id] = musician;
    state.queues[instrument].push(id);

    io.emit("stateUpdate", state);
  });

  // Admin moves musician to stage
  socket.on("moveToStage", ({ instrument, musicianId }) => {
    if (state.queues[instrument].includes(musicianId)) {
      state.stage[instrument] = musicianId;
      state.queues[instrument] = state.queues[instrument].filter(id => id !== musicianId);
      state.musicians[musicianId].status = "on_stage";

      io.emit("stateUpdate", state);
    }
  });

  // Admin removes musician from stage
  socket.on("removeFromStage", ({ instrument }) => {
    const musicianId = state.stage[instrument];
    const musician = state.musicians[musicianId];

    if (musician) {
      musician.songsPlayed += 1;
      musician.status = "done";

      const limit = (musician.instrument === "Vocals") ? 1 : 2;

      if (musician.songsPlayed >= limit) {
        delete state.musicians[musicianId];
      }

      state.stage[instrument] = null;

      io.emit("stateUpdate", state);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;

  // Send a test notification immediately (or store it)
  webpush.sendNotification(subscription, JSON.stringify({
    title: "You're Up Next!",
    body: "Get ready to go on stage!",
    icon: "icon.png"
  })).then(() => {
    res.status(201).json({ success: true });
  }).catch(err => {
    console.error("Push error", err);
    res.sendStatus(500);
  });
});



