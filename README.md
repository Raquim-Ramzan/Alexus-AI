# 🌌 ALEXUS — Holographic Desktop AI Assistant & OS Automation Engine

Welcome to **ALEXUS**, an immersive, science-fiction-inspired desktop AI assistant. Built on a native **Electron** shell with an interactive **Three.js** 3D holographic interface, ALEXUS connects multimodal LLMs with deep **Operating System Automation** and a **Localized Voice-to-Voice audio loop**.

This repository showcases the **evolutionary development journey** of the project—moving from a simple single-file Python script in `v1` to a fully detached, multi-process desktop workspace in `v6`.

---

## 🚀 The Evolution of ALEXUS

This portfolio repository is organized chronologically to demonstrate progression in software architecture, performance tuning, and frontend design patterns:

*   [**v1 — The Genesis**](./v1/): Initial proof-of-concept. Basic command matching and sequential text-based processing.
*   [**v2 — GUI Foundations**](./v2/): First graphical layout. Simple window loops and introductory interface styling.
*   [**v3 — Multimodal Shift**](./v3/): Initial exploration of multimedia inputs and cloud-connected AI completions.
*   [**v4 — Immersive UX**](./v4/): Implementation of the holographic glowing visualizer and smoother UI layouts.
*   [**v5 — Automation Core**](./v5/): Integration of basic OS command listeners (volume, brightness, power).
*   [**v6 — Production-Ready Stable (Latest & Recommended)**](./v6/):
    *   **Architecture**: Decoupled multi-process model (Electron Main + Preload Context Bridge + local Express Router + Flask Python Audio Subprocess).
    *   **Models**: Powered by highly compatible, ultra-fast `gemini-1.5-flash` and `gemini-1.5-pro` multimodal engines.
    *   **Core Assets**: Pruned of all mock/incomplete features, leaving a robust, bulletproof production codebase.

---

## 🏗️ Technical Architecture (v6)

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

## 🎯 Production-Ready Feature Suite (v6)

*   **Holographic WebGL HUD**: Houses a custom Three.js shader-material particle sphere that dynamically pulses and changes orbit speeds depending on the assistant's state (`READY`, `LISTENING`, `PROCESSING`, `SPEAKING`).
*   **Operating System Automation**: Native shell operations for system controls:
    *   *Volume & Brightness Control*: Modify system master volume and screen brightness natively.
    *   *Wi-Fi Toggle*: Enable or disable active Wi-Fi adapters.
    *   *System Commands*: Automated sleep, workstation locking, and shutdown triggers.
    *   *Application Launcher*: Open tools (Notepad, Command Prompt, Chrome, Spotify, VS Code, Discord) directly via voice or text.
*   **Multimodal Screen Vision**: Interactive HTML5 media stream grabber (`SCREEN` button) capturing active desktop frames, converting them to base64, and feeding them to Gemini for instantaneous vision analysis.
*   **Local Voice Loop**: Detached background listener running SpeechRecognition and synthesizing smooth responses with Google Text-to-Speech (`gTTS`) mixed natively with Pygame.

---

## 🛠️ Setup & Running ALEXUS v6

To test or run the latest stable version of ALEXUS, go to the `v6/` directory and follow these steps:

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **Python** (v3.10+) installed.

### 2. Configure Your API Key
Create a standard `.env` file in the `v6/` directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Node.js Dependencies
```bash
cd v6
npm install
```

### 4. Install Python Voice Dependencies
Activate your virtual environment (if you have one) and run:
```bash
pip install flask flask-cors SpeechRecognition gTTS pygame
```

### 5. Launch the Assistant
```bash
npm start
```
*Electron will boot up, automatically spin up the local Express API and the background Python speech engine, and launch the immersive visual interface!*

---

## 🔒 Security Practices
*   **Decoupled Context Bridges**: Maintains strict main-world isolation in `preload.js` preventing unsafe remote script execution.
*   **Zero Credential Leaking**: Excludes all environmental configuration files (`.env`, `API_Keys.env`) and compilation caches from git tracking via standard `.gitignore` rules.
