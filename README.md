# TexttoSpeech Backend

This is the **backend server** for the **TexttoSpeechBackend** application, built with Node.js and Express. It handles audio file uploads, integrates with Google Cloud's Speech-to-Text API for transcription, and stores results in Supabase. Authentication and user management are also powered by Supabase.


## Features

* Accepts `.mp3` and `.wav` audio file uploads via `POST /transcribe`
* Transcribes speech to text using Google Cloud Speech-to-Text API
* Stores transcription results per user in Supabase
* Fetch transcription history using `GET /transcriptions/:user_id`
* Middleware includes CORS, Multer for file upload handling, and dotenv for environment config
* Designed to support both local development and Render deployment


## Tech Stack

* **Node.js + Express** – Backend server and API routes
* **Google Cloud Speech-to-Text API** – Audio transcription engine
* **Supabase** – Used for:

  * **Authentication** (email/password-based)
  * **PostgreSQL Database** (transcription history)
* **Multer** – File upload middleware
* **CORS** – Enables cross-origin requests for frontend-backend integration
* **Render** – Deployment of backend server


## Folder Structure

```
/server
  ├── index.js                  # Main Express server file
  ├── uploads/                  # Temporary folder for uploaded audio files
  ├── .env                      # Environment variables (not committed)
  └── google-credentials.json   # Google Cloud service account credentials
```


## Setup Instructions

### A. Prerequisites

Ensure the following are ready before setup:

1. **Node.js**

   * Version 18 or above is recommended.
   * Verify installation:

     ```bash
     node -v
     npm -v
     ```

2. **Supabase Account**

   * Create a project at [https://supabase.com](https://supabase.com)
   * Enable Authentication and Database
   * Get:

     * Supabase URL
     * Supabase Anon Key

3. **Google Cloud Account**

   * Enable the **Speech-to-Text API**
   * Create a **service account key** (JSON format)
   * Download it as `google-credentials.json`

---

### B. Backend Setup

1. Navigate to the server folder:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Add a `.env` file in the root of `/server`:

   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json
   ```

4. Place your downloaded `google-credentials.json` file inside the `/server` directory.

5. Start the backend server:

   ```bash
   node index.js
   ```

   Server runs on: `http://localhost:5000`


## API Endpoints

### POST `/transcribe`

Transcribes uploaded audio and stores the result.

* **Request:**
  `multipart/form-data` with fields:

  * `audio`: Audio file (`.mp3`, `.wav`)
  * `user_id`: Supabase user ID

* **Response:**

  ```json
  {
    "transcription": "Transcribed text here"
  }
  ```

### GET `/transcriptions/:user_id`

Returns all saved transcriptions for a specific user.

* **Response:**

  ```json
  {
    "transcriptions": [
      {
        "id": 1,
        "file_name": "audio.wav",
        "transcription": "Text here...",
        "created_at": "2025-07-29T10:00:00Z"
      }
    ]
  }
  ```


## Deployment (Render)

1. Push backend folder to a GitHub repo
2. Go to [https://render.com](https://render.com)
3. Click **New Web Service** and link the backend repo
4. Configure:

   * **Build Command:**

     ```bash
     npm install
     ```
   * **Start Command:**

     ```bash
     node index.js
     ```

5. Add the following environment variables in Render:

   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json
   ```

6. Upload the `google-credentials.json` via Render's dashboard or use persistent storage for runtime access.


## Testing

You can test the backend independently using **Postman** or **cURL**:

### Transcription Upload:

```bash
curl -X POST http://localhost:5000/transcribe \
  -F "audio=@/path/to/file.mp3" \
  -F "user_id=your_supabase_user_id"
```

### Fetch History:

```bash
curl http://localhost:5000/transcriptions/your_supabase_user_id
```


## Future Improvements

* Integrate file size limits and automatic file cleanup
* Add transcription language options
* Add rate-limiting and error monitoring
