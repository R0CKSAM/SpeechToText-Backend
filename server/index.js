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

const allowedOrigins = [
  "http://localhost:5173",
  "https://backend-test-nine-xi.vercel.app"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true
}));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Created uploads directory");
} else {
  console.log("Uploads directory already exists");
}

// Google Speech Client
console.log("Using Google Credentials at:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-credentials.json");
const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-credentials.json",
});

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Multer Setup
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

// Health Check
app.get("/", (req, res) => res.send("API is running..."));

// Transcribe Route with Middleware Error Logging
app.post("/transcribe", (req, res, next) => {
  upload.single("audio")(req, res, function (err) {
    if (err) {
      console.error("Multer error:", err.message);
      return res.status(400).json({ error: err.message });
    }
    console.log("Received POST /transcribe");
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    console.log("Uploaded file:", filePath);

    const audioBytes = fs.readFileSync(filePath).toString("base64");
    console.log("Transcribing:", fileName);

    const request = {
      audio: { content: audioBytes },
      config: { encoding: "MP3", sampleRateHertz: 16000, languageCode: "en-US" },
    };

    let transcription;
    try {
      const [response] = await client.recognize(request);
      transcription = response.results.map(r => r.alternatives[0].transcript).join("\n");
      console.log("Transcription result:", transcription);
    } catch (apiErr) {
      console.error("Google API Error:", apiErr);
      return res.status(500).json({ error: "Speech-to-Text failed" });
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
});

// Fetch Previous Transcriptions
app.get("/transcriptions/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from("audio_files")
    .select("id, file_name, transcription, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to fetch transcriptions" });
  res.json({ message: "Success", transcriptions: data });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
