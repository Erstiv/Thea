// ═══════════════════════════════════════════════════════════════
// SNAP & GRAB v2 — Movie Night Party App
// Identify • Predict • Play • Download
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");
const QRCode = require("qrcode");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3010;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── Gemini ─────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
function gemini() { return genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); }

// ═══════════════════════════════════════════════════════════════
// ROOM MANAGEMENT
// ═══════════════════════════════════════════════════════════════
const rooms = new Map(); // code -> Room
const downloadQueue = new Map(); // id -> request
let reqCounter = 0;

function generateCode() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  return code;
}

function createRoom(hostName) {
  const code = generateCode();
  const room = {
    code,
    host: hostName,
    players: new Map(), // name -> { ws, score }
    currentMovie: null, // title set by host for context-aware games
    bingoCards: new Map(), // name -> card
    predictions: new Map(), // name -> predictions array
    whatNextRound: null, // { question, choices, answers: Map, correctIdx }
    rateRound: null, // { answers: Map }
    drinkingRules: [],
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function broadcast(room, msg, excludeWs) {
  const data = JSON.stringify(msg);
  room.players.forEach((p) => {
    if (p.ws && p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  });
}

function getScoreboard(room) {
  const scores = [];
  room.players.forEach((p, name) => scores.push({ name, score: p.score }));
  return scores.sort((a, b) => b.score - a.score);
}

// ─── WebSocket ──────────────────────────────────────────────
wss.on("connection", (ws) => {
  let playerRoom = null;
  let playerName = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "join") {
      const room = rooms.get(msg.code);
      if (!room) return ws.send(JSON.stringify({ type: "error", msg: "Room not found" }));

      playerRoom = room;
      playerName = msg.name || "Player " + (room.players.size + 1);
      room.players.set(playerName, { ws, score: 0 });

      ws.send(JSON.stringify({
        type: "joined",
        code: room.code,
        host: room.host,
        players: Array.from(room.players.keys()),
        movie: room.currentMovie,
        drinkingRules: room.drinkingRules,
      }));

      broadcast(room, { type: "player_joined", name: playerName, players: Array.from(room.players.keys()) }, ws);
    }

    // ─── What Happens Next: submit answer ─────────
    if (msg.type === "whn_answer" && playerRoom?.whatNextRound) {
      playerRoom.whatNextRound.answers.set(playerName, msg.choiceIdx);
      // Notify host of how many have answered
      broadcast(playerRoom, {
        type: "whn_progress",
        answered: playerRoom.whatNextRound.answers.size,
        total: playerRoom.players.size,
      });
    }

    // ─── Rate the Scene: submit rating ────────────
    if (msg.type === "rate_submit" && playerRoom?.rateRound) {
      playerRoom.rateRound.answers.set(playerName, msg.rating);
      broadcast(playerRoom, {
        type: "rate_progress",
        answered: playerRoom.rateRound.answers.size,
        total: playerRoom.players.size,
      });
    }

    // ─── Bingo: claim square ──────────────────────
    if (msg.type === "bingo_claim" && playerRoom) {
      const card = playerRoom.bingoCards.get(playerName);
      if (card && card[msg.idx]) {
        card[msg.idx].claimed = true;
        // Check for bingo (any row, column, or diagonal on 5x5)
        const hasBingo = checkBingo(card);
        if (hasBingo) {
          broadcast(playerRoom, { type: "bingo_winner", name: playerName });
          const player = playerRoom.players.get(playerName);
          if (player) player.score += 50;
        }
        ws.send(JSON.stringify({ type: "bingo_update", card }));
      }
    }

    // ─── Prediction Market: submit predictions ────
    if (msg.type === "prediction_submit" && playerRoom) {
      playerRoom.predictions.set(playerName, msg.predictions);
      broadcast(playerRoom, {
        type: "prediction_progress",
        submitted: playerRoom.predictions.size,
        total: playerRoom.players.size,
      });
    }
  });

  ws.on("close", () => {
    if (playerRoom && playerName) {
      playerRoom.players.delete(playerName);
      broadcast(playerRoom, { type: "player_left", name: playerName, players: Array.from(playerRoom.players.keys()) });
    }
  });
});

