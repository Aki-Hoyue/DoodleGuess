# DoodleGuess
English | [中文](https://github.com/Aki-Hoyue/DoodleGuess/blob/main/README_cn.md)    
DoodleGuess is an online multiplayer drawing and guessing game powered by **AI judgment**. Players create or join rooms to play, where one player draws while others guess. The game utilizes AI technology for guess evaluation, with final confirmation from the drawer.

## Key Features
- Real-time drawing with WebSocket
- AI-assisted answer judgment
- Room management system
- Scoring system

## Technology Stack
Frontend:
- React.js
- WebSocket
- HTML5 Canvas

Backend:
- FastAPI
- WebSocket
- OpenAI API

## System Architecture
### Main Frontend Components

1. **RoomManagement - Room Management Component**
   - Create a room
   - Join a room
   - Set room parameters

2. **DrawingCanvas - Drawing Component**
   - HTML5 Canvas drawing functionality
   - Pen/Eraser tools
   - Brush size/color selection

3. **Viewer - Viewer Component**
   - View real-time drawing
   - Submit guesses

4. **Judge - Judging Component**
   - Display AI judgment results
   - Manual confirmation of judgment

### Main Backend Modules

1. **websocket.py - WebSocket Management**
2. **game.py - Game Logic**

![Architecture.png](https://s2.loli.net/2024/12/14/pBNoh6nYQ8zIDAd.png)

## Game Flow

1. Create/Join Room
   - Set room password
   - Set maximum number of players
   - Set number of rounds
2. Game Round
   - Take turns being the artist
   - Other players guess
   - AI judgment + manual confirmation
   - Score update
3. Game End
   - Display final scores
   - Show detailed statistics

![Flow.png](https://s2.loli.net/2024/12/14/zk461R3ebLlBAPV.png)

## API Documentation

### WebSocket Events

| Event            | Description  | Data Structure                 |
| ---------------- | ------------ | ------------------------------ |
| create_room      | Create a room| `{roomId, settings}`           |
| join_room        | Join a room  | `{roomId, playerId}`           |
| submit_drawing   | Submit drawing| `{roomId, imageData}`         |
| submit_guess     | Submit a guess | `{roomId, playerId, guess}` |

### REST API

| Endpoint         | Method | Description      |
| ---------------- | ------ | ---------------- |
| /api/rooms       | GET    | Get room list    |
| /api/rooms       | POST   | Create a new room|
| /api/rooms/{id}  | GET    | Get room details |

## Deployment

```shell
# Install dependencies
pip install -r requirements.txt
npm install

# Start backend
uvicorn main:app --reload

# Start frontend
npm start
```

## Configuration
You can copy `.env.example`, modify it, and rename it to `.env`. It contains the following configurations.

```shell
# AI Configuration
AI_MODEL=YOUR_MODEL_HERE
AI_BASE_URL=YOUR_BASE_URL_HERE
AI_KEY=YOUR_API_KEY_HERE

# Server Configuration
REACT_APP_SERVER_BASE_URL=YOUR_SERVER_BASE_URL_HERE
```

## TODO

1. **Feature Enhancements**
   - Add more drawing tools
   - Support undo/redo
   - Add game modes
2. **Performance Optimization**
   - WebSocket connection optimization
   - Image transmission compression
   - Frontend performance optimization
3. **User Experience**
   - Mobile device adaptation
   - Internationalization support
   - Theme customization

## Contributors

- Backend Engineer: [![@Aki-Hoyue](https://avatars.githubusercontent.com/u/73027485?s=64&v=4)](https://github.com/Aki-Hoyue)[**Aki-Hoyue** Hoyue](https://github.com/Aki-Hoyue)
- Frontend Engineer: [![@0216Feng](https://avatars.githubusercontent.com/u/90129509?s=64&v=4)](https://github.com/0216Feng)[**0216Feng** HUO ZHIFENG](https://github.com/0216Feng)