"""
ALEXUS Voice Service
Python backend for high-quality voice operations
Uses gTTS for realistic voice output
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import speech_recognition as sr
from gtts import gTTS
import pygame
import tempfile
import os
import threading
import time

app = Flask(__name__)
CORS(app)  # Allow Electron to connect

# Initialize
recognizer = sr.Recognizer()
pygame.mixer.init()
is_listening = False
current_recognition = None

@app.route('/speak', methods=['POST'])
def speak():
    """Convert text to speech using gTTS"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'success': False, 'error': 'No text provided'})
        
        print(f"Speaking: {text[:50]}...")
        
        # Generate speech with gTTS
        tts = gTTS(text=text, lang='en', slow=False)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
            temp_file = fp.name
            tts.save(temp_file)
        
        print(f"Audio saved to: {temp_file}")
        
        # Play audio
        pygame.mixer.music.load(temp_file)
        pygame.mixer.music.play()
        
        print("Playing audio...")
        
        # IMPORTANT: Wait for playback to complete
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
        
        print("Audio finished")
        
        # Cleanup
        pygame.mixer.music.unload()
        try:
            os.unlink(temp_file)
        except:
            pass
        
        return jsonify({'success': True, 'message': 'Speech completed'})
        
    except Exception as e:
        print(f"Speech error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/listen', methods=['POST'])
def listen():
    """Listen for voice input"""
    try:
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            text = recognizer.recognize_google(audio)
            return jsonify({'success': True, 'text': text})
    except sr.WaitTimeoutError:
        return jsonify({'success': False, 'error': 'timeout'})
    except sr.UnknownValueError:
        return jsonify({'success': False, 'error': 'not_understood'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/status', methods=['GET'])
def status():
    """Check if service is running"""
    return jsonify({'status': 'running', 'service': 'ALEXUS Voice Service'})

if __name__ == '__main__':
    print("=" * 50)
    print("ALEXUS VOICE SERVICE STARTING")
    print("=" * 50)
    print("gTTS: Ready")
    print("Speech Recognition: Ready")
    print("Server: http://localhost:5000")
    print("=" * 50)
    app.run(host='localhost', port=5000, debug=False)