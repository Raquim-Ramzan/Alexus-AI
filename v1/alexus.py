"""
ALEXUS AI ASSISTANT v1.0
Your Personal Multi-AI Orchestrator
Modern Hacker Theme Edition
"""

import speech_recognition as sr
from gtts import gTTS
import os
import requests
import json
from PIL import ImageGrab
import base64
from io import BytesIO
import threading
import time
from pynput import keyboard
import pygame
import tempfile

# ============================================
# CONFIGURATION - ADD YOUR API KEYS HERE
# ============================================
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"
MAKE_WEBHOOK_URL = "YOUR_MAKE_WEBHOOK_URL_HERE"

# Colors for terminal output (hacker theme)
GREEN = '\033[92m'
CYAN = '\033[96m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'
BOLD = '\033[1m'

# ============================================
# ALEXUS CORE CLASS
# ============================================
class Alexus:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.is_listening = True
        self.wake_words = ["hey alexus", "hey alexa", "hey alex", "alexus", "alexa", "alex"]
        self.is_active = False
        
        # Initialize pygame for audio playback
        pygame.mixer.init()
        
        print(f"{GREEN}{BOLD}")
        print("╔═══════════════════════════════════════╗")
        print("║     ALEXUS AI ASSISTANT v1.0         ║")
        print("║   Multi-AI Orchestrator Online       ║")
        print("╚═══════════════════════════════════════╝")
        print(f"{RESET}")
        print(f"{CYAN}[SYSTEM]{RESET} Initializing voice recognition...")
        print(f"{CYAN}[SYSTEM]{RESET} Wake words: 'Hey Alexus/Alexa/Alex' or Alt+PgUp")
        print(f"{GREEN}[STATUS]{RESET} Ready to assist!\n")
        
        # Start hotkey listener
        self.start_hotkey_listener()
        
    def start_hotkey_listener(self):
        """Listen for Alt+PgUp hotkey"""
        def on_press(key):
            try:
                if key == keyboard.Key.page_up:
                    if keyboard.Key.alt in keyboard._pressed_keys:
                        print(f"{YELLOW}[HOTKEY]{RESET} Alexus activated!")
                        self.is_active = True
                        self.speak("Yes, I'm listening.")
            except:
                pass
        
        listener = keyboard.Listener(on_press=on_press)
        listener.start()
    
    def speak(self, text):
        """Convert text to speech using gTTS"""
        try:
            print(f"{GREEN}[ALEXUS]{RESET} {text}")
            
            # Generate speech
            tts = gTTS(text=text, lang='en', slow=False)
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
                temp_file = fp.name
                tts.save(temp_file)
            
            # Play audio
            pygame.mixer.music.load(temp_file)
            pygame.mixer.music.play()
            
            # Wait for playback to finish
            while pygame.mixer.music.get_busy():
                time.sleep(0.1)
            
            # Clean up
            pygame.mixer.music.unload()
            os.unlink(temp_file)
            
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} Speech error: {e}")
    
    def listen(self):
        """Listen for voice input"""
        with sr.Microphone() as source:
            try:
                # Adjust for ambient noise
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                
                print(f"{CYAN}[LISTENING]{RESET} Speak now...")
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)
                
                # Use Google Speech Recognition
                text = self.recognizer.recognize_google(audio)
                print(f"{YELLOW}[YOU]{RESET} {text}")
                return text.lower()
                
            except sr.WaitTimeoutError:
                return None
            except sr.UnknownValueError:
                print(f"{RED}[ERROR]{RESET} Could not understand audio")
                return None
            except Exception as e:
                print(f"{RED}[ERROR]{RESET} {e}")
                return None
    
    def capture_screen(self):
        """Capture screenshot and convert to base64"""
        try:
            screenshot = ImageGrab.grab()
            
            # Resize to reduce size (max width 1280px)
            max_width = 1280
            if screenshot.width > max_width:
                ratio = max_width / screenshot.width
                new_height = int(screenshot.height * ratio)
                screenshot = screenshot.resize((max_width, new_height))
            
            buffered = BytesIO()
            screenshot.save(buffered, format="JPEG", quality=85)
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return img_str
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} Screen capture failed: {e}")
            return None
    
    def detect_task_type(self, query):
        """Detect what type of task the query is"""
        query_lower = query.lower()
        
        # Coding keywords
        if any(word in query_lower for word in ['code', 'program', 'script', 'function', 'debug', 'python', 'javascript', 'java', 'c++', 'html', 'css']):
            return "coding"
        
        # Screen-related keywords
        if any(word in query_lower for word in ['screen', 'see', 'look', 'show', 'what\'s on', 'analyze', 'read']):
            return "vision"
        
        # Search keywords
        if any(word in query_lower for word in ['search', 'find', 'look up', 'google', 'news', 'latest']):
            return "search"
        
        # Default to general
        return "general"
    
    def process_query(self, query):
        """Send query to Make.com for processing"""
        try:
            task_type = self.detect_task_type(query)
            print(f"{CYAN}[PROCESSING]{RESET} Task type: {task_type}")
            
            screenshot = None
            
            # Capture screenshot if vision task
            if task_type == "vision":
                print(f"{CYAN}[VISION]{RESET} Capturing screen...")
                screenshot = self.capture_screen()
            
            # Prepare payload
            payload = {
                "query": query,
                "task_type": task_type,
                "timestamp": time.time()
            }
            
            # Add screenshot if available
            if screenshot:
                payload["screenshot"] = screenshot
            
            # Send to Make.com
            if MAKE_WEBHOOK_URL != "YOUR_MAKE_WEBHOOK_URL_HERE":
                print(f"{CYAN}[CLOUD]{RESET} Sending to Make.com...")
                response = requests.post(MAKE_WEBHOOK_URL, json=payload, timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", "I processed your request, but got no response.")
                else:
                    return f"Error: Got status code {response.status_code}"
            else:
                # Fallback: Direct Gemini call (for testing without Make.com)
                return self.fallback_gemini(query, task_type, screenshot)
                
        except requests.Timeout:
            return "Request timed out. The AI might be processing a complex task."
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} {e}")
            return f"Error processing your request: {str(e)}"# Prepare payload
            payload = {
                "query": query,
                "task_type": task_type,
                "timestamp": time.time()
            }
            
            # Add screenshot if vision task
            if task_type == "vision":
                print(f"{CYAN}[VISION]{RESET} Capturing screen...")
                screenshot = self.capture_screen()
                if screenshot:
                    payload["screenshot"] = screenshot
            
            # Send to Make.com
            if MAKE_WEBHOOK_URL != "YOUR_MAKE_WEBHOOK_URL_HERE":
                print(f"{CYAN}[CLOUD]{RESET} Sending to Make.com...")
                response = requests.post(MAKE_WEBHOOK_URL, json=payload, timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", "I processed your request, but got no response.")
                else:
                    return f"Error: Got status code {response.status_code}"
            else:
                # Fallback: Direct Gemini call (for testing without Make.com)
                return self.fallback_gemini(query, task_type)
                
        except requests.Timeout:
            return "Request timed out. The AI might be processing a complex task."
        except Exception as e:
            print(f"{RED}[ERROR]{RESET} {e}")
            return f"Error processing your request: {str(e)}"
    
    def fallback_gemini(self, query, task_type, screenshot=None):
        """Direct Gemini API call as fallback"""
        try:
            if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
                return "Please configure your API keys in the script."
            
            # Use vision model if screenshot provided
            if screenshot and task_type == "vision":
                model = "gemini-2.5-flash"
                url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={GEMINI_API_KEY}"
                
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": query},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": screenshot
                                }
                            }
                        ]
                    }]
                }
            else:
                # Use text model for regular queries
                url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
                
                payload = {
                    "contents": [{
                        "parts": [{"text": query}]
                    }]
                }
            
            print(f"{CYAN}[DEBUG]{RESET} Calling Gemini API...")
            response = requests.post(url, json=payload, timeout=30)
            
            print(f"{CYAN}[DEBUG]{RESET} Status code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                text = result['candidates'][0]['content']['parts'][0]['text']
                return text
            else:
                error_msg = response.text
                print(f"{RED}[DEBUG]{RESET} Error response: {error_msg}")
                return f"Gemini API error: Status {response.status_code}. Check your API key."
                
        except Exception as e:
            print(f"{RED}[DEBUG]{RESET} Exception: {str(e)}")
            return f"Fallback error: {str(e)}"
    
    def run(self):
        """Main loop"""
        print(f"{GREEN}[ACTIVE]{RESET} Listening for wake word...\n")
        
        while self.is_listening:
            try:
                # Listen for wake word or wait for hotkey
                command = self.listen()
                
                if command:
                    # Check for wake word
                    if any(wake_word in command for wake_word in self.wake_words):
                        self.is_active = True
                        self.speak("Yes, I'm listening.")
                        continue
                    
                    # If active, process command
                    if self.is_active:
                        # Check for exit commands
                        if any(word in command for word in ['exit', 'quit', 'goodbye', 'stop listening']):
                            self.speak("Shutting down. Goodbye!")
                            break
                        
                        # Check for sleep command
                        if 'sleep' in command or 'standby' in command:
                            self.speak("Going to standby mode. Say the wake word to activate me again.")
                            self.is_active = False
                            continue
                        
                        # Process the query
                        response = self.process_query(command)
                        self.speak(response)
                        
                        # Go back to standby after responding
                        self.is_active = False
                
                time.sleep(0.1)
                
            except KeyboardInterrupt:
                print(f"\n{YELLOW}[INTERRUPT]{RESET} Shutting down...")
                break
            except Exception as e:
                print(f"{RED}[ERROR]{RESET} {e}")
                time.sleep(1)

# ============================================
# MAIN ENTRY POINT
# ============================================
if __name__ == "__main__":
    alexus = Alexus()
    alexus.run()