const { app, BrowserWindow, ipcMain, Tray, Menu, shell, globalShortcut, screen, dialog, powerMonitor } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const express = require('express');
const axios = require('axios');
const os = require('os');
const fs = require('fs');

// Load environment variables from .env or API_Keys.env
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} else {
    require('dotenv').config({ path: path.join(__dirname, 'API_Keys.env') });
}

// Configuration - Now using environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PORT = 3737;
const PYTHON_PORT = 5000;

// Validate API keys on startup
if (!GEMINI_API_KEY) {
    console.error('⚠️  WARNING: GEMINI_API_KEY not found in API_Keys.env or .env file');
}

let mainWindow;
let tray;
let pythonProcess;
let expressApp;
const platform = process.platform;

// Start Python voice service
function startPythonService() {
    console.log('🐍 Starting Python voice service...');
    const pythonScript = path.join(__dirname, 'voice_service_v6.py');
    pythonProcess = spawn('python', [pythonScript], { stdio: 'inherit', shell: true });
    pythonProcess.on('error', (err) => console.error('❌ Python service error:', err));
    pythonProcess.on('exit', (code) => console.log(`🐍 Python service exited with code ${code}`));
    console.log('✅ Python service started');
}

// Create Express server
function createExpressServer() {
    expressApp = express();
    expressApp.use(express.json({ limit: '50mb' }));

    // AI Query endpoint
    expressApp.post('/api/query', async (req, res) => {
        try {
            const { query, taskType, screenshot, fileData, fileName, fileType, forceModel } = req.body;

            // Check if it's an AI system command - PRIORITY CHECK
            const commandResult = await handleSystemCommand(query);
            if (commandResult.handled) {
                return res.json({ success: true, response: commandResult.message, isCommand: true });
            }

            // Route to appropriate AI (using 1.5 models for maximum backwards compatibility with older API keys)
            let model = "gemini-1.5-flash"; // Default
            if (query.toLowerCase().match(/use pro|switch to pro|with pro|gemini pro/i) || forceModel === 'pro') {
                model = "gemini-1.5-pro";
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            let payload;

            // Handle file upload or screenshot
            if (fileData || screenshot) {
                const parts = [{ text: query }];
                if (fileData) {
                    parts.push({ inline_data: { mime_type: fileType, data: fileData } });
                } else if (screenshot) {
                    parts.push({ inline_data: { mime_type: "image/jpeg", data: screenshot } });
                }
                payload = { contents: [{ parts }] };
            } else {
                payload = { contents: [{ parts: [{ text: query }] }] };
            }

            const response = await axios.post(url, payload, { timeout: 30000 });

            if (response.status === 200) {
                const text = response.data.candidates[0].content.parts[0].text;
                res.json({ success: true, response: text, modelUsed: model });
            } else {
                res.json({ success: false, error: `API Error: ${response.status}` });
            }
        } catch (error) {
            console.error('API Error:', error.message);
            res.json({ success: false, error: error.message });
        }
    });

    expressApp.listen(PORT, () => {
        console.log(`✅ Backend server running on port ${PORT}`);
    });
}

// ==================== SYSTEM CONTROL FUNCTIONS ====================

async function handleSystemCommand(query) {
    const lowerQuery = query.toLowerCase();

    // ===== VOLUME CONTROL =====
    if (lowerQuery.match(/volume\s+(up|down|increase|decrease|mute|unmute|set.*\d+)/i)) {
        return await handleVolumeControl(lowerQuery);
    }

    // ===== BRIGHTNESS CONTROL =====
    if (lowerQuery.match(/brightness\s+(up|down|increase|decrease|set.*\d+)/i)) {
        return await handleBrightnessControl(lowerQuery);
    }

    // ===== WIFI/BLUETOOTH =====
    if (lowerQuery.match(/(turn|switch|toggle)\s+(on|off)?\s*(wifi|wireless|bluetooth|bt)/i)) {
        return await handleNetworkToggle(lowerQuery);
    }

    // ===== POWER OPTIONS =====
    if (lowerQuery.match(/shutdown|restart|sleep|hibernate|lock|log\s*off|sign\s*out/i)) {
        return await handlePowerCommand(lowerQuery);
    }

    // ===== FILE OPERATIONS =====
    if (lowerQuery.match(/open\s+(?:file\s+explorer|files|explorer)/i)) {
        return await handleFileOperation(lowerQuery);
    }

    // ===== SEARCH FILES =====
    if (lowerQuery.match(/search\s+(for\s+)?(file|folder|document)/i) || lowerQuery.match(/find.*file/i)) {
        return await handleFileSearch(lowerQuery);
    }

    // ===== MEDIA CONTROL =====
    if (lowerQuery.match(/play|pause|stop|next|previous|skip|media/i)) {
        return await handleMediaControl(lowerQuery);
    }

    // ===== OPEN WEBSITES =====
    if (lowerQuery.match(/open\s+(youtube|google|facebook|twitter|instagram|github)/i)) {
        return await handleWebsite(lowerQuery);
    }

    // ===== SEARCH WEB =====
    if (lowerQuery.match(/search\s+(?:for\s+)?(.+)|google\s+(.+)/i)) {
        return await handleWebSearch(lowerQuery);
    }

    // ===== OPEN APPLICATIONS =====
    if (lowerQuery.match(/(?:open|launch|start)\s+(?:the\s+)?(\w+)/i)) {
        return await handleApplication(lowerQuery);
    }

    // ===== NETWORK STATUS =====
    if (lowerQuery.match(/network\s+status|check\s+network|internet\s+speed|wifi\s+status/i)) {
        return await handleNetworkStatus();
    }

    return { handled: false };
}

// VOLUME CONTROL
async function handleVolumeControl(query) {
    let command;

    if (platform === 'win32') {
        if (query.includes('up') || query.includes('increase')) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]175)"';
        } else if (query.includes('down') || query.includes('decrease')) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]174)"';
        } else if (query.includes('mute')) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"';
        } else if (query.match(/set.*(\d+)/)) {
            const level = query.match(/(\d+)/)[1];
            command = `powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]173); Start-Sleep -Milliseconds 100; [Math]::Round(${level}/2) | ForEach-Object { (New-Object -ComObject WScript.Shell).SendKeys([char]175) }"`;
        }
    } else if (platform === 'darwin') {
        if (query.includes('up') || query.includes('increase')) {
            command = 'osascript -e "set volume output volume (output volume of (get volume settings) + 10)"';
        } else if (query.includes('down') || query.includes('decrease')) {
            command = 'osascript -e "set volume output volume (output volume of (get volume settings) - 10)"';
        } else if (query.includes('mute')) {
            command = 'osascript -e "set volume output muted true"';
        } else if (query.includes('unmute')) {
            command = 'osascript -e "set volume output muted false"';
        }
    }

    if (command) {
        exec(command);
        return { handled: true, message: '🔊 Volume adjusted' };
    }
    return { handled: false };
}

