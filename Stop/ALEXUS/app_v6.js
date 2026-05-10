// ========================================
// ALEXUS V5 - Enhanced with File Upload & Image Generation
// CLEANED VERSION - No Duplicates
// ========================================

let scene, camera, renderer, sphere, particles = [];
let isListening = false;
let isSpeaking = false;
let currentSession = null;
let sessions = [];
let currentInputType = 'text';
let currentUploadedFile = null; // Store uploaded file

// ========================================
// SESSION MANAGEMENT
// ========================================

function loadSessions() {
    const stored = localStorage.getItem('alexus_sessions_v5');
    if (stored) {
        sessions = JSON.parse(stored);
    }
    if (sessions.length === 0) {
        createNewSession();
    } else {
        loadSession(sessions[0].id);
    }
    renderSessionsList();
}

function saveSessions() {
    localStorage.setItem('alexus_sessions_v5', JSON.stringify(sessions));
}

function createNewSession() {
    const session = {
        id: Date.now().toString(),
        title: 'New Session',
        created: new Date().toISOString(),
        messages: []
    };
    sessions.unshift(session);
    saveSessions();
    loadSession(session.id);
    renderSessionsList();
}

function loadSession(sessionId) {
    currentSession = sessions.find(s => s.id === sessionId);
    if (currentSession) {
        document.getElementById('chatTitle').textContent = currentSession.title.toUpperCase();
        renderMessages();
        renderSessionsList();
    }
}

function deleteSession(sessionId) {
    sessions = sessions.filter(s => s.id !== sessionId);
    saveSessions();
    if (currentSession && currentSession.id === sessionId) {
        if (sessions.length === 0) {
            createNewSession();
        } else {
            loadSession(sessions[0].id);
        }
    }
    renderSessionsList();
}

function renderSessionsList() {
    const list = document.getElementById('sessionsList');
    list.innerHTML = '';

    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item' + (currentSession && session.id === currentSession.id ? ' active' : '');
        item.onclick = () => loadSession(session.id);

        const date = new Date(session.created);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
            <div class="session-title">${session.title}</div>
            <div class="session-meta">
                <span class="session-date">${dateStr}</span>
                <button class="session-delete" onclick="event.stopPropagation(); deleteSession('${session.id}')">×</button>
            </div>
        `;

        list.appendChild(item);
    });
}

// ========================================
// MESSAGE HANDLING
// ========================================

function addMessage(sender, text, imageData = null, isGeneratedImage = false) {
    if (!currentSession) return;

    const message = {
        sender,
        text,
        timestamp: new Date().toISOString(),
        imageData,
        isGeneratedImage
    };

    currentSession.messages.push(message);

    if (currentSession.messages.length === 1 && sender === 'user') {
        currentSession.title = text.substring(0, 40) + (text.length > 40 ? '...' : '');
    }

    saveSessions();
    renderMessages();
    renderSessionsList();
}

function renderMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    if (!currentSession) return;

    currentSession.messages.forEach((msg, index) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.sender}`;

        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const icon = msg.sender === 'user' ? '→' : msg.sender === 'system' ? '⚡' : '◉';

        let messageContent = `
            <div class="message-bubble">
                <div class="message-header">
                    <span>${icon} ${msg.sender.toUpperCase()}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${msg.text}</div>
        `;

        // Display uploaded/generated images
        if (msg.imageData) {
            const imageId = `image-${index}-${Date.now()}`;
            messageContent += `
                <div class="message-image-container">
                    <img src="data:image/png;base64,${msg.imageData}" class="message-image" id="${imageId}" />
                    ${msg.isGeneratedImage ? `
                        <button class="image-download-btn" onclick="downloadImage('${imageId}', '${msg.imageData}')">
                            💾 Download
                        </button>
                    ` : ''}
                </div>
            `;
        }

        messageContent += `</div>`;
        msgDiv.innerHTML = messageContent;

        container.appendChild(msgDiv);
    });

    // Auto scroll
    container.scrollTop = container.scrollHeight;
}

