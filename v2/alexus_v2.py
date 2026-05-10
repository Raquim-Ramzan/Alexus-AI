"""
ALEXUS AI ASSISTANT v2.0 - GUI Edition
Modern Interface with Advanced Features
Hacker Theme
"""

import customtkinter as ctk
import speech_recognition as sr
from gtts import gTTS
import os
import requests
import json
from PIL import ImageGrab, Image, ImageTk
import base64
from io import BytesIO
import threading
import time
from pynput import keyboard
import pygame
import tempfile
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"
MAKE_WEBHOOK_URL = "YOUR_MAKE_WEBHOOK_URL_HERE"

# ============================================
# ALEXUS BACKEND (Same as before)
# ============================================
class AlexusCore:
    def __init__(self, gui_callback=None):
        self.recognizer = sr.Recognizer()
        self.wake_words = ["hey alexus", "hey alexa", "hey alex", "alexus", "alexa", "alex"]
        self.is_active = False
        self.gui_callback = gui_callback
        pygame.mixer.init()
        
    def speak(self, text):
        """Convert text to speech"""
        try:
            tts = gTTS(text=text, lang='en', slow=False)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
                temp_file = fp.name
                tts.save(temp_file)
            
            pygame.mixer.music.load(temp_file)
            pygame.mixer.music.play()
            
            while pygame.mixer.music.get_busy():
                time.sleep(0.1)
            
            pygame.mixer.music.unload()
            os.unlink(temp_file)
        except Exception as e:
            print(f"Speech error: {e}")
    
    def listen(self):
        """Listen for voice input"""
        with sr.Microphone() as source:
            try:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)
                text = self.recognizer.recognize_google(audio)
                return text.lower()
            except:
                return None
    
    def capture_screen(self):
        """Capture and optimize screenshot"""
        try:
            screenshot = ImageGrab.grab()
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
            return None
    
    def detect_task_type(self, query):
        """Detect task type"""
        query_lower = query.lower()
        
        if any(word in query_lower for word in ['code', 'program', 'script', 'function', 'debug', 'python', 'javascript']):
            return "coding"
        if any(word in query_lower for word in ['screen', 'see', 'look', 'show', 'what\'s on', 'analyze']):
            return "vision"
        if any(word in query_lower for word in ['search', 'find', 'look up', 'google', 'news']):
            return "search"
        return "general"
    
    def process_query(self, query):
        """Process query with AI"""
        try:
            task_type = self.detect_task_type(query)
            screenshot = None
            
            if task_type == "vision":
                screenshot = self.capture_screen()
            
            # Use Gemini API
            if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
                return "Please configure your API keys in the script."
            
            model = "gemini-2.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={GEMINI_API_KEY}"
            
            if screenshot and task_type == "vision":
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": query},
                            {"inline_data": {"mime_type": "image/jpeg", "data": screenshot}}
                        ]
                    }]
                }
            else:
                payload = {
                    "contents": [{
                        "parts": [{"text": query}]
                    }]
                }
            
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                text = result['candidates'][0]['content']['parts'][0]['text']
                return text
            else:
                return f"API Error: Status {response.status_code}"
                
        except Exception as e:
            return f"Error: {str(e)}"

