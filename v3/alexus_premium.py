"""
ALEXUS AI ASSISTANT - PREMIUM EDITION v3.0
Ultimate Professional Interface with Persistent Chat History
Cyberpunk Theme: Electric Blue, Green, Dark Green, Black
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
import uuid

# ============================================
# CONFIGURATION
# ============================================
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"
MAKE_WEBHOOK_URL = "YOUR_MAKE_WEBHOOK_URL_HERE"

# Color Palette - Cyberpunk Theme
COLORS = {
    'bg_dark': '#0a0a0a',
    'bg_darker': '#050505',
    'bg_sidebar': '#0d0d0d',
    'electric_blue': '#00d9ff',
    'neon_green': '#00ff41',
    'dark_green': '#0a3d0a',
    'accent_green': '#00ff00',
    'text_white': '#ffffff',
    'text_gray': '#888888',
    'hover_blue': '#00b8d4',
    'hover_green': '#00cc33',
    'border': '#1a1a1a',
    'gradient_start': '#001a1a',
    'gradient_end': '#000d0d'
}

# Chat storage file
CHAT_HISTORY_FILE = "alexus_history.json"

# ============================================
# CHAT STORAGE MANAGER
# ============================================
class ChatManager:
    def __init__(self):
        self.conversations = {}
        self.load_history()
    
    def load_history(self):
        """Load chat history from file"""
        try:
            if os.path.exists(CHAT_HISTORY_FILE):
                with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as f:
                    self.conversations = json.load(f)
        except Exception as e:
            print(f"Error loading history: {e}")
            self.conversations = {}
    
    def save_history(self):
        """Save chat history to file"""
        try:
            with open(CHAT_HISTORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.conversations, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving history: {e}")
    
    def create_conversation(self):
        """Create new conversation"""
        conv_id = str(uuid.uuid4())
        self.conversations[conv_id] = {
            'id': conv_id,
            'title': 'New Chat',
            'created': datetime.now().isoformat(),
            'messages': [],
            'pinned': False
        }
        self.save_history()
        return conv_id
    
    def add_message(self, conv_id, sender, text):
        """Add message to conversation"""
        if conv_id in self.conversations:
            self.conversations[conv_id]['messages'].append({
                'sender': sender,
                'text': text,
                'timestamp': datetime.now().isoformat()
            })
            
            # Auto-generate title from first message
            if len(self.conversations[conv_id]['messages']) == 1 and sender == 'user':
                self.conversations[conv_id]['title'] = text[:30] + '...' if len(text) > 30 else text
            
            self.save_history()
    
    def delete_conversation(self, conv_id):
        """Delete a conversation"""
        if conv_id in self.conversations:
            del self.conversations[conv_id]
            self.save_history()
    
    def get_conversation(self, conv_id):
        """Get conversation by ID"""
        return self.conversations.get(conv_id, None)
    
    def get_all_conversations(self):
        """Get all conversations sorted by date"""
        convs = list(self.conversations.values())
        convs.sort(key=lambda x: x['created'], reverse=True)
        return convs

# ============================================
# ALEXUS AI BACKEND
# ============================================
class AlexusCore:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.wake_words = ["hey alexus", "hey alexa", "hey alex", "alexus", "alexa", "alex"]
        pygame.mixer.init()
        
    def speak(self, text):
        """Text to speech"""
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
        """Capture screenshot"""
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
        
        if any(word in query_lower for word in ['code', 'program', 'script', 'function', 'debug']):
            return "coding"
        if any(word in query_lower for word in ['screen', 'see', 'look', 'show', 'analyze']):
            return "vision"
        if any(word in query_lower for word in ['search', 'find', 'google', 'news']):
            return "search"
        return "general"
    
    def process_query(self, query):
        """Process query with AI"""
        try:
            task_type = self.detect_task_type(query)
            screenshot = None
            
            if task_type == "vision":
                screenshot = self.capture_screen()
            
            if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
                return "⚠️ Please configure your API keys in settings."
            
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
                return f"⚠️ API Error: Status {response.status_code}"
                
        except Exception as e:
            return f"❌ Error: {str(e)}"

# ============================================
# PREMIUM GUI APPLICATION
# ============================================
class AlexusPremiumGUI:
    def __init__(self):
        ctk.set_appearance_mode("dark")
        
        # Main window
        self.root = ctk.CTk()
        self.root.title("ALEXUS - Premium AI Assistant")
        self.root.geometry("1400x900")
        self.root.configure(fg_color=COLORS['bg_dark'])
        
        # Initialize backend
        self.alexus = AlexusCore()
        self.chat_manager = ChatManager()
        self.current_conversation = None
        self.is_listening = False
        
        # Create UI
        self.setup_ui()
        self.setup_hotkey()
        
        # Load or create first conversation
        all_convs = self.chat_manager.get_all_conversations()
        if all_convs:
            self.load_conversation(all_convs[0]['id'])
        else:
            self.new_conversation()
    
    def setup_ui(self):
        """Create the premium UI"""
        
        # Main container
        main_container = ctk.CTkFrame(self.root, fg_color=COLORS['bg_dark'])
        main_container.pack(fill="both", expand=True)
        
        # ==================== SIDEBAR ====================
        self.sidebar = ctk.CTkFrame(
            main_container,
            width=300,
            fg_color=COLORS['bg_sidebar'],
            corner_radius=0
        )
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)
        
        # Sidebar Header
        sidebar_header = ctk.CTkFrame(self.sidebar, fg_color=COLORS['bg_darker'], height=80)
        sidebar_header.pack(fill="x", padx=0, pady=0)
        
        logo_label = ctk.CTkLabel(
            sidebar_header,
            text="⚡ ALEXUS",
            font=("Consolas", 24, "bold"),
            text_color=COLORS['electric_blue']
        )
        logo_label.pack(pady=20)
        
        # New Chat Button
        new_chat_btn = ctk.CTkButton(
            self.sidebar,
            text="➕ New Chat",
            font=("Consolas", 14, "bold"),
            height=50,
            fg_color=COLORS['electric_blue'],
            hover_color=COLORS['hover_blue'],
            text_color=COLORS['bg_dark'],
            corner_radius=10,
            command=self.new_conversation
        )
        new_chat_btn.pack(padx=15, pady=15, fill="x")
        
        # Chat History Label
        history_label = ctk.CTkLabel(
            self.sidebar,
            text="📜 CHAT HISTORY",
            font=("Consolas", 12, "bold"),
            text_color=COLORS['text_gray']
        )
        history_label.pack(padx=15, pady=(10, 5), anchor="w")
        
        # Scrollable Chat List
        self.chat_list_frame = ctk.CTkScrollableFrame(
            self.sidebar,
            fg_color=COLORS['bg_sidebar'],
            scrollbar_button_color=COLORS['electric_blue']
        )
        self.chat_list_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        self.refresh_chat_list()
        
        # ==================== MAIN CHAT AREA ====================
        chat_container = ctk.CTkFrame(main_container, fg_color=COLORS['bg_dark'])
        chat_container.pack(side="left", fill="both", expand=True)
        
        # Header Bar
        header_bar = ctk.CTkFrame(chat_container, fg_color=COLORS['bg_darker'], height=80)
        header_bar.pack(fill="x")
        
        # Chat title
        self.chat_title_label = ctk.CTkLabel(
            header_bar,
            text="ALEXUS AI Assistant",
            font=("Consolas", 20, "bold"),
            text_color=COLORS['neon_green']
        )
        self.chat_title_label.pack(side="left", padx=30, pady=20)
        
        # Status indicator
        self.status_indicator = ctk.CTkLabel(
            header_bar,
            text="● READY",
            font=("Consolas", 12, "bold"),
            text_color=COLORS['neon_green']
        )
        self.status_indicator.pack(side="right", padx=30)
        
        # Chat Messages Area
        self.chat_scroll = ctk.CTkScrollableFrame(
            chat_container,
            fg_color=COLORS['bg_dark'],
            scrollbar_button_color=COLORS['electric_blue']
        )
        self.chat_scroll.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Input Area
        input_container = ctk.CTkFrame(chat_container, fg_color=COLORS['bg_darker'], height=120)
        input_container.pack(fill="x", padx=20, pady=(0, 20))
        
        # Input frame
        input_frame = ctk.CTkFrame(input_container, fg_color="transparent")
        input_frame.pack(fill="x", padx=20, pady=20)
        
        # Text input
        self.input_entry = ctk.CTkEntry(
            input_frame,
            placeholder_text="💬 Type your message... (Press Enter to send)",
            font=("Consolas", 14),
            height=50,
            border_color=COLORS['electric_blue'],
            border_width=2,
            fg_color=COLORS['bg_dark'],
            text_color=COLORS['text_white']
        )
        self.input_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.input_entry.bind("<Return>", lambda e: self.send_message())
        
        # Send button
        self.send_btn = ctk.CTkButton(
            input_frame,
            text="⚡ SEND",
            width=120,
            height=50,
            font=("Consolas", 14, "bold"),
            fg_color=COLORS['electric_blue'],
            hover_color=COLORS['hover_blue'],
            text_color=COLORS['bg_dark'],
            corner_radius=10,
            command=self.send_message
        )
        self.send_btn.pack(side="left", padx=5)
        
        # Voice button
        self.voice_btn = ctk.CTkButton(
            input_frame,
            text="🎤 VOICE",
            width=120,
            height=50,
            font=("Consolas", 14, "bold"),
            fg_color=COLORS['neon_green'],
            hover_color=COLORS['hover_green'],
            text_color=COLORS['bg_dark'],
            corner_radius=10,
            command=self.toggle_voice
        )
        self.voice_btn.pack(side="left", padx=5)
        
        # Screen button
        screen_btn = ctk.CTkButton(
            input_frame,
            text="👁️ SCREEN",
            width=120,
            height=50,
            font=("Consolas", 14, "bold"),
            fg_color=COLORS['dark_green'],
            hover_color=COLORS['accent_green'],
            text_color=COLORS['text_white'],
            corner_radius=10,
            command=self.analyze_screen
        )
        screen_btn.pack(side="left", padx=5)
    
    def refresh_chat_list(self):
        """Refresh the chat history list"""
        # Clear existing
        for widget in self.chat_list_frame.winfo_children():
            widget.destroy()
        
        # Get all conversations
        conversations = self.chat_manager.get_all_conversations()
        
        if not conversations:
            no_chats = ctk.CTkLabel(
                self.chat_list_frame,
                text="No chats yet\nStart a new conversation!",
                font=("Consolas", 11),
                text_color=COLORS['text_gray']
            )
            no_chats.pack(pady=20)
            return
        
        # Create chat items
        for conv in conversations:
            self.create_chat_item(conv)
    
    def create_chat_item(self, conv):
        """Create a chat item in the sidebar"""
        is_current = conv['id'] == self.current_conversation
        
        chat_frame = ctk.CTkFrame(
            self.chat_list_frame,
            fg_color=COLORS['electric_blue'] if is_current else COLORS['bg_darker'],
            corner_radius=10,
            height=70
        )
        chat_frame.pack(fill="x", pady=5)
        
        # Click to load chat
        chat_btn = ctk.CTkButton(
            chat_frame,
            text=conv['title'][:35] + '...' if len(conv['title']) > 35 else conv['title'],
            font=("Consolas", 12),
            fg_color="transparent",
            hover_color=COLORS['hover_blue'] if not is_current else COLORS['electric_blue'],
            text_color=COLORS['bg_dark'] if is_current else COLORS['text_white'],
            anchor="w",
            command=lambda c=conv['id']: self.load_conversation(c)
        )
        chat_btn.pack(fill="x", padx=10, pady=(10, 5))
        
        # Bottom row with date and delete
        bottom_frame = ctk.CTkFrame(chat_frame, fg_color="transparent")
        bottom_frame.pack(fill="x", padx=10, pady=(0, 10))
        
        # Date
        date_obj = datetime.fromisoformat(conv['created'])
        date_str = date_obj.strftime("%b %d, %H:%M")
        date_label = ctk.CTkLabel(
            bottom_frame,
            text=date_str,
            font=("Consolas", 9),
            text_color=COLORS['bg_dark'] if is_current else COLORS['text_gray']
        )
        date_label.pack(side="left")
        
        # Delete button
        delete_btn = ctk.CTkButton(
            bottom_frame,
            text="🗑️",
            width=30,
            height=20,
            font=("Consolas", 10),
            fg_color="transparent",
            hover_color="#ff0000",
            text_color=COLORS['bg_dark'] if is_current else COLORS['text_gray'],
            command=lambda c=conv['id']: self.delete_chat(c)
        )
        delete_btn.pack(side="right")
    
    def new_conversation(self):
        """Create new conversation"""
        conv_id = self.chat_manager.create_conversation()
        self.load_conversation(conv_id)
        self.refresh_chat_list()
    
    def load_conversation(self, conv_id):
        """Load a conversation"""
        self.current_conversation = conv_id
        conv = self.chat_manager.get_conversation(conv_id)
        
        if not conv:
            return
        
        # Update title
        self.chat_title_label.configure(text=conv['title'])
        
        # Clear chat
        for widget in self.chat_scroll.winfo_children():
            widget.destroy()
        
        # Load messages
        for msg in conv['messages']:
            self.display_message(msg['sender'], msg['text'], save=False)
        
        # Refresh sidebar
        self.refresh_chat_list()
    
    def delete_chat(self, conv_id):
        """Delete a chat"""
        self.chat_manager.delete_conversation(conv_id)
        
        # If deleted current chat, create new one
        if conv_id == self.current_conversation:
            self.new_conversation()
        else:
            self.refresh_chat_list()
    
    def display_message(self, sender, text, save=True):
        """Display message in chat"""
        # Save to history
        if save and self.current_conversation:
            self.chat_manager.add_message(self.current_conversation, sender, text)
            # Update sidebar title if needed
            if len(self.chat_manager.get_conversation(self.current_conversation)['messages']) == 1:
                self.refresh_chat_list()
        
        # Message container
        msg_container = ctk.CTkFrame(self.chat_scroll, fg_color="transparent")
        msg_container.pack(fill="x", pady=10, padx=20)
        
        # Determine colors and alignment
        if sender == "user":
            bg_color = COLORS['electric_blue']
            text_color = COLORS['bg_dark']
            align = "e"
            icon = "👤"
        elif sender == "system":
            bg_color = COLORS['dark_green']
            text_color = COLORS['neon_green']
            align = "w"
            icon = "⚡"
        else:  # alexus
            bg_color = COLORS['bg_darker']
            text_color = COLORS['text_white']
            align = "w"
            icon = "🤖"
        
        # Message frame
        msg_frame = ctk.CTkFrame(
            msg_container,
            fg_color=bg_color,
            corner_radius=15,
            border_width=2,
            border_color=COLORS['electric_blue'] if sender == "user" else COLORS['neon_green']
        )
        msg_frame.pack(anchor=align, fill="x" if sender == "alexus" else "none", padx=(100 if sender == "user" else 0, 0 if sender == "user" else 100))
        
        # Icon and sender
        header_frame = ctk.CTkFrame(msg_frame, fg_color="transparent")
        header_frame.pack(fill="x", padx=15, pady=(10, 5))
        
        sender_label = ctk.CTkLabel(
            header_frame,
            text=f"{icon} {sender.upper()}",
            font=("Consolas", 11, "bold"),
            text_color=text_color
        )
        sender_label.pack(side="left")
        
        # Timestamp
        time_label = ctk.CTkLabel(
            header_frame,
            text=datetime.now().strftime("%H:%M"),
            font=("Consolas", 9),
            text_color=text_color
        )
        time_label.pack(side="right")
        
        # Message text
        msg_label = ctk.CTkLabel(
            msg_frame,
            text=text,
            font=("Consolas", 13),
            text_color=text_color,
            wraplength=700,
            justify="left"
        )
        msg_label.pack(padx=15, pady=(5, 15), anchor="w")
        
        # Auto-scroll
        self.chat_scroll._parent_canvas.yview_moveto(1.0)
    
    def send_message(self):
        """Send text message"""
        text = self.input_entry.get().strip()
        if not text:
            return
        
        self.input_entry.delete(0, 'end')
        self.display_message("user", text)
        self.update_status("PROCESSING", COLORS['electric_blue'])
        
        # Process in thread
        def process():
            response = self.alexus.process_query(text)
            self.root.after(0, lambda: self.display_message("alexus", response))
            self.root.after(0, lambda: self.update_status("READY", COLORS['neon_green']))
            threading.Thread(target=lambda: self.alexus.speak(response), daemon=True).start()
        
        threading.Thread(target=process, daemon=True).start()
    
    def analyze_screen(self):
        """Analyze screen"""
        self.display_message("system", "📸 Capturing and analyzing screen...")
        self.update_status("ANALYZING", COLORS['electric_blue'])
        
        def process():
            response = self.alexus.process_query("What's on my screen? Analyze it in detail.")
            self.root.after(0, lambda: self.display_message("alexus", response))
            self.root.after(0, lambda: self.update_status("READY", COLORS['neon_green']))
        
        threading.Thread(target=process, daemon=True).start()
    
    def toggle_voice(self):
        """Toggle voice mode"""
        if not self.is_listening:
            self.start_voice()
        else:
            self.stop_voice()
    
    def start_voice(self):
        """Start voice listening"""
        self.is_listening = True
        self.voice_btn.configure(text="⏹ STOP", fg_color="#ff0000")
        self.update_status("LISTENING", COLORS['neon_green'])
        self.display_message("system", "🎤 Voice mode activated. Say 'Hey Alexa' or start speaking...")
        
        def listen_loop():
            while self.is_listening:
                command = self.alexus.listen()
                if command:
                    if any(wake_word in command for wake_word in self.alexus.wake_words):
                        self.alexus.speak("Yes, listening.")
                        continue
                    
                    if 'stop listening' in command or 'exit' in command:
                        self.root.after(0, self.stop_voice)
                        break
                    
                    self.root.after(0, lambda c=command: self.display_message("user", c))
                    response = self.alexus.process_query(command)
                    self.root.after(0, lambda r=response: self.display_message("alexus", r))
                    self.alexus.speak(response)
        
        threading.Thread(target=listen_loop, daemon=True).start()
    
    def stop_voice(self):
        """Stop voice mode"""
        self.is_listening = False
        self.voice_btn.configure(text="🎤 VOICE", fg_color=COLORS['neon_green'])
        self.update_status("READY", COLORS['neon_green'])
        self.display_message("system", "Voice mode stopped.")
    
    def update_status(self, text, color):
        """Update status indicator"""
        self.status_indicator.configure(text=f"● {text}", text_color=color)
    
    def setup_hotkey(self):
        """Setup Alt+PgUp hotkey"""
        def on_press(key):
            try:
                if key == keyboard.Key.page_up:
                    if keyboard.Key.alt in keyboard._pressed_keys:
                        if not self.is_listening:
                            self.root.after(0, self.start_voice)
            except:
                pass
        
        listener = keyboard.Listener(on_press=on_press)
        listener.start()
    
    def run(self):
        """Start the application"""
        self.root.mainloop()

# ============================================
# MAIN ENTRY POINT
# ============================================
if __name__ == "__main__":
    app = AlexusPremiumGUI()
    app.run()