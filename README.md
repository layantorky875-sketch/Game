# Street Rush Arena (MVP)

An original 3D browser-game prototype with a fictional Egyptian-city circuit. Node.js serves the game and Socket.IO handles the live lobby, chat and race state. It is designed to work on desktop and mobile browsers; the PWA manifest allows installation from a supported browser.

## Run locally

```sh
npm install
npm start
```

Open `http://localhost:3000`. To test multiplayer, open the URL in two browser tabs or on two devices using the same server address. The server requires at least two real players to start a group race. Solo mode adds five AI opponents. The lobby supports up to 10 human players.

## Deploy

Use a Node.js host that supports persistent WebSocket connections. Set `PORT` if required by the host. Serve over HTTPS in production for browser PWA installation and mobile audio/input behavior.

## Current prototype scope

- Third-person chase, simplified cockpit, and overhead drone camera views.
- Procedurally generated low-poly city scene: apartment blocks, shopfronts without real shop names, trees, streetlights, parked cars, and a fictional circuit.
- Live room lobby, room code, chat, mobile touch controls, keyboard controls, AI rivals, finish order, and demo coin rewards.
- Demo only: this does not use real Street View/map imagery, authenticate persistent accounts, save progress, run a physics engine, or process purchases/ads. The cockpit is a camera view, not a detailed interior yet. The visual city is original procedural art, not a photoreal copy of Sadat City. Coin rewards are in-memory demo values, not real currency or wagering.

Three.js is loaded from jsDelivr, so the first load needs internet access. Before a commercial launch, add persistent account storage, moderation, rate limiting, real car licenses/assets, an original detailed cockpit, mobile performance testing, and appropriate privacy/legal review.
