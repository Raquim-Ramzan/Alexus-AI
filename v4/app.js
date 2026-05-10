// ========================================
// ALEXUS - Ultra Realistic 3D Interface
// Three.js + WebGL Implementation
// ========================================

// Global state
let scene, camera, renderer, sphere, particles = [];
let isListening = false;
let isSpeaking = false;
let currentSession = null;
let sessions = [];

// Load sessions from localStorage
function loadSessions() {
    const stored = localStorage.getItem('alexus_sessions');
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
    localStorage.setItem('alexus_sessions', JSON.stringify(sessions));
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

function addMessage(sender, text) {
    if (!currentSession) return;

    const message = {
        sender,
        text,
        timestamp: new Date().toISOString()
    };

    currentSession.messages.push(message);

    // Update session title from first user message
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

    currentSession.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.sender}`;

        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const icon = msg.sender === 'user' ? '→' : msg.sender === 'system' ? '⚡' : '◉';

        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span>${icon} ${msg.sender.toUpperCase()}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${msg.text}</div>
            </div>
        `;

        container.appendChild(msgDiv);
    });

    // Auto scroll
    container.scrollTop = container.scrollHeight;
}

// ========================================
// 3D SPHERE WITH THREE.JS
// ========================================

function init3DSphere() {
    const canvas = document.getElementById('sphereCanvas');
    const container = canvas.parentElement;

    // Scene setup
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(500, 500);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Main sphere geometry
    const geometry = new THREE.SphereGeometry(1.5, 64, 64);

    // Shader material for glow effect
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
                
                // Wobble effect
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
                // Fresnel effect for rim glow
                vec3 viewDirection = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);
                
                // Pulsing effect
                float pulse = sin(time * 2.0) * 0.3 + 0.7;
                
                // Cyan color
                vec3 color = vec3(0.0, 0.85, 1.0);
                
                // Final color with glow
                vec3 finalColor = color * (fresnel + 0.2) * pulse * intensity;
                
                gl_FragColor = vec4(finalColor, 0.8);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Create rings
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

    // Create particle system
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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x00d9ff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(0, 0, 3);
    scene.add(pointLight);

    // Click handler
    canvas.addEventListener('click', toggleVoice);

    // Animation loop
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Update sphere shader
    if (sphere && sphere.material.uniforms) {
        sphere.material.uniforms.time.value = time;
        sphere.material.uniforms.intensity.value = isSpeaking ? 3.0 : isListening ? 1.5 : 1.0;
    }

    // Rotate sphere
    if (sphere) {
        sphere.rotation.y += 0.005;
        sphere.rotation.x = Math.sin(time * 0.5) * 0.1;
    }

    // Rotate rings
    particles.forEach((obj, index) => {
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
        const response = await fetch('http://localhost:3737/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                taskType: taskType,
                screenshot: screenshot
            })
        });

        const data = await response.json();

        if (data.success) {
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

    if (lower.match(/code|program|script|function|debug|python|javascript/)) {
        return 'coding';
    }
    if (lower.match(/screen|see|look|show|analyze/)) {
        return 'vision';
    }
    if (lower.match(/search|find|google|news/)) {
        return 'search';
    }

    return 'general';
}

async function captureScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: 'screen' }
        });

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
        return dataUrl.split(',')[1]; // Return base64 without prefix
    } catch (error) {
        console.error('Screen capture error:', error);
        return null;
    }
}

// ========================================
// UI INTERACTIONS
// ========================================

function newSession() {
    createNewSession();
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) return;

    input.value = '';
    addMessage('user', text);
    updateStatus('PROCESSING', '#00d9ff');

    const taskType = detectTaskType(text);
    const response = await processQuery(text, taskType);

    addMessage('alexus', response);
    updateStatus('READY', '#00ff41');

    // Speak response
    speakText(response);
}

async function analyzeScreen() {
    addMessage('system', '📸 Capturing and analyzing screen...');
    updateStatus('ANALYZING', '#00d9ff');

    const screenshot = await captureScreen();

    if (screenshot) {
        const response = await processQuery('Analyze my screen in detail.', 'vision', screenshot);
        addMessage('alexus', response);
    } else {
        addMessage('system', '❌ Screen capture failed. Please grant screen sharing permission.');
    }

    updateStatus('READY', '#00ff41');
}