# ============================================
# GUI APPLICATION
# ============================================
class AlexusGUI:
    def __init__(self):
        # Set theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")
        
        # Create window
        self.root = ctk.CTk()
        self.root.title("ALEXUS AI Assistant")
        self.root.geometry("900x700")
        self.root.configure(fg_color="#0a0a0a")
        
        # Initialize backend
        self.alexus = AlexusCore(gui_callback=self.add_message)
        self.is_listening = False
        self.listening_thread = None
        
        self.setup_ui()
        self.setup_hotkey()
        
    def setup_ui(self):
        """Create the user interface"""
        
        # Header
        header = ctk.CTkFrame(self.root, fg_color="#00ff00", height=80)
        header.pack(fill="x", padx=0, pady=0)
        
        title = ctk.CTkLabel(
            header, 
            text="◉ ALEXUS AI ASSISTANT", 
            font=("Consolas", 28, "bold"),
            text_color="#0a0a0a"
        )
        title.pack(pady=20)
        
        # Status bar
        status_frame = ctk.CTkFrame(self.root, fg_color="#1a1a1a", height=40)
        status_frame.pack(fill="x", padx=0, pady=0)
        
        self.status_label = ctk.CTkLabel(
            status_frame,
            text="● READY | Say 'Hey Alexa' or press Alt+PgUp",
            font=("Consolas", 12),
            text_color="#00ff00"
        )
        self.status_label.pack(pady=10)
        
        # Chat area
        chat_frame = ctk.CTkFrame(self.root, fg_color="#0a0a0a")
        chat_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        # Scrollable chat
        self.chat_scroll = ctk.CTkScrollableFrame(
            chat_frame,
            fg_color="#0f0f0f",
            border_color="#00ff00",
            border_width=2
        )
        self.chat_scroll.pack(fill="both", expand=True)
        
        # Welcome message
        self.add_message("system", "ALEXUS v2.0 initialized. Ready to assist!", show_time=False)
        
        # Input area
        input_frame = ctk.CTkFrame(self.root, fg_color="#1a1a1a", height=100)
        input_frame.pack(fill="x", padx=20, pady=(0, 20))
        
        # Text input
        self.input_entry = ctk.CTkEntry(
            input_frame,
            placeholder_text="Type your message or use voice...",
            font=("Consolas", 14),
            height=50,
            border_color="#00ff00",
            border_width=2
        )
        self.input_entry.pack(side="left", fill="x", expand=True, padx=(10, 5), pady=10)
        self.input_entry.bind("<Return>", lambda e: self.send_text_message())
        
        # Send button
        self.send_btn = ctk.CTkButton(
            input_frame,
            text="SEND",
            width=80,
            height=50,
            font=("Consolas", 14, "bold"),
            fg_color="#00ff00",
            text_color="#0a0a0a",
            hover_color="#00cc00",
            command=self.send_text_message
        )
        self.send_btn.pack(side="left", padx=5, pady=10)
        
        # Voice button
        self.voice_btn = ctk.CTkButton(
            input_frame,
            text="🎤 VOICE",
            width=100,
            height=50,
            font=("Consolas", 14, "bold"),
            fg_color="#00ff00",
            text_color="#0a0a0a",
            hover_color="#00cc00",
            command=self.toggle_voice
        )
        self.voice_btn.pack(side="left", padx=5, pady=10)
        
    def setup_hotkey(self):
        """Setup Alt+PgUp hotkey"""
        def on_press(key):
            try:
                if key == keyboard.Key.page_up:
                    if keyboard.Key.alt in keyboard._pressed_keys:
                        self.activate_voice()
            except:
                pass
        
        listener = keyboard.Listener(on_press=on_press)
        listener.start()
    
    def add_message(self, sender, text, show_time=True):
        """Add message to chat"""
        msg_frame = ctk.CTkFrame(
            self.chat_scroll,
            fg_color="#1a1a1a" if sender == "user" else "#0a3d0a",
            border_color="#00ff00",
            border_width=1
        )
        msg_frame.pack(fill="x", padx=10, pady=5, anchor="e" if sender == "user" else "w")
        
        # Sender label
        if sender == "system":
            sender_text = "⚡ SYSTEM"
            color = "#00ff00"
        elif sender == "user":
            sender_text = "👤 YOU"
            color = "#00ff00"
        else:
            sender_text = "🤖 ALEXUS"
            color = "#00ff00"
        
        sender_label = ctk.CTkLabel(
            msg_frame,
            text=sender_text,
            font=("Consolas", 11, "bold"),
            text_color=color
        )
        sender_label.pack(anchor="w", padx=10, pady=(5, 0))
        
        # Message text
        msg_label = ctk.CTkLabel(
            msg_frame,
            text=text,
            font=("Consolas", 12),
            text_color="#ffffff",
            wraplength=700,
            justify="left"
        )
        msg_label.pack(anchor="w", padx=10, pady=(0, 5))
        
        # Timestamp
        if show_time:
            time_label = ctk.CTkLabel(
                msg_frame,
                text=datetime.now().strftime("%H:%M:%S"),
                font=("Consolas", 9),
                text_color="#666666"
            )
            time_label.pack(anchor="e", padx=10, pady=(0, 5))
        
        # Auto-scroll
        self.chat_scroll._parent_canvas.yview_moveto(1.0)
    
    def send_text_message(self):
        """Send text message"""
        text = self.input_entry.get().strip()
        if not text:
            return
        
        self.input_entry.delete(0, 'end')
        self.add_message("user", text)
        self.update_status("● PROCESSING...", "#ffaa00")
        
        # Process in thread
        def process():
            response = self.alexus.process_query(text)
            self.root.after(0, lambda: self.add_message("alexus", response))
            self.root.after(0, lambda: self.update_status("● READY", "#00ff00"))
            
            # Speak response
            threading.Thread(target=lambda: self.alexus.speak(response), daemon=True).start()
        
        threading.Thread(target=process, daemon=True).start()
    
    def toggle_voice(self):
        """Toggle voice listening"""
        if not self.is_listening:
            self.start_voice_listening()
        else:
            self.stop_voice_listening()
    
    def activate_voice(self):
        """Activate voice (from hotkey)"""
        if not self.is_listening:
            self.start_voice_listening()
    
    def start_voice_listening(self):
        """Start listening for voice"""
        self.is_listening = True
        self.voice_btn.configure(text="⏹ STOP", fg_color="#ff0000")
        self.update_status("● LISTENING... Speak now!", "#00ff00")
        
        def listen_loop():
            while self.is_listening:
                command = self.alexus.listen()
                if command:
                    # Check for wake word
                    if any(wake_word in command for wake_word in self.alexus.wake_words):
                        self.root.after(0, lambda: self.add_message("system", "Wake word detected! Listening for command..."))
                        self.alexus.speak("Yes, I'm listening.")
                        continue
                    
                    # Check for exit
                    if any(word in command for word in ['exit', 'quit', 'stop listening']):
                        self.root.after(0, lambda: self.stop_voice_listening())
                        break
                    
                    # Process command
                    self.root.after(0, lambda c=command: self.add_message("user", c))
                    self.root.after(0, lambda: self.update_status("● PROCESSING...", "#ffaa00"))
                    
                    response = self.alexus.process_query(command)
                    self.root.after(0, lambda r=response: self.add_message("alexus", r))
                    self.root.after(0, lambda: self.update_status("● LISTENING...", "#00ff00"))
                    
                    # Speak response
                    self.alexus.speak(response)
        
        self.listening_thread = threading.Thread(target=listen_loop, daemon=True)
        self.listening_thread.start()
    
    def stop_voice_listening(self):
        """Stop voice listening"""
        self.is_listening = False
        self.voice_btn.configure(text="🎤 VOICE", fg_color="#00ff00")
        self.update_status("● READY", "#00ff00")
        self.add_message("system", "Voice mode stopped.")
    
    def update_status(self, text, color="#00ff00"):
        """Update status bar"""
        self.status_label.configure(text=text, text_color=color)
    
    def run(self):
        """Start the application"""
        self.root.mainloop()

# ============================================
# MAIN ENTRY POINT
# ============================================
if __name__ == "__main__":
    app = AlexusGUI()
    app.run()