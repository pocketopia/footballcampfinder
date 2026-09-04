<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e80c8d43-9d04-4bbb-a594-0e4cbb3347d6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Optional: Blipkis Voice Module (Python Background Daemon)

`blipkis_voice.py` is a **standalone Python component and is not part of the Vite/React web app build**. It does not run in the browser, is not bundled by Vite, and is not required to run or deploy the Football Camp Finder web app.

It implements `BlipkisEars`, a local, hotkey-activated voice-to-text daemon intended to run in the background on a developer's machine (macOS/Windows/Linux) as a companion tool for agent-assisted development workflows:

- Listens globally for a hotkey (default: `Cmd+Option+B` on macOS, `Ctrl+Alt+B` on Windows/Linux).
- Records microphone audio while the hotkey is held, then transcribes it to text using Google's Speech Recognition API (via the `speech_recognition` package).
- Passes the transcribed text to a callback (e.g., `BlipkisBrain`, an external project-specific integration) for downstream processing.
- Can also transcribe existing audio files via `BlipkisEars.transcribe_file(path)`.

### Setup

This module has its own isolated dependency set, separate from the Node/Vite toolchain, and should be run in a Python virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements_voice.txt
```

`requirements_voice.txt` installs:
- `pyaudio` — microphone audio I/O
- `SpeechRecognition` — speech-to-text transcription
- `pynput` — global hotkey/keyboard listener

### Running the daemon

```bash
python3 blipkis_voice.py
```

This starts the module in standalone test mode: hold the hotkey, speak, release to transcribe, and `Ctrl+C` to exit. In an integrated setup, import `create_voice_integration(blipkis_brain)` from `blipkis_voice.py` to wire transcribed voice commands into your own automation/agent logic.

**Note:** Because this is a native, OS-level background process (it needs microphone and global-hotkey/accessibility permissions), it must be run separately from `npm run dev` / `npm run build` and is not part of the AI Studio web deployment pipeline.