function toggleVoice() {
    if (!isListening) {
        startVoiceMode();
    } else {
        stopVoiceMode();
    }
}

function startVoiceMode() {
    isListening = true;
    updateSphereStatus();
    updateStatus('LISTENING', '#00ff41');
    addMessage('system', '🎤 Voice mode activated. Speak now...');

    // Start speech recognition
    startSpeechRecognition();
}

function stopVoiceMode() {
    isListening = false;
    updateSphereStatus();
    updateStatus('READY', '#00ff41');
    addMessage('system', 'Voice mode stopped.');

    if (window.recognition) {
        window.recognition.stop();
    }
}

function speakText(text) {
    setSphereIntensity(true);

    // Use Python voice service for gTTS
    return fetch('http://localhost:5000/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    })
        .then(response => response.json())
        .then(data => {
            setSphereIntensity(false);
            if (data.success) {
                console.log('Speech completed via gTTS');
                return true;
            } else {
                console.error('Speech error:', data.error);
                addMessage('system', '❌ Voice error: ' + data.error);
                return false;
            }
        })
        .catch(error => {
            setSphereIntensity(false);
            console.error('Voice service connection error:', error);
            addMessage('system', '❌ Voice service offline. Make sure voice_service.py is running on port 5000.');
            return false;
        });
}

async function startSpeechRecognition() {
    console.log('Starting voice recognition loop');

    async function listenLoop() {
        if (!isListening) return;

        try {
            const response = await fetch('http://localhost:5000/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                const transcript = data.text.trim();
                console.log('Heard:', transcript);

                // Check wake words
                if (transcript.toLowerCase().match(/hey (alexus|alexa|alex)/)) {
                    await speakText('Yes, I am listening.');
                    listenLoop();
                    return;
                }

                // Check stop
                if (transcript.toLowerCase().match(/stop listening|exit|quit/)) {
                    await speakText('Stopping voice mode.');
                    setTimeout(() => stopVoiceMode(), 500);
                    return;
                }

                // Process command
                addMessage('user', transcript);
                updateStatus('PROCESSING', '#00d9ff');

                const taskType = detectTaskType(transcript);
                const aiResponse = await processQuery(transcript, taskType);

                addMessage('alexus', aiResponse);
                updateStatus('LISTENING', '#00ff41');

                // Speak response and wait for it to finish
                await speakText(aiResponse);

                // Continue listening after speech completes
                setTimeout(listenLoop, 500);

            } else {
                // Error or timeout, continue listening
                if (data.error !== 'timeout' && data.error !== 'not_understood') {
                    console.log('Listen error:', data.error);
                }
                listenLoop();
            }
        } catch (error) {
            console.error('Voice service error:', error);
            addMessage('system', '❌ Cannot connect to voice service. Is voice_service.py running?');
            stopVoiceMode();
        }
    }

    listenLoop();
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        setSphereIntensity(true);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
            setSphereIntensity(false);
        };

        window.speechSynthesis.speak(utterance);
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
    // Enter to send message
    if (e.key === 'Enter' && document.activeElement.id === 'messageInput') {
        sendMessage();
    }

    // F11 for fullscreen
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

    // ESC to exit fullscreen
    if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen');
    }

    // Alt+PgUp to toggle voice
    if (e.altKey && e.key === 'PageUp') {
        e.preventDefault();
        toggleVoice();
    }
});

// ========================================
// INITIALIZATION
// ========================================

window.addEventListener('load', () => {
    // Load voices for speech synthesis
    if ('speechSynthesis' in window) {
        // Chrome needs voices to be loaded
        speechSynthesis.onvoiceschanged = () => {
            const voices = speechSynthesis.getVoices();
            console.log('Available voices:', voices.length);
        };
        // Trigger voice loading
        speechSynthesis.getVoices();
    }

    loadSessions();
    init3DSphere();
    updateStatus('READY', '#00ff41');

    // Welcome message
    if (!currentSession || currentSession.messages.length === 0) {
        addMessage('system', '⚡ ALEXUS v4.0 initialized. Ultra-realistic JARVIS interface ready. Click sphere or say "Hey Alexa" to activate voice.');
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (renderer && camera) {
        renderer.setSize(500, 500);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    }
});