// Download generated image
async function downloadImage(imageId, imageData) {
    try {
        if (window.electronAPI) {
            const result = await window.electronAPI.saveImage(imageData);
            if (result.success) {
                addMessage('system', `✅ Image saved to: ${result.path}`);
            }
        } else {
            // Fallback for browser
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${imageData}`;
            link.download = `ALEXUS-image-${Date.now()}.png`;
            link.click();
        }
    } catch (error) {
        addMessage('system', `❌ Failed to save image: ${error.message}`);
    }
}

// ========================================
// FILE UPLOAD HANDLER (SINGLE VERSION)
// ========================================

async function uploadFile() {
    try {
        if (!window.electronAPI) {
            addMessage('system', '❌ File upload only available in desktop app');
            return;
        }

        const result = await window.electronAPI.uploadFile();

        if (result.canceled) {
            return;
        }

        if (result.success) {
            currentUploadedFile = {
                fileName: result.fileName,
                fileType: result.fileType,
                fileData: result.fileData,
                isImage: result.isImage
            };

            // Show file indicator in input
            const input = document.getElementById('messageInput');
            const fileIndicator = document.createElement('div');
            fileIndicator.className = 'file-attachment-indicator';
            fileIndicator.id = 'fileIndicator';
            fileIndicator.innerHTML = `
                <span class="file-icon">📎</span>
                <span class="file-name">${result.fileName}</span>
                <button class="file-remove" onclick="removeAttachment()">×</button>
            `;

            // Insert before input wrapper
            const inputContainer = document.querySelector('.chat-input-container');
            const existingIndicator = document.getElementById('fileIndicator');
            if (existingIndicator) existingIndicator.remove();

            inputContainer.insertBefore(fileIndicator, inputContainer.firstChild);

            // Show preview for images
            if (result.isImage) {
                addMessage('user', `📎 Attached: ${result.fileName}`, result.fileData, false);
            } else {
                addMessage('system', `✅ File attached: ${result.fileName}`);
            }

            input.placeholder = `Ask about ${result.fileName}...`;
            updateStatus('FILE ATTACHED', '#ff9500');
        }
    } catch (error) {
        addMessage('system', `❌ Upload failed: ${error.message}`);
    }
}

// Remove attachment
function removeAttachment() {
    currentUploadedFile = null;
    const indicator = document.getElementById('fileIndicator');
    if (indicator) indicator.remove();

    const input = document.getElementById('messageInput');
    input.placeholder = 'Enter command or question...';
    updateStatus('READY', '#00ff41');
}

// ========================================
// 3D SPHERE VISUALIZATION
// ========================================

function init3DSphere() {
    const canvas = document.getElementById('sphereCanvas');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(500, 500);
    renderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.SphereGeometry(1.5, 64, 64);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            intensity: { value: 1.0 }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                vec3 pos = position;
                pos.x += sin(time + position.y * 2.0) * 0.05;
                pos.y += cos(time + position.x * 2.0) * 0.05;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform float time;
            uniform float intensity;
            
            void main() {
                vec3 viewDirection = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);
                float pulse = sin(time * 2.0) * 0.3 + 0.7;
                vec3 color = vec3(0.0, 0.85, 1.0);
                vec3 finalColor = color * (fresnel + 0.2) * pulse * intensity;
                gl_FragColor = vec4(finalColor, 0.8);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Rings
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(1.8 + i * 0.3, 0.02, 16, 100);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d9ff,
            transparent: true,
            opacity: 0.6 - i * 0.15
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2 + (i * 0.2);
        ring.userData.rotationSpeed = 0.01 + i * 0.005;
        scene.add(ring);
        particles.push(ring);
    }

    // Particles
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = 2 + Math.random() * 1;

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
    particles.push(particleSystem);

    const ambientLight = new THREE.AmbientLight(0x00d9ff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(0, 0, 3);
    scene.add(pointLight);

    canvas.addEventListener('click', toggleVoice);

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    if (sphere && sphere.material.uniforms) {
        sphere.material.uniforms.time.value = time;
        sphere.material.uniforms.intensity.value = isSpeaking ? 3.0 : isListening ? 1.5 : 1.0;
    }

    if (sphere) {
        sphere.rotation.y += 0.005;
        sphere.rotation.x = Math.sin(time * 0.5) * 0.1;
    }

    particles.forEach((obj) => {
        if (obj.userData.rotationSpeed) {
            obj.rotation.z += obj.userData.rotationSpeed * (isSpeaking ? 3 : 1);
        }
        if (obj.type === 'Points') {
            obj.rotation.y += 0.001;
        }
    });

    renderer.render(scene, camera);
}

function setSphereIntensity(speaking) {
    isSpeaking = speaking;
    updateSphereStatus();
}

function updateSphereStatus() {
    const status = document.getElementById('sphereStatus');
    if (isListening) {
        status.textContent = isSpeaking ? 'SPEAKING...' : 'LISTENING...';
        status.style.color = '#00ff41';
    } else {
        status.textContent = 'CLICK TO ACTIVATE';
        status.style.color = '#666666';
    }
}

// ========================================
// AI PROCESSING
// ========================================

async function processQuery(query, taskType = 'general', screenshot = null) {
    try {
        const requestBody = {
            query,
            taskType,
            screenshot
        };

        // Add uploaded file data if exists
        if (currentUploadedFile) {
            requestBody.fileData = currentUploadedFile.fileData;
            requestBody.fileName = currentUploadedFile.fileName;
            requestBody.fileType = currentUploadedFile.fileType;
        }

        const response = await fetch('http://localhost:3737/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // Clear uploaded file after use
        currentUploadedFile = null;

        if (data.success) {
            // Check if response contains generated image
            if (data.isImage && data.imageData) {
                addMessage('alexus', data.response, data.imageData, true);
                return data.response;
            }
            return data.response;
        } else {
            return `⚠️ Error: ${data.error}`;
        }
    } catch (error) {
        return `❌ Connection error: ${error.message}`;
    }
}

function detectTaskType(query) {
    const lower = query.toLowerCase();
    if (lower.match(/code|program|script|function|debug|python|javascript/)) return 'coding';
    if (lower.match(/screen|see|look|show|analyze/)) return 'vision';
    if (lower.match(/search|find|google|news/)) return 'search';
    return 'general';
}

async function captureScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: 'screen' } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        stream.getTracks().forEach(track => track.stop());

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return dataUrl.split(',')[1];
    } catch (error) {
        console.error('Screen capture error:', error);
        return null;
    }
}

// ========================================
// USER INTERACTIONS
// ========================================

function newSession() {
    createNewSession();
}

// Detect if query is asking about screen without button click
function isScreenQuery(query) {
    return query.toLowerCase().match(/what.*on.*screen|analyze.*screen|see.*screen|screen.*show|look.*screen/i);
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) return;

    input.value = '';
    currentInputType = 'text';

    // Check if asking about screen - auto-capture if needed
    if (isScreenQuery(text) && !currentUploadedFile) {
        addMessage('user', text);
        addMessage('system', '📸 Auto-capturing screen...');
        updateStatus('CAPTURING', '#00d9ff');

        const screenshot = await captureScreen();
        if (screenshot) {
            updateStatus('PROCESSING', '#00d9ff');
            const response = await processQuery(text, 'vision', screenshot);
            addMessage('alexus', response);
        } else {
            addMessage('system', '❌ Screen capture failed. Please try the SCREEN button.');
        }
        updateStatus('READY', '#00ff41');
        return;
    }

    addMessage('user', text);

    // Clear file indicator after sending
    removeAttachment();

    updateStatus('PROCESSING', '#00d9ff');

    const taskType = detectTaskType(text);
    const response = await processQuery(text, taskType);

    addMessage('alexus', response);
    updateStatus('READY', '#00ff41');
}

async function analyzeScreen() {
    addMessage('system', '📸 Capturing screen...');
    updateStatus('CAPTURING', '#00d9ff');

    const screenshot = await captureScreen();

    if (screenshot) {
        addMessage('system', '🔍 Analyzing screen...');
        updateStatus('ANALYZING', '#00d9ff');

        const response = await processQuery('Analyze my screen in detail and tell me what you see.', 'vision', screenshot);
        addMessage('alexus', response);
    } else {
        addMessage('system', '❌ Screen capture failed or cancelled.');
    }

    updateStatus('READY', '#00ff41');
}

// ========================================
// VOICE MODE
// ========================================

function toggleVoice() {
    if (!isListening) {
        startVoiceMode();
    } else {
        stopVoiceMode();
    }
}

function startVoiceMode() {
    isListening = true;
    currentInputType = 'voice';
    updateSphereStatus();
    updateStatus('LISTENING', '#00ff41');
    addMessage('system', '🎤 Voice mode activated.');
    startVoiceLoop();
}

function stopVoiceMode() {
    isListening = false;
    updateSphereStatus();
    updateStatus('READY', '#00ff41');
    addMessage('system', 'Voice mode stopped.');
}

async function startVoiceLoop() {
    while (isListening) {
        try {
            const listenResponse = await fetch('http://localhost:5000/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const listenData = await listenResponse.json();

            if (listenData.success) {
                const transcript = listenData.text.trim();
                console.log('Heard:', transcript);

                // Wake words
                if (transcript.toLowerCase().match(/hey (alexus|alexa|alex)/)) {
                    await fetch('http://localhost:5000/speak', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'Yes, I am listening.' })
                    });
                    continue;
                }

                // Stop command
                if (transcript.toLowerCase().match(/stop listening|exit|quit/)) {
                    await fetch('http://localhost:5000/speak', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'Stopping voice mode.' })
                    });
                    setTimeout(() => stopVoiceMode(), 1000);
                    break;
                }

                // Process command
                addMessage('user', transcript);
                updateStatus('PROCESSING', '#00d9ff');
                setSphereIntensity(true);

                const taskType = detectTaskType(transcript);
                const response = await processQuery(transcript, taskType);

                addMessage('alexus', response);
                updateStatus('LISTENING', '#00ff41');

                // Speak response
                await fetch('http://localhost:5000/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: transcript,
                        response: response,
                        input_type: 'voice'
                    })
                });

                setSphereIntensity(false);

            } else {
                if (listenData.error !== 'timeout' && listenData.error !== 'not_understood') {
                    console.log('Listen error:', listenData.error);
                }
            }
        } catch (error) {
            console.error('Voice error:', error);
            addMessage('system', '❌ Voice service offline.');
            stopVoiceMode();
            break;
        }
    }
}

function updateStatus(text, color) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.querySelector('.status-dot');

    statusText.textContent = text;
    statusText.style.color = color;
    statusDot.style.background = color;
    statusDot.style.boxShadow = `0 0 10px ${color}`;
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'messageInput') {
        sendMessage();
    }

    if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.body.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen');
        }
    }

    if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen');
    }

    if (e.altKey && e.key === 'PageUp') {
        e.preventDefault();
        toggleVoice();
    }
});

// ========================================
// INITIALIZATION
// ========================================

window.addEventListener('load', () => {
    loadSessions();
    init3DSphere();
    updateStatus('READY', '#00ff41');

    if (!currentSession || currentSession.messages.length === 0) {
        addMessage('system', '⚡ ALEXUS V5 initialized. Enhanced with file upload & image generation.');
    }
});

window.addEventListener('resize', () => {
    if (renderer && camera) {
        renderer.setSize(500, 500);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    }
});