// Bingo check (5x5 grid)
function checkBingo(card) {
  // card is array of 25 items
  for (let r = 0; r < 5; r++) {
    if ([0,1,2,3,4].every(c => card[r*5+c].claimed)) return true; // row
    if ([0,1,2,3,4].every(c => card[c*5+r].claimed)) return true; // col
  }
  if ([0,6,12,18,24].every(i => card[i].claimed)) return true; // diag
  if ([4,8,12,16,20].every(i => card[i].claimed)) return true; // anti-diag
  return true; // only reaches here if one of above triggered
}

// ═══════════════════════════════════════════════════════════════
// REST API
// ═══════════════════════════════════════════════════════════════

// ─── Room Management ────────────────────────────────────────
app.post("/api/room/create", (req, res) => {
  const { hostName, movie } = req.body;
  const room = createRoom(hostName || "Host");
  if (movie) room.currentMovie = movie;
  res.json({ code: room.code });
});

app.get("/api/room/:code/qr", async (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found" });
  // Use request host to build the join URL
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.secure ? "https" : "http";
  const url = `${protocol}://${host}?join=${room.code}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#e94560", light: "#0f0f0f" } });
  res.json({ qr, url });
});

app.post("/api/room/:code/movie", (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found" });
  room.currentMovie = req.body.movie;
  broadcast(room, { type: "movie_set", movie: req.body.movie });
  res.json({ ok: true });
});

// ─── 1. IDENTIFY (original Snap & Grab) ────────────────────
app.post("/api/identify", async (req, res) => {
  try {
    const { imageData, mimeType, pin } = req.body;
    if (!imageData) return res.status(400).json({ error: "No image" });

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `Identify the movie or TV show in this image. It could be a photo of a screen, a poster, DVD cover, credits, or still frame. Use actor recognition, text, scene recognition, cinematography — any clue.

Return JSON only (no markdown):
{"identified":true,"confidence":"high/medium/low","title":"Title","year":2024,"type":"movie/tv","reasoning":"How you identified it","alternates":["Other Title (Year)"]}
Or if unidentifiable: {"identified":false,"reasoning":"What I see"}` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());
    if (parsed.identified) {
      parsed.inLibrary = await checkPlex(parsed.title, parsed.year);
      parsed.alreadyMonitored = parsed.type === "movie" ? await checkRadarr(parsed.title, parsed.year) : await checkSonarr(parsed.title);
    }
    parsed.isAdmin = pin === ADMIN_PIN;
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 2. WHO'S THAT? (actor identification) ──────────────────
app.post("/api/whos-that", async (req, res) => {
  try {
    const { imageData, mimeType } = req.body;

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `Identify the actor/actress visible in this image. This is likely a photo of a TV/movie screen.

Return JSON only (no markdown):
{
  "identified": true,
  "name": "Actor Name",
  "confidence": "high/medium/low",
  "knownFor": ["Movie Title (Year)", "TV Show (Year)", ...],
  "funFact": "One interesting fact about them",
  "currentAge": 45,
  "reasoning": "How I identified them"
}
Or: {"identified":false,"reasoning":"What I see"}

List their 10-15 most notable film and TV roles in knownFor.` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());

    // Check each title against Plex
    if (parsed.identified && parsed.knownFor) {
      const libraryChecks = await Promise.all(
        parsed.knownFor.map(async (title) => {
          const clean = title.replace(/\s*\(\d{4}\)\s*$/, "");
          const yearMatch = title.match(/\((\d{4})\)/);
          const year = yearMatch ? parseInt(yearMatch[1]) : null;
          const inPlex = await checkPlex(clean, year);
          return { title, inPlex: !!inPlex };
        })
      );
      parsed.filmography = libraryChecks;
    }
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 3. TROPE SPOTTER ──────────────────────────────────────
app.post("/api/trope", async (req, res) => {
  try {
    const { imageData, mimeType, movieContext } = req.body;

    const contextNote = movieContext ? `The movie/show being watched is: ${movieContext}.` : "";

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `You are a film studies expert. Identify the movie/TV trope being shown in this scene. ${contextNote}

Return JSON only (no markdown):
{
  "tropes": [
    {
      "name": "Trope Name (e.g., Chekhov's Gun, The Wilhelm Scream, Dutch Angle)",
      "tvTropesName": "TV Tropes page name if applicable",
      "description": "What this trope is and why it's being used here",
      "origin": "Where this trope originated or who popularized it",
      "otherExamples": ["Movie (Year) - brief description of how it was used", ...]
    }
  ],
  "sceneAnalysis": "Brief analysis of what's happening in this scene cinematically"
}

Identify 1-3 tropes visible in the scene. Be specific and educational.` }
    ]);

    res.json(parseGeminiJSON(result.response.text()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 4. DIRECTOR'S EYE (cinematography analysis) ───────────
app.post("/api/directors-eye", async (req, res) => {
  try {
    const { imageData, mimeType } = req.body;

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `You are a cinematography professor. Analyze this film/TV scene technically.

Return JSON only (no markdown):
{
  "shotType": "e.g., Close-up, Wide shot, Over-the-shoulder, Dutch angle",
  "lighting": "e.g., High-key, Low-key, Chiaroscuro, Natural, Neon",
  "colorPalette": "Describe the dominant colors and what mood they create",
  "composition": "Rule of thirds, symmetry, leading lines, depth of field, etc.",
  "technique": "Any special technique: tracking shot, dolly zoom, rack focus, etc.",
  "mood": "What emotional effect this creates",
  "signature": "Which famous directors or cinematographers are known for this style",
  "similarScenes": ["Movie (Year) - specific scene with similar technique", ...]
}` }
    ]);

    res.json(parseGeminiJSON(result.response.text()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 5. WHAT HAPPENS NEXT? (multiplayer game) ──────────────
app.post("/api/what-next/start", async (req, res) => {
  try {
    const { imageData, mimeType, roomCode, movieTitle } = req.body;
    const room = rooms.get(roomCode);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const movieNote = movieTitle || room.currentMovie || "";
    const context = movieNote ? `The movie/show is: ${movieNote}.` : "I don't know which movie this is — infer from the scene.";

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `You are a movie expert creating a prediction game. ${context}

This is a still frame from the movie/show. Based on what you see, generate a "What Happens Next?" question with 5 possible answers.

IMPORTANT: You must know this movie well. One answer should be what ACTUALLY happens next. The other 4 should be plausible but wrong.

Return JSON only (no markdown):
{
  "question": "What happens in the next scene?",
  "sceneDescription": "Brief description of what we're seeing right now",
  "choices": ["What actually happens", "Plausible wrong answer 1", "Plausible wrong answer 2", "Plausible wrong answer 3", "Plausible wrong answer 4"],
  "correctIdx": 0,
  "explanation": "What actually happens and why (shown after reveal)"
}

CRITICAL: Shuffle the choices randomly — don't always put the correct answer first. Update correctIdx to match.` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());

    // Store round in room
    room.whatNextRound = {
      ...parsed,
      answers: new Map(),
      startedAt: Date.now(),
    };

    // Send to all players (without correctIdx!)
    broadcast(room, {
      type: "whn_question",
      question: parsed.question,
      sceneDescription: parsed.sceneDescription,
      choices: parsed.choices,
    });

    res.json({ ok: true, question: parsed.question, choices: parsed.choices });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/what-next/reveal", (req, res) => {
  const { roomCode } = req.body;
  const room = rooms.get(roomCode);
  if (!room?.whatNextRound) return res.status(400).json({ error: "No active round" });

  const round = room.whatNextRound;
  const results = [];

  round.answers.forEach((choiceIdx, name) => {
    const correct = choiceIdx === round.correctIdx;
    if (correct) {
      const player = room.players.get(name);
      if (player) player.score += 10;
    }
    results.push({ name, chose: choiceIdx, correct });
  });

  // Players who didn't answer
  room.players.forEach((_, name) => {
    if (!round.answers.has(name)) results.push({ name, chose: -1, correct: false });
  });

  const reveal = {
    type: "whn_reveal",
    correctIdx: round.correctIdx,
    explanation: round.explanation,
    results,
    scoreboard: getScoreboard(room),
  };

  broadcast(room, reveal);
  room.whatNextRound = null;
  res.json(reveal);
});