// BRIGHTNESS CONTROL
async function handleBrightnessControl(query) {
    let command;

    if (platform === 'win32') {
        if (query.includes('up') || query.includes('increase')) {
            command = 'powershell (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,100)';
        } else if (query.includes('down') || query.includes('decrease')) {
            command = 'powershell (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,20)';
        }
    } else if (platform === 'darwin') {
        // macOS brightness control requires third-party tools
        return { handled: true, message: '💡 Brightness control requires manual adjustment on macOS' };
    }

    if (command) {
        exec(command);
        return { handled: true, message: '💡 Brightness adjusted' };
    }
    return { handled: false };
}

// WIFI/BLUETOOTH TOGGLE
async function handleNetworkToggle(query) {
    let command;
    const action = query.match(/turn\s+(on|off)/i)?.[1] || 'toggle';

    if (platform === 'win32') {
        if (query.match(/wifi|wireless/i)) {
            if (action === 'on') {
                command = 'netsh interface set interface "Wi-Fi" enable';
            } else if (action === 'off') {
                command = 'netsh interface set interface "Wi-Fi" disable';
            }
        } else if (query.match(/bluetooth|bt/i)) {
            // Windows Bluetooth toggle (requires admin)
            command = 'powershell -command "Start-Process ms-settings:bluetooth"';
            exec(command);
            return { handled: true, message: '📶 Opening Bluetooth settings...' };
        }
    }

    if (command) {
        exec(command, (error) => {
            if (error) console.log('Network toggle may require admin privileges');
        });
        return { handled: true, message: `📶 Wi-Fi ${action === 'on' ? 'enabled' : 'disabled'}` };
    }
    return { handled: false };
}

