# Plot Engineering

[![Game](https://img.shields.io/badge/Play%20Here-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://caelanhehir.github.io/Plot-engineering/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=flat-square&logo=google)](https://ai.google.dev/)
[![Multiplayer WebRTC](https://img.shields.io/badge/Multiplayer-PeerJS%20WebRTC-informational?style=flat-square)](https://peerjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

Plot Engineering is a co-op storytelling game where players work together to get through different scenes, creating a funny story along the way.

To play the game, one player must host a room. As the host, they get to choose the theme of the multi-round campaign they and their friends will embark on! Each round will present the group with an obstacle, and everyone will write out their plans **without communicating with the others**! The **Judge** will then paint a picture of what happened using each player's input, and if everyone's actions work together to convincingly solve the problem, they pass the round! Otherwise, they fail, and the game ends.

The twist is that players also earn points based on how important their actions were each round, and if the team gets to the end, the player with the most points wins. This means that in order to be at the top, you may have to sabotage your teammates, but be careful not to go too far, or you might accidentally sabotage the entire round too!

---

## Gameplay Features
- **Character creation**: Players choose their character's name & occupation, and can even give them an item or ability to start with. Character traits have an impact on how the Judge evaluates them.
- **Portrait Canvas**: A feature allowing players to draw their character's portrait before the game starts. This doesn't have any effect on the gameplay but I thought it was cool.
- **Scoreboard**: After each round, players are ranked depending on how much they contributed to passing the level.
- **Character traits**: Depending on what happens during a round, characters may gain positive or negative effects that will impact what they are able to do. Players must keep these in mind while choosing their actions!
- **The Judge**: A system that analyzes the team's actions, plays out the scenario, and decides whether they passed or failed. It takes into account humour, coherence, and collaboration.
- **8-Player Capacity**: Rooms support up to 8 players.


## Technical Features
- **AI Storytelling**: The game uses an LLM to analyze player input, generate the story, decide who contributed the most, whether the team succeeded or not, etc... It requires the player hosting the room to input a Gemini API key in order to work (check out the [Security](#security) section for privacy concerns).
- **Peer-to-Peer Multiplayer & Room Hosting**: Creating a room works using PeerJS WebRTC, allowing the Host's browser to run the authoritative game room directly on their device without a dedicated game backend:
  - When the Host creates a 4-letter room code (e.g., `ABCD`), their browser registers a deterministic Peer ID (`plot-eng-room-ABCD`) with the PeerJS signaling broker.
  - Joining devices look up that Peer ID and establish a direct WebRTC DataChannel using configured Google, Cloudflare, and Twilio STUN servers for direct P2P NAT traversal across compatible Wi-Fi and mobile networks.
  - Once connected, the client sends a `JOIN_REQUEST` over the DataChannel and the Host broadcasts sanitized `STATE_UPDATE` snapshots to all connected peers.
- **Procedural Audio System**: Sounds are generated using the Web Audio API, meaning no external audio assets need to be loaded.

---

## Playing the game
The game is hosted for free on GitHub Pages. You can play it in your web browser **[here](https://caelanhehir.github.io/Plot-engineering/)**!

> **Joining from Another Device (Phones / Tablets / Laptops):**
> To connect multiple devices together, open the **[GitHub Pages link](https://caelanhehir.github.io/Plot-engineering/)** on each device (or scan the Host's in-game QR code). If you are testing locally across multiple devices on the same Wi-Fi, bind your local server to `0.0.0.0` and visit your machine's LAN IP (`http://192.168.x.x:8000`) rather than `localhost`.

### Requirements
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (only the Host needs one).
- Your imagination!!!1 🦄✨🥰🌈🧙

---

## Project Structure
```bash
Plot-engineering/
├── .gitignore
├── .nojekyll                 # Disables Jekyll processing on GitHub Pages
├── LICENSE                   # MIT License
├── README.md                 # That's me!
├── index.html                # Application entrypoint & screen templates
├── tests/
│   └── judge.test.js         # Unit tests for scoring & Judge normalization
└── assets/
    ├── css/
    │   ├── base.css          # Design tokens, typography, and responsive grids
    │   ├── components.css    # Cards, buttons, modals, badges, and HUD
    │   └── screens.css       # Screen layouts, podiums, and animations
    └── js/
        ├── main.js           # App bootstrapping, routing, and event delegation
        ├── data/
        │   └── campaigns.js  # Scenario library and campaign templates
        ├── state/
        │   ├── store.js      # Centralized reactive application state
        │   └── session.js    # Session persistence and room code storage
        ├── features/
        │   ├── canvas.js     # Character drawing canvas controller
        │   └── settings.js   # Game house rules and API key management
        ├── services/
        │   ├── audio.js      # Procedural sound effect synthesizer
        │   ├── network.js    # WebRTC host/client room networking & STUN config
        │   └── gemini/       # Modular Google Gemini API client, judge & bots
        │       ├── index.js
        │       ├── client.js
        │       ├── campaign.js
        │       ├── judge.js
        │       ├── fallbackJudge.js
        │       └── bots.js
        └── ui/
            ├── render.js     # Top-level phase router and HUD controller
            ├── utils.js      # HTML sanitization and UI helper utilities
            └── screens/      # Per-screen renderers and controllers
                ├── lobby.js
                ├── charCreate.js
                ├── scenario.js
                ├── reveal.js
                └── gameOver.js
```

---

## Local Development
Plot Engineering uses zero build steps and native ES modules (`type="module"`). You can run and modify it immediately using any local static file server.

### Example 1: Python
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

### Example 2: Node.js (npx)
```bash
npx serve .
```

### Example 3: VS Code Live Server
Right-click `index.html` and click **"Open with Live Server"**.

---

### Running Tests
Unit tests use the built-in Node.js test runner (`node:test`) with zero external dependencies:
```bash
node --test tests/judge.test.js
```

---

## Security
- **API Key Security:** The Gemini API key is stored exclusively in-memory for the duration of the active browser session. It is never saved to `localStorage` or disk, and closing or reloading the tab immediately purges the key.
- **Session Persistence:** Active room codes, player identities, and room snapshots are stored in `sessionStorage` (scoped to the active tab) so accidental reloads do not terminate games.
- **P2P Multiplayer:** Game data is synchronized directly between player browsers using end-to-end WebRTC peer connections.
- **Authoritative Host & Move Visibility:** Because the Host browser is authoritative and assembles the round prompt for the Judge, every player's submitted move is sent in plain text to the Host (`getPublicState` masks moves for client peers until reveal, but returns plain text when `app.isHost` is true). Even though the game is "silent co-op," the Host can technically read everyone's moves.
- **Prompt Injection Defense:** System rules are passed via Gemini's dedicated systemInstruction field, and player-submitted fields (submittedAction, names, roles, and traits) are sanitized and marked as untrusted data so attempts to instruct the Judge ("rank me first") are penalized in-story rather than obeyed.
- **Privacy & External API Transmission:** When using an AI Judge, round scenarios and submitted player actions are sent to Google via the Gemini API under the Host's in-memory API key. Do not submit sensitive or private personal information.
---

## License
Distributed under the MIT License. See [LICENSE](LICENSE) for full details.
