"""
Blipkis Voice Module - Phase 7
Global hotkey-activated voice recording and transcription for direct user-to-daemon communication.
"""

import os
import sys
import tempfile
import threading
import queue
from typing import Optional, Callable
from datetime import datetime
from dotenv import load_dotenv

# Third-party imports (install via requirements_voice.txt)
import pyaudio
import speech_recognition as sr
from pynput import keyboard
import openai


class BlipkisEars:
    """
    Voice input module for Project Blipkis.
    
    Listens for a global hotkey combination (Command + Option + B on macOS).
    When held down, records audio from the default microphone.
    When released, stops recording and transcribes the audio to text.
    The transcribed text can then be passed to BlipkisBrain for processing.
    """
    
    # Default hotkey: Command + Option + B (macOS)
    # For Windows/Linux, use ctrl + alt + b
    HOTKEY = (keyboard.Key.cmd, keyboard.Key.alt, keyboard.KeyCode(char='b'))
    
    # Audio recording parameters
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100
    CHUNK = 1024
    
    def __init__(self, hotkey: tuple = None):
        """
        Initialize BlipkisEars.
        
        Args:
            hotkey: Tuple of pynput keyboard keys/codes for the activation hotkey.
                   Defaults to Command + Option + B.
        """
        self.hotkey = hotkey or self.HOTKEY
        self.is_recording = False
        self.audio_frames: list = []
        self.audio: Optional[pyaudio.PyAudio] = None
        self.stream: Optional[pyaudio.Stream] = None
        self.listener: Optional[keyboard.Listener] = None
        self.recording_thread: Optional[threading.Thread] = None
        self._pressed_keys: set = set()
        self._callback: Optional[Callable[[str], None]] = None
        self._stop_recording = threading.Event()
        
        # Initialize speech recognizer
        self.recognizer = sr.Recognizer()
        # Adjust for ambient noise and energy threshold
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        
    def set_transcription_callback(self, callback: Callable[[str], None]):
        """
        Set a callback function to be called when transcription is complete.
        
        Args:
            callback: Function that accepts the transcribed text string.
        """
        self._callback = callback
    
    def _is_hotkey_pressed(self) -> bool:
        """Check if all hotkey keys are currently pressed."""
        return all(key in self._pressed_keys for key in self.hotkey)
    
    def _on_press(self, key):
        """Handle key press events."""
        try:
            # Normalize key for comparison
            if isinstance(key, keyboard.Key):
                self._pressed_keys.add(key)
            elif isinstance(key, keyboard.KeyCode):
                # Handle both char and vk
                self._pressed_keys.add(key)
                if key.char:
                    self._pressed_keys.add(key.char.lower())
            
            # Check if hotkey was just completed
            if self._is_hotkey_pressed() and not self.is_recording:
                self._start_recording()
                
        except Exception as e:
            print(f"[BlipkisEars] Error in key press handler: {e}")
    
    def _on_release(self, key):
        """Handle key release events."""
        try:
            # Remove key from pressed set
            if key in self._pressed_keys:
                self._pressed_keys.discard(key)
            if isinstance(key, keyboard.KeyCode) and key.char:
                self._pressed_keys.discard(key.char.lower())
            
            # Check if any hotkey key was released
            if not self._is_hotkey_pressed() and self.is_recording:
                self._stop_recording_now()
                
        except Exception as e:
            print(f"[BlipkisEars] Error in key release handler: {e}")
    
    def _start_recording(self):
        """Start recording audio from the microphone."""
        if self.is_recording:
            return
            
        print(f"[BlipkisEars] 🎙️  Recording started at {datetime.now().strftime('%H:%M:%S')}")
        self.is_recording = True
        self.audio_frames = []
        self._stop_recording.clear()
        
        # Start recording in a separate thread
        self.recording_thread = threading.Thread(target=self._record_audio, daemon=True)
        self.recording_thread.start()
    
    def _record_audio(self):
        """Record audio in a loop until stop event is set."""
        self.audio = pyaudio.PyAudio()
        
        try:
            self.stream = self.audio.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                frames_per_buffer=self.CHUNK
            )
            
            while not self._stop_recording.is_set():
                try:
                    data = self.stream.read(self.CHUNK, exception_on_overflow=False)
                    self.audio_frames.append(data)
                except Exception as e:
                    print(f"[BlipkisEars] Read error: {e}")
                    break
                    
        except Exception as e:
            print(f"[BlipkisEars] Error opening audio stream: {e}")
        finally:
            if self.stream:
                try:
                    self.stream.stop_stream()
                    self.stream.close()
                except:
                    pass
            if self.audio:
                try:
                    self.audio.terminate()
                except:
                    pass
    
    def _stop_recording_now(self):
        """Stop recording and trigger transcription."""
        if not self.is_recording:
            return
            
        print(f"[BlipkisEars] ⏹️  Recording stopped at {datetime.now().strftime('%H:%M:%S')}")
        self._stop_recording.set()
        self.is_recording = False
        
        # Wait for recording thread to finish
        if self.recording_thread and self.recording_thread.is_alive():
            self.recording_thread.join(timeout=2.0)
        
        # Process the recorded audio
        if self.audio_frames:
            self._process_recording()
        else:
            print("[BlipkisEars] ⚠️  No audio data captured")
    
    def _process_recording(self):
        """Save recorded audio to temp file and transcribe."""
        # Create temp WAV file
        temp_file = os.path.join(tempfile.gettempdir(), f"blipkis_voice_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav")
        
        try:
            # Write audio to file
            self.audio = pyaudio.PyAudio()
            wf = self.audio.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                output=True
            )
            
            # Actually write to a proper WAV file
            import wave
            with wave.open(temp_file, 'wb') as wav_file:
                wav_file.setnchannels(self.CHANNELS)
                wav_file.setsampwidth(self.audio.get_sample_size(self.FORMAT))
                wav_file.setframerate(self.RATE)
                wav_file.writeframes(b''.join(self.audio_frames))
            
            print(f"[BlipkisEars] 💾 Audio saved to: {temp_file}")
            
            # Transcribe the audio
            self._transcribe_audio(temp_file)
            
        except Exception as e:
            print(f"[BlipkisEars] Error processing recording: {e}")
        finally:
            if self.audio:
                try:
                    self.audio.terminate()
                except:
                    pass
            # Clean up temp file
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except:
                pass
    
    def _transcribe_audio(self, audio_file_path: str):
        """
        Transcribe audio file to text using OpenAI Whisper API for JARVIS-level accuracy.
        
        Args:
            audio_file_path: Path to the WAV file to transcribe.
        """
        print("[BlipkisEars] 🔄 Transcribing audio with OpenAI Whisper...")
        
        # Load environment variables for API key
        load_dotenv()
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("[BlipkisEars] ⚠️  OPENAI_API_KEY not found in .env file")
            # Fallback to free SpeechRecognition
            self._transcribe_audio_fallback(audio_file_path)
            return
        
        # Configure OpenAI client
        client = openai.OpenAI(api_key=api_key)
        
        try:
            # Open the audio file and send to Whisper API
            with open(audio_file_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            
            text = transcription.text
            
            print(f"[BlipkisEars] ✅ Whisper Transcription: \"{text}\"")
            
            # Invoke callback if set
            if self._callback:
                self._callback(text)
            else:
                print(f"[BlipkisEars] No callback set. Transcribed text: {text}")
                
        except openai.APIError as e:
            print(f"[BlipkisEars] ⚠️  OpenAI API error: {e}")
            # Fallback to free SpeechRecognition
            self._transcribe_audio_fallback(audio_file_path)
        except Exception as e:
            print(f"[BlipkisEars] ⚠️  Transcription error: {e}")
            # Fallback to free SpeechRecognition
            self._transcribe_audio_fallback(audio_file_path)
    
    def _transcribe_audio_fallback(self, audio_file_path: str):
        """
        Fallback transcription using free Google Speech Recognition.
        
        Args:
            audio_file_path: Path to the WAV file to transcribe.
        """
        print("[BlipkisEars] 🔄 Using fallback Google Speech Recognition...")
        
        try:
            with sr.AudioFile(audio_file_path) as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.3)
                audio_data = self.recognizer.record(source)
            
            text = self.recognizer.recognize_google(audio_data)
            print(f"[BlipkisEars] ✅ Fallback Transcription: \"{text}\"")
            
            if self._callback:
                self._callback(text)
            else:
                print(f"[BlipkisEars] No callback set. Transcribed text: {text}")
                
        except sr.UnknownValueError:
            print("[BlipkisEars] ⚠️  Could not understand audio")
        except sr.RequestError as e:
            print(f"[BlipkisEars] ⚠️  Speech recognition service error: {e}")
    
    def start_listening(self):
        """Start the global hotkey listener."""
        print(f"[BlipkisEars] 👂 Listening for hotkey: {' + '.join(str(k) for k in self.hotkey)}")
        print("[BlipkisEars] Hold the hotkey to record, release to transcribe.")
        
        self.listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release
        )
        self.listener.start()
        self.listener.join()
    
    def stop_listening(self):
        """Stop the global hotkey listener."""
        if self.is_recording:
            self._stop_recording_now()
        
        if self.listener:
            self.listener.stop()
            self.listener.join(timeout=2.0)
    
    def transcribe_file(self, file_path: str) -> Optional[str]:
        """
        Transcribe an existing audio file (utility method).
        
        Args:
            file_path: Path to the audio file to transcribe.
            
        Returns:
            Transcribed text string, or None if transcription failed.
        """
        try:
            with sr.AudioFile(file_path) as source:
                audio_data = self.recognizer.record(source)
            
            text = self.recognizer.recognize_google(audio_data)
            return text
            
        except sr.UnknownValueError:
            print("[BlipkisEars] Could not understand audio file")
            return None
        except sr.RequestError as e:
            print(f"[BlipkisEars] Speech recognition service error: {e}")
            return None
        except Exception as e:
            print(f"[BlipkisEars] Error transcribing file: {e}")
            return None