// ─── 6. MOVIE BINGO ────────────────────────────────────────
app.post("/api/bingo/generate", async (req, res) => {
  try {
    const { roomCode, movieTitle, genre } = req.body;
    const room = rooms.get(roomCode);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const context = movieTitle ? `for the movie "${movieTitle}"` : genre ? `for a ${genre} movie` : "for a movie night";

    const result = await gemini().generateContent([
      { text: `Generate 40 unique movie bingo prompts ${context}. These should be things that commonly happen in movies of this type — tropes, cliches, character behaviors, visual elements, dialogue patterns.

Mix difficulty levels: some obvious (will definitely happen), some moderate, some unlikely but possible.

Examples for horror: "Someone says 'I'll be right back'", "Flashlight dies", "Jump scare with a cat", "Character trips while running", "Ominous music plays during a normal scene"

Return JSON only (no markdown):
{
  "prompts": ["prompt 1", "prompt 2", ... (exactly 40 prompts)]
}` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());
    const allPrompts = parsed.prompts || [];

    // Generate unique 5x5 cards for each player (25 squares, center is FREE)
    room.bingoCards.clear();
    room.players.forEach((_, name) => {
      const shuffled = [...allPrompts].sort(() => Math.random() - 0.5).slice(0, 24);
      const card = shuffled.map(text => ({ text, claimed: false }));
      card.splice(12, 0, { text: "FREE SPACE", claimed: true }); // center square
      room.bingoCards.set(name, card);
    });

    // Send each player their unique card
    room.players.forEach((p, name) => {
      if (p.ws?.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({ type: "bingo_card", card: room.bingoCards.get(name) }));
      }
    });

    res.json({ ok: true, playerCount: room.players.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 7. RATE THE SCENE ─────────────────────────────────────
app.post("/api/rate/start", (req, res) => {
  const { roomCode, sceneDescription } = req.body;
  const room = rooms.get(roomCode);
  if (!room) return res.status(404).json({ error: "Room not found" });

  room.rateRound = { answers: new Map(), description: sceneDescription };
  broadcast(room, { type: "rate_start", description: sceneDescription });
  res.json({ ok: true });
});

app.post("/api/rate/reveal", (req, res) => {
  const { roomCode } = req.body;
  const room = rooms.get(roomCode);
  if (!room?.rateRound) return res.status(400).json({ error: "No active rating" });

  const ratings = [];
  room.rateRound.answers.forEach((rating, name) => ratings.push({ name, rating }));
  const avg = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : 0;

  // Find outliers (furthest from average)
  const sorted = [...ratings].sort((a, b) => Math.abs(b.rating - avg) - Math.abs(a.rating - avg));
  const outlier = sorted[0]?.name;

  const reveal = { type: "rate_reveal", ratings, average: parseFloat(avg), outlier, description: room.rateRound.description };
  broadcast(room, reveal);
  room.rateRound = null;
  res.json(reveal);
});

// ─── 8. DRINKING GAME MODE ─────────────────────────────────
app.post("/api/drinking-game/generate", async (req, res) => {
  try {
    const { roomCode, movieTitle, genre, isAlcohol } = req.body;
    const room = rooms.get(roomCode);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const drinkWord = isAlcohol ? "take a sip" : "take a snack/drink";
    const context = movieTitle ? `for "${movieTitle}"` : genre ? `for a ${genre} movie` : "for a movie night";

    const result = await gemini().generateContent([
      { text: `Create a fun drinking/snacking game ${context}.

Rules should be things that trigger during the movie. Mix frequency:
- 3-4 "common" triggers (will happen many times — ${drinkWord})
- 3-4 "moderate" triggers (happen a few times — ${drinkWord} x2)
- 2-3 "rare" triggers (might happen once — finish your drink/take a big handful)
- 1 "if this happens, everyone does X" rule

Return JSON only (no markdown):
{
  "rules": [
    {"trigger": "A character says a catchphrase", "action": "${drinkWord}", "frequency": "common"},
    ...
  ],
  "specialRule": "If [unlikely event], everyone [fun action]"
}` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());
    room.drinkingRules = parsed.rules || [];
    broadcast(room, { type: "drinking_rules", rules: parsed.rules, specialRule: parsed.specialRule });
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 9. SIX DEGREES ────────────────────────────────────────
app.post("/api/six-degrees", async (req, res) => {
  try {
    const { imageData, mimeType, targetActor } = req.body;

    const target = targetActor || "Kevin Bacon";

    const result = await gemini().generateContent([
      ...(imageData ? [{ inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } }] : []),
      { text: `${imageData ? "Identify the actor in this image, then find" : "Find"} the shortest connection chain from ${imageData ? "this actor" : "the identified actor"} to ${target} through shared movie/TV appearances.

Return JSON only (no markdown):
{
  "startActor": "Identified Actor Name",
  "targetActor": "${target}",
  "degrees": 3,
  "chain": [
    {"actor": "Actor A", "sharedWork": "Movie Title (Year)", "withActor": "Actor B"},
    {"actor": "Actor B", "sharedWork": "Movie Title (Year)", "withActor": "Actor C"},
    {"actor": "Actor C", "sharedWork": "Movie Title (Year)", "withActor": "${target}"}
  ],
  "funFact": "Interesting connection fact"
}` }
    ]);

    res.json(parseGeminiJSON(result.response.text()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 10. PREDICTION MARKET ─────────────────────────────────
app.post("/api/predictions/generate", async (req, res) => {
  try {
    const { movieTitle, genre, roomCode } = req.body;

    const context = movieTitle ? `for "${movieTitle}"` : genre ? `for a ${genre} movie` : "for a movie";

    const result = await gemini().generateContent([
      { text: `Generate 8-10 pre-movie prediction questions ${context} for a group guessing game. Each should be a yes/no or multiple-choice question about what will happen during the movie.

Mix of specific plot predictions and general observations:
- Will a character die? Who dies first?
- Will there be a twist ending?
- Will there be a romance subplot?
- Will a specific trope appear?
- Over/under on specific counts

Return JSON only (no markdown):
{
  "predictions": [
    {"question": "Who dies first?", "type": "multiple_choice", "options": ["The mentor", "The comic relief", "Nobody dies", "The villain"], "points": 10},
    {"question": "Will there be a post-credits scene?", "type": "yes_no", "points": 5},
    ...
  ]
}` }
    ]);

    const parsed = parseGeminiJSON(result.response.text());

    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        room.predictions.clear();
        broadcast(room, { type: "predictions_start", predictions: parsed.predictions });
      }
    }

    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/predictions/score", async (req, res) => {
  try {
    const { roomCode, answers } = req.body; // answers: [{questionIdx, correctAnswer}]
    const room = rooms.get(roomCode);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const results = [];
    room.predictions.forEach((playerPreds, name) => {
      let score = 0;
      answers.forEach((ans) => {
        if (playerPreds[ans.questionIdx] === ans.correctAnswer) {
          score += 10;
          const player = room.players.get(name);
          if (player) player.score += 10;
        }
      });
      results.push({ name, correctCount: score / 10 });
    });

    const reveal = { type: "predictions_reveal", results, scoreboard: getScoreboard(room) };
    broadcast(room, reveal);
    res.json(reveal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 11. QUOTE CATCHER ─────────────────────────────────────
app.post("/api/quote", async (req, res) => {
  try {
    const { imageData, mimeType, movieContext } = req.body;

    const contextNote = movieContext ? `This is from "${movieContext}".` : "";

    const result = await gemini().generateContent([
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageData } },
      { text: `Look at this image from a movie/TV screen. ${contextNote}
If you can see subtitles or dialogue, identify the quote.

Return JSON only (no markdown):
{
  "quoteFound": true,
  "quote": "The exact quote",
  "speaker": "Character name",
  "movie": "Movie/Show Title (Year)",
  "isFamous": true,
  "quotabilityScore": 8,
  "context": "What's happening when this line is said",
  "culturalImpact": "How this quote is used in pop culture (if famous)",
  "similarQuotes": ["Similar famous quote - Movie (Year)", ...]
}
Or: {"quoteFound":false,"reasoning":"Why I couldn't find a quote"}` }
    ]);

    res.json(parseGeminiJSON(result.response.text()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Download Request (Arr integration) ─────────────────────
app.post("/api/request", async (req, res) => {
  try {
    const { title, year, type, pin, tmdbId } = req.body;
    const isAdmin = pin === ADMIN_PIN;

    if (isAdmin) {
      const result = await addToArr(title, year, type, tmdbId);
      return res.json({ status: "added", message: `Added "${title}" to ${type === "movie" ? "Radarr" : "Sonarr"}` });
    } else {
      const id = ++reqCounter;
      downloadQueue.set(id, { title, year, type, tmdbId, user: "guest", timestamp: new Date().toISOString() });
      return res.json({ status: "pending", message: `"${title}" queued for admin approval`, requestId: id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/pending", (req, res) => {
  if (req.query.pin !== ADMIN_PIN) return res.status(403).json({ error: "Not authorized" });
  const pending = [];
  downloadQueue.forEach((v, k) => pending.push({ id: k, ...v }));
  res.json(pending);
});

app.post("/api/approve/:id", async (req, res) => {
  if (req.body.pin !== ADMIN_PIN) return res.status(403).json({ error: "Not authorized" });
  const request = downloadQueue.get(parseInt(req.params.id));
  if (!request) return res.status(404).json({ error: "Not found" });
  if (req.body.action === "approve") {
    await addToArr(request.title, request.year, request.type, request.tmdbId);
    downloadQueue.delete(parseInt(req.params.id));
    return res.json({ status: "approved" });
  }
  downloadQueue.delete(parseInt(req.params.id));
  res.json({ status: "denied" });
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function parseGeminiJSON(text) {
  try {
    const cleaned = text.trim().replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  } catch {
    return { error: "Could not parse response", raw: text.substring(0, 500) };
  }
}

async function checkPlex(title, year) {
  if (!process.env.PLEX_URL || !process.env.PLEX_TOKEN) return false;
  try {
    const url = `${process.env.PLEX_URL}/search?query=${encodeURIComponent(title)}&X-Plex-Token=${process.env.PLEX_TOKEN}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await resp.json();
    return (data?.MediaContainer?.Metadata || []).some(r =>
      r.title.toLowerCase() === title.toLowerCase() && (!year || r.year === year)
    );
  } catch { return false; }
}

async function checkRadarr(title, year) {
  if (!process.env.RADARR_URL || !process.env.RADARR_API_KEY) return false;
  try {
    const resp = await fetch(`${process.env.RADARR_URL}/api/v3/movie?apikey=${process.env.RADARR_API_KEY}`);
    const movies = await resp.json();
    return movies.some(m => m.title.toLowerCase() === title.toLowerCase() && (!year || m.year === year));
  } catch { return false; }
}

async function checkSonarr(title) {
  if (!process.env.SONARR_URL || !process.env.SONARR_API_KEY) return false;
  try {
    const resp = await fetch(`${process.env.SONARR_URL}/api/v3/series?apikey=${process.env.SONARR_API_KEY}`);
    const series = await resp.json();
    return series.some(s => s.title.toLowerCase() === title.toLowerCase());
  } catch { return false; }
}

async function addToArr(title, year, type, tmdbId) {
  if (type === "movie") {
    const results = await (await fetch(`${process.env.RADARR_URL}/api/v3/movie/lookup?term=${encodeURIComponent(title + " " + (year||""))}&apikey=${process.env.RADARR_API_KEY}`)).json();
    const match = tmdbId ? results.find(r => r.tmdbId === tmdbId) : results[0];
    if (!match) throw new Error(`Not found in TMDB: "${title}"`);
    return (await fetch(`${process.env.RADARR_URL}/api/v3/movie?apikey=${process.env.RADARR_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: match.title, tmdbId: match.tmdbId, year: match.year, qualityProfileId: 1, rootFolderPath: "/data/media/movies", monitored: true, addOptions: { searchForMovie: true } })
    })).json();
  } else {
    const results = await (await fetch(`${process.env.SONARR_URL}/api/v3/series/lookup?term=${encodeURIComponent(title)}&apikey=${process.env.SONARR_API_KEY}`)).json();
    const match = results[0];
    if (!match) throw new Error(`Not found in TVDB: "${title}"`);
    return (await fetch(`${process.env.SONARR_URL}/api/v3/series?apikey=${process.env.SONARR_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: match.title, tvdbId: match.tvdbId, qualityProfileId: 1, rootFolderPath: "/data/media/tv", monitored: true, addOptions: { searchForMissingEpisodes: true } })
    })).json();
  }
}

// ─── Cleanup stale rooms every hour ─────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000; // 4 hours
  rooms.forEach((room, code) => { if (room.createdAt < cutoff) rooms.delete(code); });
}, 60 * 60 * 1000);

// ─── Start ──────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Snap & Grab v2 running at http://localhost:${PORT}`);
  console.log(`WebSocket on same port. Admin PIN: ${ADMIN_PIN.substring(0,2)}**`);
});
