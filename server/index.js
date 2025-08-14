// index.js (updated)

require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const speech = require("@google-cloud/speech");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------- CORS (FIXED) -------------------- */
// 🔧 Use a function so cors echoes Access-Control-Allow-Origin for whitelisted sites
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://speech-to-text-frontend-ashen.vercel.app",
]);

const corsOptions = (req, cb) => {
  const origin = req.header("Origin");

  // Base options used for all requests
  const base = {
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // cache preflight for a day
  };

  // Allow server-to-server (no Origin header)
  if (!origin) return cb(null, { ...base, origin: true });

  // Only allow exact matches from our list
  const isAllowed = allowedOrigins.has(origin);
  return cb(null, { ...base, origin: isAllowed });
};

// Must be BEFORE any routes/multer
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle all preflight requests
/* ------------------------------------------------------ */

// Parse JSON for non-multipart routes (safe to have even with multer)
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Created uploads directory");
} else {
  console.log("Uploads directory already exists");
}

// Google Speech Client
console.log(
  "Using Google Credentials at:",
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-credentials.json"
);
const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-credentials.json",
});

// Supabase (service_role key recommended on server)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["audio/mpeg", "audio/wav", "audio/mp3"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

// Health check
app.get("/", (req, res) => res.send("API is running..."));

// Transcribe route
app.post(
  "/transcribe",
  (req, res, next) => {
    upload.single("audio")(req, res, function (err) {
      if (err) {
        console.error("Multer error:", err.message);
        return res.status(400).json({ error: err.message });
      }
      console.log("Received POST /transcribe from origin:", req.headers.origin);
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      console.log("Uploaded file:", filePath);

      const audioBytes = fs.readFileSync(filePath).toString("base64");
      console.log("Transcribing:", fileName);

      const request = {
        audio: { content: audioBytes },
        config: {
          encoding: "MP3", // works for .mp3; Google can auto-detect, but we keep as-is
          sampleRateHertz: 16000,
          languageCode: "en-US",
        },
      };

      let transcription;
      try {
        const [response] = await client.recognize(request);
        transcription = response.results
          .map((r) => r.alternatives[0].transcript)
          .join("\n");
        console.log("Transcription result:", transcription);
      } catch (apiErr) {
        console.error("Google API Error:", apiErr);
        return res.status(500).json({ error: "Speech-to-Text failed" });
      } finally {
        // cleanup uploaded file
        fs.unlink(filePath, () => {});
      }

      if (!transcription) return res.status(500).json({ error: "No speech detected" });

      const { data, error } = await supabase
        .from("audio_files")
        .insert([{ file_name: fileName, transcription, user_id: req.body.user_id }])
        .select();

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ error: "Failed to save transcription" });
      }

      console.log("Saved to Supabase:", data);
      res.json({ message: "Success", transcription });
    } catch (err) {
      console.error("General error:", err.message);
      res.status(500).json({ error: err.message || "Unknown error" });
    }
  }
);

// Fetch previous transcriptions
app.get("/transcriptions/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from("audio_files")
    .select("id, file_name, transcription, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch transcriptions" });
  }
  res.json({ message: "Success", transcriptions: data });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