def create_voice_integration(blipkis_brain, callback=None):
    """
    Factory function to create a BlipkisEars instance integrated with BlipkisBrain.
    
    Args:
        blipkis_brain: Instance of BlipkisBrain from blipkis_core.py
        callback: Optional callback for raw transcription before brain processing
        
    Returns:
        Configured BlipkisEars instance
    """
    ears = BlipkisEars()
    
    def on_transcription(text: str):
        """Handle transcribed text by passing it to BlipkisBrain."""
        print(f"\n[Voice Integration] Processing voice command: \"{text}\"")
        
        # If a custom callback is provided, call it first
        if callback:
            callback(text)
        
        # Pass to BlipkisBrain for analysis
        if blipkis_brain:
            # Use the voice text as both error log and system prompt
            # This allows voice commands to direct the AI's analysis
            result = blipkis_brain.analyze_error(
                error_log=text,
                code_context="Voice command received - awaiting context",
                system_prompt=f"Voice command from user: {text}"
            )
            print(f"\n[BlipkisBrain] Response: {result}")
    
    ears.set_transcription_callback(on_transcription)
    return ears


# Standalone test function
if __name__ == "__main__":
    print("=" * 60)
    print("BLIPKIS EARS - Voice Module Test")
    print("=" * 60)
    print("\nInstructions:")
    print("  1. Hold Command + Option + B to start recording")
    print("  2. Speak your message")
    print("  3. Release the hotkey to stop and transcribe")
    print("  4. Press Ctrl+C to exit\n")
    
    ears = BlipkisEars()
    
    def test_callback(text):
        print(f"\n✅ Voice command received: \"{text}\"")
        print("   (In production, this would trigger BlipkisBrain)")
    
    ears.set_transcription_callback(test_callback)
    
    try:
        ears.start_listening()
    except KeyboardInterrupt:
        print("\n\n[BlipkisEars] Shutting down...")
        ears.stop_listening()
        print("[BlipkisEars] Goodbye!")