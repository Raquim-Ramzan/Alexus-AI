const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const axios = require('axios');

// Configuration
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";
const MAKE_WEBHOOK_URL = "YOUR_MAKE_WEBHOOK_URL_HERE"; // Add later
const PORT = 3737;

let mainWindow;
let expressApp;

// Create Express server for AI processing
function createExpressServer() {
    expressApp = express();
    expressApp.use(express.json({ limit: '50mb' }));

    // AI Query endpoint
    expressApp.post('/api/query', async (req, res) => {
        try {
            const { query, taskType, screenshot } = req.body;

            // If Make.com is configured, use it as main brain
            if (MAKE_WEBHOOK_URL !== "YOUR_MAKE_WEBHOOK_URL_HERE") {
                const makeResponse = await axios.post(MAKE_WEBHOOK_URL, {
                    query: query,
                    taskType: taskType,
                    screenshot: screenshot
                }, { timeout: 30000 });

                return res.json({ success: true, response: makeResponse.data.response });
            }

            // FALLBACK: Route to appropriate AI
            let response;

            // Groq for coding and math
            if (taskType === 'coding') {
                const url = 'https://api.groq.com/openai/v1/chat/completions';
                response = await axios.post(url, {
                    model: 'llama-3.1-70b-versatile',
                    messages: [{ role: 'user', content: query }],
                    temperature: 0.7,
                    max_tokens: 2048
                }, {
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });

                return res.json({
                    success: true,
                    response: response.data.choices[0].message.content
                });
            }

            // Gemini for everything else (general, vision, search)
            const model = "gemini-2.5-flash";
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

            let payload;

            if (screenshot && taskType === "vision") {
                payload = {
                    contents: [{
                        parts: [
                            { text: query },
                            { inline_data: { mime_type: "image/jpeg", data: screenshot } }
                        ]
                    }]
                };
            } else {
                payload = {
                    contents: [{
                        parts: [{ text: query }]
                    }]
                };
            }

            response = await axios.post(url, payload, { timeout: 30000 });

            if (response.status === 200) {
                const text = response.data.candidates[0].content.parts[0].text;
                res.json({ success: true, response: text });
            } else {
                res.json({ success: false, error: `API Error: ${response.status}` });
            }

        } catch (error) {
            console.error('API Error:', error.message);
            res.json({ success: false, error: error.message });
        }
    });

    expressApp.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
    });
}

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        frame: true,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Maximize on start
    mainWindow.maximize();
}

// App lifecycle
app.whenReady().then(() => {
    createExpressServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
ipcMain.handle('get-api-status', () => {
    return GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE";
});