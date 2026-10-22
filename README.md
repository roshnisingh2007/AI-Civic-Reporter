# AI Civic Reporter

An AI-powered civic issue reporting, management, and tracking platform built with a **Python (Flask + SQLite)** backend and responsive modern frontend.

Citizens can report civic issues (such as potholes, overflowing garbage, broken streetlights, water leakages), attach photos, and capture GPS locations. Municipal authorities can monitor and manage incoming complaints in real time via the **Admin Dashboard**.

---

## 🌟 Key Features

1. **Python Flask Backend (`app.py`)**:
   - Persistent SQLite Database (`civic_reporter.db`).
   - RESTful API endpoints for complaints, real-time status updates, filtering, and stats.
   - Multipart photo uploads saved to `uploads/`.
   - Built-in AI analysis heuristic to prioritize civic hazards (High, Medium, Low).

2. **Admin Dashboard (`admin.html`)**:
   - Live overview of Total, Pending, In Progress, and Resolved complaints.
   - Instant search by Complaint ID, citizen name, location, or keywords.
   - Live filter by Status, Category, and AI Priority level.
   - Inline status updates (Pending ➔ In Progress ➔ Resolved) saved directly to the database.
   - Detail modal to view full problem description, citizen details, location, and photos.
   - Delete complaint capability with confirmation.

3. **Citizen Reporting (`report.html`)**:
   - Instant AI Priority and Category suggestion preview.
   - Image upload with live preview.
   - 1-click GPS location detection.
   - Generates a unique Complaint ID (e.g., `#CR1042`).

4. **Live Complaint Tracking (`track.html`)**:
   - Search status by Complaint ID.
   - Visual 3-stage progress stepper (Reported ➔ In Progress ➔ Resolved).
   - Full details and photo view.

---

## 🚀 How to Run the Project

### Prerequisites
- Python 3.8+ installed (`py` or `python`)

### Local Execution

1. **Install Dependencies:**
   ```bash
   py -m pip install -r requirements.txt
   ```

2. **Start the Python Backend Server:**
   ```bash
   py app.py
   ```

3. **Open the Application in your Browser:**
   - **Citizen Portal (Home):** [http://127.0.0.1:5000/index.html](http://127.0.0.1:5000/index.html)
   - **Report an Issue:** [http://127.0.0.1:5000/report.html](http://127.0.0.1:5000/report.html)
   - **Track Complaint:** [http://127.0.0.1:5000/track.html](http://127.0.0.1:5000/track.html)
   - **Admin Dashboard:** [http://127.0.0.1:5000/admin.html](http://127.0.0.1:5000/admin.html)

---

## ☁️ Deploy to Vercel (1-Click)

The project is fully pre-configured for Vercel Serverless deployment with `vercel.json` and `api/index.py`:

1. **Push your code to GitHub:**
   Commit all updated files to your repository (`roshnisingh2007/AI-Civic-Reporter`).
2. **Go to [Vercel](https://vercel.com):**
   Log in with GitHub.
3. **Import Project:**
   Click **"Add New..."** ➔ **"Project"** ➔ Select `AI-Civic-Reporter`.
4. **Deploy:**
   Click **"Deploy"** (no custom settings needed, Vercel automatically detects Python serverless function and static assets).
5. Your app will be live at `https://your-project-name.vercel.app`!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/complaints` | Get all complaints (supports `?status=`, `?category=`, `?search=`) |
| `GET` | `/api/complaints/<id>` | Get details of a single complaint |
| `POST` | `/api/complaints` | Submit a new complaint (multipart/form-data or JSON) |
| `PATCH` | `/api/complaints/<id>/status` | Update complaint status (`Pending`, `In Progress`, `Resolved`) |
| `DELETE` | `/api/complaints/<id>` | Delete a complaint |
| `GET` | `/api/stats` | Get counts (total, pending, in progress, resolved) |
| `POST` | `/api/ai/analyze` | AI analysis heuristic preview for issue descriptions |