// POWER COMMANDS
async function handlePowerCommand(query) {
    let command;
    let message;

    if (platform === 'win32') {
        if (query.includes('shutdown')) {
            command = 'shutdown /s /t 30';
            message = '⚠️ PC will shutdown in 30 seconds. Run "shutdown /a" to cancel.';
        } else if (query.includes('restart')) {
            command = 'shutdown /r /t 30';
            message = '⚠️ PC will restart in 30 seconds. Run "shutdown /a" to cancel.';
        } else if (query.includes('sleep')) {
            command = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
            message = '😴 Putting PC to sleep...';
        } else if (query.includes('hibernate')) {
            command = 'shutdown /h';
            message = '😴 Hibernating PC...';
        } else if (query.includes('lock')) {
            command = 'rundll32.exe user32.dll,LockWorkStation';
            message = '🔒 Locking PC...';
        } else if (query.match(/log\s*off|sign\s*out/)) {
            command = 'shutdown /l';
            message = '👋 Logging off...';
        }
    } else if (platform === 'darwin') {
        if (query.includes('shutdown')) {
            command = 'osascript -e \'tell app "System Events" to shut down\'';
            message = '⚠️ Mac will shutdown...';
        } else if (query.includes('restart')) {
            command = 'osascript -e \'tell app "System Events" to restart\'';
            message = '⚠️ Mac will restart...';
        } else if (query.includes('sleep')) {
            command = 'pmset sleepnow';
            message = '😴 Putting Mac to sleep...';
        } else if (query.includes('lock')) {
            command = '/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend';
            message = '🔒 Locking Mac...';
        }
    }

    if (command) {
        exec(command);
        return { handled: true, message };
    }
    return { handled: false };
}

// FILE OPERATIONS
async function handleFileOperation(query) {
    const command = platform === 'win32' ? 'explorer' : platform === 'darwin' ? 'open .' : 'nautilus';
    exec(command);
    return { handled: true, message: '📁 Opening File Explorer...' };
}

// FILE SEARCH
async function handleFileSearch(query) {
    const searchTerm = query.match(/(?:search|find).*?(?:for\s+)?(?:file\s+)?["']?(.+?)["']?$/i)?.[1];

    if (searchTerm && platform === 'win32') {
        const command = `powershell -command "Start-Process explorer 'search-ms:query=${searchTerm}'"`;
        exec(command);
        return { handled: true, message: `🔍 Searching for: ${searchTerm}` };
    }

    return { handled: true, message: '🔍 Opening search...' };
}

// MEDIA CONTROL
async function handleMediaControl(query) {
    let command;

    if (platform === 'win32') {
        if (query.match(/play|pause/i)) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]179)"';
        } else if (query.match(/next|skip/i)) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]176)"';
        } else if (query.match(/previous|back/i)) {
            command = 'powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]177)"';
        }
    }

    if (command) {
        exec(command);
        return { handled: true, message: '🎵 Media control executed' };
    }
    return { handled: false };
}

// SCREENSHOT
// Removed system command handler. Screenshot analysis on the frontend uses HTML5 media capture, which is fully functional.

// OPEN WEBSITES
async function handleWebsite(query) {
    const sites = {
        youtube: 'https://youtube.com',
        google: 'https://google.com',
        facebook: 'https://facebook.com',
        twitter: 'https://twitter.com',
        instagram: 'https://instagram.com',
        github: 'https://github.com'
    };

    for (const [name, url] of Object.entries(sites)) {
        if (query.includes(name)) {
            await shell.openExternal(url);
            return { handled: true, message: `✅ Opening ${name.charAt(0).toUpperCase() + name.slice(1)}...` };
        }
    }
    return { handled: false };
}

// WEB SEARCH
async function handleWebSearch(query) {
    const searchQuery = query.match(/(?:search\s+(?:for\s+)?|google\s+)(.+)/i)?.[1];
    if (searchQuery) {
        await shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
        return { handled: true, message: `🔍 Searching: ${searchQuery}` };
    }
    return { handled: false };
}

