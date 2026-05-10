"""
ALEXUS V5 Voice Service
Complete voice handling backend
Python controls everything - no browser audio
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import speech_recognition as sr
from gtts import gTTS
import pygame
import tempfile
import os
import time

app = Flask(__name__)
CORS(app)

recognizer = sr.Recognizer()
pygame.mixer.init()

# Track if we should speak responses
should_speak_response = False

@app.route('/speak', methods=['POST'])
def speak():
    """Speak text using gTTS"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'success': False, 'error': 'No text'})
        
        print(f"\n[SPEAKING] {text[:80]}...")
        
        # Generate with gTTS
        tts = gTTS(text=text, lang='en', slow=False)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
            temp_file = fp.name
            tts.save(temp_file)
        
        # Play
        pygame.mixer.music.load(temp_file)
        pygame.mixer.music.play()
        
        # Wait for completion
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
        
        pygame.mixer.music.unload()
        os.unlink(temp_file)
        
        print("[SPEAKING] Done\n")
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"[ERROR] Speech: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/listen', methods=['POST'])
def listen():
    """Listen for voice input"""
    global should_speak_response
    
    try:
        print("[LISTENING] Waiting for speech...")
        
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            text = recognizer.recognize_google(audio)
            
            print(f"[HEARD] {text}")
            
            # Set flag - responses to voice input should be spoken
            should_speak_response = True
            
            return jsonify({
                'success': True, 
                'text': text,
                'input_type': 'voice'
            })
            
    except sr.WaitTimeoutError:
        return jsonify({'success': False, 'error': 'timeout'})
    except sr.UnknownValueError:
        return jsonify({'success': False, 'error': 'not_understood'})
    except Exception as e:
        print(f"[ERROR] Listen: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/process', methods=['POST'])
def process():
    """
    Process query and handle voice output intelligently
    Voice input → Speak response
    Text input → No speech
    """
    global should_speak_response
    
    try:
        data = request.json
        query = data.get('query', '')
        response_text = data.get('response', '')
        input_type = data.get('input_type', 'text')
        
        print(f"\n[PROCESS] Input: {input_type}")
        print(f"[PROCESS] Query: {query[:50]}...")
        print(f"[PROCESS] Response: {response_text[:50]}...")
        
        # If input was voice, speak the response
        if input_type == 'voice':
            print("[PROCESS] Speaking response (voice input detected)")
            
            tts = gTTS(text=response_text, lang='en', slow=False)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
                temp_file = fp.name
                tts.save(temp_file)
            
            pygame.mixer.music.load(temp_file)
            pygame.mixer.music.play()
            
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
            
            pygame.mixer.music.unload()
            os.unlink(temp_file)
            
            print("[PROCESS] Speaking done\n")
        else:
            print("[PROCESS] Text input - no speech\n")
        
        return jsonify({'success': True, 'spoken': input_type == 'voice'})
        
    except Exception as e:
        print(f"[ERROR] Process: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/status', methods=['GET'])
def status():
    return jsonify({'status': 'running', 'service': 'ALEXUS V5 Voice Service'})

if __name__ == '__main__':
    print("=" * 60)
    print("  ALEXUS V5 VOICE SERVICE")
    print("=" * 60)
    print("  Port: 5000")
    print("  gTTS: Ready")
    print("  Speech Recognition: Ready")
    print("  Smart Voice: Enabled")
    print("=" * 60)
    print()
    app.run(host='localhost', port=5000, debug=False, threaded=True)