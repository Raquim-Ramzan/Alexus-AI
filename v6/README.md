# ⚡ ALEXUS V6 — JARVIS-Style Desktop AI Assistant

**ALEXUS** is an immersive, cross-platform desktop AI assistant that brings science-fiction to life. Built on a native **Electron** shell with a holographic **Three.js** 3D engine, ALEXUS connects standard chat interactions with deep **Operating System Automation**, **Multimodal Media Analysis**, and a **Localized Voice-to-Voice pipeline**.

Developed with portfolio-grade architecture, ALEXUS utilizes a multi-process model to execute system scripts, stream audio, and process high-reasoning computer vision tasks concurrently without blocking the UI thread.

---

## 🏗️ Technical Architecture & Process Model

ALEXUS relies on a decoupled, secure, and resilient three-process architecture:

```
                  ┌─────────────────────────────────────┐
                  │      ELECTRON DESKTOP SHELL         │ (Main Thread)
                  │  (Tray, Window & Shortcut Manager)  │
                  └──────────────┬───────────────▲──────┘
                                 │               │
                    Secured IPC  │               │ Context Bridge
                    Bridge       │               │ (preload.js)
                                 ▼               │
                  ┌──────────────────────────────┴──────┐
                  │       HOLOGRAPHIC 3D HUD            │ (Renderer Thread)
                  │ (Three.js Particle Sphere Shaders)  │
                  └──────────────┬───────────────▲──────┘
                                 │               │
                Native Media RTC │               │ Local HTTP API
                  (base64 stream)│               │ (localhost:3737)
                                 ▼               │
   ┌─────────────────────────────────────────────┴────────────────────────┐
   │                        LOCAL EXPRESS CONTROLLER                      │
   │  - Matches system-level commands (PowerShell, AppleScript, Exec)    │
   │  - Routes chat, attachments, & media to Gemini Multimodal API       │
   └─────────────────────────────────────┬────────────────────────────────┘
                                         │
                    Local HTTP Loop      │
                    (localhost:5000)     │
                                         ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                     PYTHON FLASK VOICE ENGINE                        │
   │  - Speech Recognition: Captures microphone inputs                    │
   │  - Audio Output Mixer: Plays gTTS synthesized voices via Pygame     │
   └──────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Production-Ready Feature Suite

This repository features only **fully implemented, completely coded native capabilities** (all mock/ghost features have been pruned):

### 🌐 1. Holographic 3D HUD Visualization
* **Three.js Core**: Houses a custom WebGL vertex and fragment shader 3D sphere.
* **Intelligent Audio-Pulses**: Shaders dynamically increase their pulsation, particle orbit velocities, and neon cyan glow intensity in real-time depending on the assistant's state (`READY`, `LISTENING`, `PROCESSING`, `SPEAKING`).

### 💻 2. Deep OS & Desktop Automation (Windows & macOS)
Interprets text prompts and triggers native shell operations instantly:
* **Audio Engineering**: Increase, decrease, or mute the master system volume.
* **Display Controls**: Alter display brightness on Windows using WMI methods.
* **Network Toggles**: Disable or enable active Wi-Fi adapters natively.
* **Power Automation**: Safe, automated shutdown timer, reboots, sleeps, and locks screen workstation.
* **Media Sync**: Virtual key injection to trigger play, pause, next track, and previous track system-wide.
* **App Launcher**: Instant launch of system-level tools (Notepad, Calculator, Command Prompt) and standard user applications (VS Code, Chrome, Spotify, Discord).

### 🎤 3. Local Voice-to-Voice Loop
* **Hands-Free Hearing**: Microphone listening is offloaded to a background Python subprocess utilizing Google's Speech Recognition framework, checking for the wake phrase (*"Hey Alexus"*).
* **Smooth Local Speaking**: Responses to voice commands are generated in standard audio files using Google Text-to-Speech (`gTTS`) and broadcast natively using the low-latency Pygame audio mixer.

### 📸 4. Screen Intelligence & File Attachments
* **Browser-Level Screen Capture**: Utilizing `getDisplayMedia`, clicking the `SCREEN` button or saying *"Analyze my screen"* takes an instant frame grab, converts it to base64, and streams it to the AI brain.
* **Native File Upload Bridge**: Seamless context-menu selection of files, reading binary buffers as base64 and attaching them dynamically to your Gemini query for high-level image or document analysis.

---

## 🛠️ Installation & Getting Started

### Prerequisites
* **Node.js** (v18.x or newer)
* **Python** (v3.10.x or newer) with `pip`
* **Google Gemini API Key**

### 1. Clone & Install Dependencies
Navigate to the `v6` directory:
```bash
npm install
```

### 2. Configure Environment Variables
Create a standard `.env` file in the `v6/` root folder (this file is excluded from git commits by `.gitignore` to protect your credentials):
```env
# Google Gemini developer credentials
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Setup Python Voice Environment
Install the required python packages:
```bash
pip install flask flask-cors SpeechRecognition gTTS pygame
```
*(Make sure Pygame and SpeechRecognition have active access to your soundcard and microphone devices).*

### 4. Run the Application
Start the Electron desktop interface:
```bash
npm start
```

---

## ⚙️ Key Technologies Used
* **Desktop**: Electron, Node.js IPC, Express, Axios, child_process
* **Renderer HUD**: HTML5, Vanilla CSS, Three.js (custom fragment shaders)
* **Voice Engine**: Python 3, Flask, CORS, SpeechRecognition, gTTS, Pygame
* **AI Model Engine**: Google Gemini Developer API (using `gemini-2.5-flash` as default for speed, and `gemini-2.5-pro` for deep reasoning & screen vision)

---

## 🔒 Security Practices
* **Zero Credential Leaking**: Strictly ignores all environmental `.env`, `API_Keys.env`, and certificate configuration files from source tracking.
* **Decoupled Main-World Isolation**: Restricts Electron Main API surfaces from global window exposure using context-isolated preloads (`preload.js`), preserving host sandboxing.
