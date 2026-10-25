# 🎭 Plot Engineering

> **A Co-Op AI Comedy Scenario Party Game**
> Doodle your hero, engineer chaotic multi-round adventures together in total silence, and let Google Gemini judge your team's coordination, coherence, and comedic genius!

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://caelanhehir.github.io/Plot-engineering/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=flat-square&logo=google)](https://ai.google.dev/)
[![Multiplayer WebRTC](https://img.shields.io/badge/Multiplayer-PeerJS%20WebRTC-informational?style=flat-square)](https://peerjs.com/)

---

## 🌟 Highlights

- **🎨 In-Browser Doodle Canvas:** Draw and personalize your hero avatar with responsive touch & mouse drawing tools.
- **🤫 The Silent Challenge:** Players must coordinate actions without speaking aloud to tackle wacky escalating story crises.
- **🤖 Gemini AI Game Master:** Leverages Google's high-speed Gemini Flash model to evaluate team cohesion, calculate player scores, and narrate cinematic, side-splitting round recaps.
- **🌐 Peer-to-Peer Multiplayer:** Free, frictionless room-code matchmaking powered by PeerJS WebRTC—no dedicated backend or login required.
- **🔊 Procedural Audio System:** Built-in retro/party game sound synthesizer using the Web Audio API with zero external audio assets.
- **📱 Fully Responsive:** Optimized layout with smooth animations, custom cartoon typography, and touch support across desktop and mobile.

---

## 🚀 Live Demo & Play

Play immediately in your web browser:
👉 **[https://caelanhehir.github.io/Plot-engineering/](https://caelanhehir.github.io/Plot-engineering/)**

### Requirements to Host
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (Host only — joining players do not need an API key).

---

## 📁 Project Structure

```text
Plot-engineering/
├── .gitignore             # Standard git ignore definitions
├── .nojekyll              # Bypasses Jekyll processing on GitHub Pages
├── LICENSE                # MIT License
├── README.md              # Project documentation
├── index.html             # Application entrypoint & screen templates
└── assets/
    ├── css/
    │   ├── base.css       # Design tokens, typography, and reset styles
    │   ├── components.css # Cards, buttons, modals, badges, and HUD
    │   └── screens.css    # Screen layouts, podiums, and animations
    └── js/
        ├── main.js        # App bootstrapping, routing, and event delegation
        ├── data/
        │   └── campaigns.js  # Scenario library and campaign templates
        ├── features/
        │   ├── canvas.js     # Character drawing canvas controller
        │   └── settings.js   # Game house rules and API key management
        ├── services/
        │   ├── audio.js      # Procedural sound effect synthesizer
        │   ├── gemini.js     # Google Gemini API integration and judge prompt
        │   └── network.js    # WebRTC host/client room networking
        └── ui/
            ├── render.js     # Screen renderers, podiums, and view updates
            └── utils.js      # HTML sanitization and UI helper utilities
```

---

## 🛠️ Local Development

Because Plot Engineering is built with zero build steps or transpilation requirements, you can run and modify it immediately using any local static file server:

### Option 1: Python
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

### Option 2: Node.js (npx)
```bash
npx serve .
```

### Option 3: VS Code Live Server
Right-click `index.html` and click **"Open with Live Server"**.

---

## 🔒 Privacy & Security

- **Client-Side Only:** Your Gemini API key is stored securely in your browser's `localStorage` and is never sent to any external server other than Google's official Gemini endpoint (`generativelanguage.googleapis.com`).
- **P2P Multiplayer:** Game state and doodles are synchronized directly between player browsers using end-to-end WebRTC peer connections.

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for full details.