// OPEN APPLICATIONS
async function handleApplication(query) {
    const match = query.match(/(?:open|launch|start)\s+(?:the\s+)?(\w+)/i);
    if (!match) return { handled: false };

    const appName = match[1].toLowerCase();
    let command;

    const apps = {
        win32: {
            notepad: 'notepad.exe',
            calculator: 'calc.exe',
            paint: 'mspaint.exe',
            explorer: 'explorer.exe',
            cmd: 'cmd.exe',
            powershell: 'powershell.exe',
            chrome: 'start chrome',
            firefox: 'start firefox',
            edge: 'start msedge',
            vscode: 'code',
            spotify: 'start spotify',
            discord: 'start discord',
            teams: 'start teams',
            outlook: 'start outlook',
            word: 'start winword',
            excel: 'start excel',
            powerpoint: 'start powerpnt'
        },
        darwin: {
            notepad: 'open -a TextEdit',
            calculator: 'open -a Calculator',
            safari: 'open -a Safari',
            chrome: 'open -a "Google Chrome"',
            firefox: 'open -a Firefox',
            vscode: 'open -a "Visual Studio Code"',
            spotify: 'open -a Spotify',
            terminal: 'open -a Terminal'
        }
    };

    command = apps[platform]?.[appName] || `start ${appName}`;

    return new Promise((resolve) => {
        exec(command, (error) => {
            if (error) {
                resolve({ handled: true, message: `❌ Could not open ${appName}` });
            } else {
                resolve({ handled: true, message: `✅ Opening ${appName}...` });
            }
        });
    });
}

// NETWORK STATUS
async function handleNetworkStatus() {
    const networkInfo = os.networkInterfaces();
    const connected = Object.values(networkInfo).flat().some(iface => !iface.internal && iface.family === 'IPv4');
    return { handled: true, message: connected ? '✅ Network connected' : '❌ Network disconnected' };
}

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        frame: true,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create system tray
function createTray() {
    const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(trayIconPath);
    tray.setToolTip('ALEXUS V5 - AI Assistant');
    updateTrayMenu('idle');

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function updateTrayMenu(status = 'idle') {
    const contextMenu = Menu.buildFromTemplate([
        { label: '⚡ ALEXUS V5', enabled: false },
        { label: `Status: ${status.toUpperCase()}`, enabled: false },
        { type: 'separator' },
        { label: '🖥️  Show Window', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { label: '🎤 Toggle Voice', click: () => { if (mainWindow) mainWindow.webContents.send('toggle-voice-mode'); } },
        { label: '📸 Analyze Screen', click: () => { if (mainWindow) mainWindow.webContents.send('analyze-screen'); } },
        { type: 'separator' },
        { label: '➕ New Session', click: () => { if (mainWindow) mainWindow.webContents.send('create-new-session'); } },
        { type: 'separator' },
        { label: '❌ Quit ALEXUS', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
}

// Register global shortcuts
function registerGlobalShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+A', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
        }
    });

    globalShortcut.register('CommandOrControl+Shift+V', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('toggle-voice-mode');
        }
    });
}

// IPC handlers
ipcMain.handle('get-api-status', () => {
    return GEMINI_API_KEY !== '' && GEMINI_API_KEY !== undefined;
});

ipcMain.handle('upload-file', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
            { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'] },
            { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] }
        ]
    });

    if (result.canceled) return { success: false, canceled: true };

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    const fileBuffer = fs.readFileSync(filePath);
    const fileData = fileBuffer.toString('base64');

    const mimeTypes = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
        '.webp': 'image/webp', '.bmp': 'image/bmp', '.mp4': 'video/mp4', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.pdf': 'application/pdf',
        '.txt': 'text/plain'
    };

    const fileType = mimeTypes[fileExt] || 'application/octet-stream';
    const isImage = fileType.startsWith('image/');

    return { success: true, fileName, fileType, fileData, filePath, isImage };
});

// save-image handler removed (Image generation features disabled)

ipcMain.on('update-tray-status', (event, status) => {
    updateTrayMenu(status);
});

// App lifecycle
app.whenReady().then(() => {
    console.log('='.repeat(60));
    console.log('  🚀 ALEXUS V5 - FULL SYSTEM CONTROL');
    console.log('='.repeat(60));
    console.log(`  API Keys: ${GEMINI_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
    console.log('='.repeat(60));
    startPythonService();
    createExpressServer();
    createWindow();
    createTray();
    registerGlobalShortcuts();
    console.log('✅ ALEXUS fully initialized');
    console.log('='.repeat(60));
});

app.on('window-all-closed', () => {
    if (platform !== 'darwin') {
        // Keep running in tray
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (pythonProcess) pythonProcess.kill();
    globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});