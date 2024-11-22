const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const util = require('util');
const path = require('path');
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const { spawn } = require('child_process')
const axios = require('axios');
const FormData = require('form-data'); 
const { Readable } = require('stream');
const app = express();
const { instrument } = require("@socket.io/admin-ui");
const dotenv = require('dotenv');
const pythonPath = 'D:\\Anaconda\\python.exe';

dotenv.config(); // load .env
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
instrument(io, {
    auth: false
});

let rooms = {};

// drawing upload
app.post('/upload-drawing', async (req, res) => {
    try {
        const { roomId, imageData, keyword } = req.body;
        
        // Convert base64 to file and save temporarily
        const imageBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const tempFilePath = path.join(__dirname, 'temp_drawing.png');
        fs.writeFileSync(tempFilePath, imageBuffer);

        // Create FormData and append file
        const formData = new FormData();
        formData.append('smfile', fs.createReadStream(tempFilePath));

        // Upload to img url api
        const response = await axios.post(process.env.SMMS_IMG_URL_BASE_URL, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': process.env.SMMS_IMG_URL_API
                // 'Content-Type': 'multipart/form-data'
                // 'Authorization': `Bearer ${process.env.HELLO_IMG_URL_API}`
            },
        });

        // Delete temporary file
        fs.unlinkSync(tempFilePath);

        if (response.data.success) {
            const imageUrl = response.data.data.url;

            if (rooms[roomId]) {
                rooms[roomId].imageUrl = imageUrl;
                rooms[roomId].keyword = keyword;
            }
            
            // Notify all players in the room about the new drawing
            io.to(roomId).emit('new drawing', { imageUrl });
            
            res.json({ imageUrl });
        } else {
            throw new Error('Image upload failed');
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

function callPythonScript(keyword, guesses) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonPath, ['ai.py', keyword, ...guesses]);
        
        let result = '';
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
            reject(data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(`Python process exited with code ${code}`);
            } else {
                resolve(JSON.parse(result));
            }
        });
    });
}

// submit guess to AI
app.post('/submit-guess', async (req, res) => {
    const { roomId, nickname, guess } = req.body;
    console.log(`Received guess: Room ${roomId}, Nickname ${nickname}, Guess "${guess}"`);
    const room = rooms[roomId];

    if (room) {
        room.guesses[nickname] = guess; // Store the guess temporarily if not all guesses are gathered yet
        console.log(`Number of guesses in room ${roomId}: ${Object.keys(room.guesses).length}`);
        if (Object.keys(room.guesses).length === room.players.length - 1) {
            try {
                console.log(`Preparing to call AI script, Keyword: "${room.keyword}", Guesses: ${JSON.stringify(Object.values(room.guesses))}`);
                const aiJudgments = await callPythonScript(room.keyword, Object.values(room.guesses));
                console.log(`AI returned result: ${JSON.stringify(aiJudgments)}`);
                // process the AI judgment results
                const judgments = aiJudgments.map((judgment, index) => ({
                    nickname: Object.keys(room.guesses)[index],
                    guess: room.guesses[Object.keys(room.guesses)[index]],
                    ...judgment
                }));

                room.aiJudgments = judgments;
                console.log(`Processed ai judgment results: ${JSON.stringify(judgments)}`);

                // send the AI judgments to the drawer
                console.log(`Current players in room ${roomId}: ${JSON.stringify(room.players)}`);
                console.log(`Emitting 'ai judgments' event to room ${roomId}`);
                io.to(roomId).emit('ai judgments', judgments);

                res.json({ message: 'All guesses processed' });
            } catch (error) {
                console.error('Error processing guesses:', error);
                res.status(500).json({ error: 'Failed to process guesses' });
            }
        } else {
            res.json({ message: 'Guess submitted successfully' });
        }
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// WebSocket connection
io.on('connection', (socket) => {
    let userInfo = null;

    socket.on('create room', ({ password, maxPlayers, rounds, creatorNickname }) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = {
            players: [{
                nickname: creatorNickname,
                role: 'drawer',
                socketId: socket.id
            }],
            password: password,
            drawer: creatorNickname,
            keyword: null,
            imageUrl: null,
            guesses: {},
            readyPlayers: new Set(),
            maxPlayers: maxPlayers,
            totalRounds: rounds,
            currentRound: 1,
            playersDrawn: 0,
            playerScores: {} 
        };

        socket.join(roomId);
        socket.emit('room created', { 
            roomId,
            players: rooms[roomId].players,
            drawer: creatorNickname
        });
        io.to(roomId).emit('update players', rooms[roomId].players);
    });
    
    socket.on('join room', ({ roomId, nickname, role }) => {   
        userInfo = { roomId, nickname };   
        const room = rooms[roomId];
        if (room) {
            if (!room.playerScores[nickname]) {
                room.playerScores[nickname] = { correctGuesses: 0, drawingsGuessedCorrectly: 0 };
            }
            const existingPlayerIndex = room.players.findIndex(p => p.nickname === nickname);           
            if (existingPlayerIndex !== -1) {
                // Player is rejoining
                room.players[existingPlayerIndex].socketId = socket.id;
                room.players[existingPlayerIndex].role = role; // Update role if changed
            } else {
                // New player joining
                if (room.players.length < room.maxPlayers) {
                    room.players.push({
                        nickname,
                        role: role || 'guesser',
                        socketId: socket.id                        
                    });
                } else {
                    socket.emit('room full');
                    return;
                }
            }

            socket.join(roomId);
            
            // If this player is the drawer, update room.drawer
            if (role === 'drawer') {
                room.drawer = nickname;
            }

            // Send room info to the joining player
            socket.emit('room joined', {
                roomId,
                players: room.players,
                drawer: room.drawer,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                imageUrl: room.imageUrl,
                finalScores: room.playerScores,
                keyword: room.keyword 
            });

            // Notify others about the new/rejoined player
            socket.to(roomId).emit('player joined', { nickname, role });

            // Update all clients with new player list
            io.to(roomId).emit('update players', room.players);
        } else {
            socket.emit('room not found');
        }
    });

    socket.on('check password and nickname', ({ roomId, password, nickname }) => {
        const room = rooms[roomId];
        if (room) {
            if (room.password === password) {
                if (room.players.find(p => p.nickname === nickname)) {
                    socket.emit('duplicate nickname');
                } else {
                    socket.emit('password and nickname valid');
                }
            } else {
                socket.emit('incorrect password');
            }
        } else {
            socket.emit('room not found');
        }
    });

    socket.on('leave room', ({ roomId, nickname }) => {
        console.log('Player list', rooms[roomId].players);
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(player => player.nickname !== nickname);
            console.log('Player list after leaving', rooms[roomId].players);
            
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted as it's empty`);
            } else {
                io.to(roomId).emit('update players', rooms[roomId].players);
            }
        }
    });

    // Send AI judgments to the drawer 
    socket.on('ai judgments', ({ roomId, judgments }) => {
        console.log(`Received AI judgments for room ${roomId}:`, judgments);
        const room = rooms[roomId];
        if (room) {
            room.aiJudgments = judgments;            
            socket.to(room.judge).emit('ai judgments', judgments);
        }
    });

    socket.on('judge result', ({ roomId, judgments }) => {
        const room = rooms[roomId];
        if (room) {                       
            // Combine AI judgments with drawer judgments
            room.readyPlayers = new Set(); // Reset ready players
            const finalResults = {};
            for (const [nickname, isCorrect] of Object.entries(judgments)) {
                const aiJudgment = room.aiJudgments.find(j => j.nickname === nickname);
                finalResults[nickname] = {
                    guess: room.guesses[nickname],
                    aiJudge: aiJudgment.Judge,
                    aiReason: aiJudgment.Reason,
                    drawerJudge: isCorrect
                };

                // If player's guess is correct (drawer's judgment matches AI judgment), increment correct guesses
                if ((finalResults[nickname].aiJudge === finalResults[nickname].drawerJudge)) {
                    room.playerScores[nickname].correctGuesses++;
                    room.playerScores[room.drawer].drawingsGuessedCorrectly++;
                }
            }

            // Send the final results to all guessers
            room.players.forEach(player => {
                if (player.role === 'guesser') {
                    const playerResult = finalResults[player.nickname];
                    if (playerResult) {
                        io.to(player.socketId).emit('personal judgment', playerResult);
                    }
                }
            });

            // 广播更新后的猜测列表给所有玩家
            io.to(roomId).emit('update guesses', room.guesses);
        }
    });

    socket.on('player ready', ({ roomId, nickname }) => {
        if (rooms[roomId]) {
            if (!rooms[roomId].readyPlayers) {
                rooms[roomId].readyPlayers = new Set();
            }
            rooms[roomId].readyPlayers.add(nickname);

            // Update all players in the room with the updated ready players list
            io.to(roomId).emit('update ready players', Array.from(rooms[roomId].readyPlayers));

            // Whether all players are ready
            if (rooms[roomId].readyPlayers.size === rooms[roomId].players.length) {              
                const room = rooms[roomId];
                room.playersDrawn++;
                console.log('player list:', room.players);
                console.log('players drawn:', room.playersDrawn);

                if (room.playersDrawn === room.players.length) { // If all players have drawn, go to next round
                    room.currentRound++;
                    room.playersDrawn = 0;
                    console.log('current round:', room.currentRound);
                    console.log('total rounds:', room.totalRounds);
                }
                
                if (room.currentRound > room.totalRounds) { // If all rounds are done, game over
                    console.log('all rounds are done, send game over');
                    console.log('Sending final scores:', room.playerScores);
                    io.to(roomId).emit('game over', room.playerScores);  
                    console.log('Deleting room:', roomId); 
                    delete rooms[roomId];                  
                } else {
                    // next drawer
                    const currentDrawerIndex = room.players.findIndex(p => p.role === 'drawer');
                    const nextDrawerIndex = (currentDrawerIndex + 1) % room.players.length;
                    room.players[currentDrawerIndex].role = 'guesser';
                    room.players[nextDrawerIndex].role = 'drawer';
                    room.drawer = room.players[nextDrawerIndex].nickname;
                    room.keyword = null;
                    room.imageUrl = null;
                    room.guesses = {};
                    room.readyPlayers = new Set(); // Reset ready players                   
                    
                    // Notify all players in the room the new round starting
                    console.log(`New round starting in room ${roomId}`);
                    io.to(roomId).emit('new round', {
                        currentDrawer: room.players[nextDrawerIndex].nickname,
                        password: room.password
                    });                                                                        
                }
            }
        }
    });

    socket.on('disconnect', () => {
        if (userInfo) {
            const { roomId, nickname } = userInfo;
            const room = rooms[roomId];
            
            if (room) {
                console.log(`Player ${nickname} disconnected from room ${roomId}`);
                // 从房间中移除玩家
                room.players = room.players.filter(player => player.nickname !== nickname);
                console.log('Player list after disconnection:', room.players);
                
                if (room.players.length === 0) {
                    // 如果房间空了，删除房间
                    console.log(`Room ${roomId} is empty, deleting...`);
                    delete rooms[roomId];
                } else {
                    // 通知其他玩家更新玩家列表
                    io.to(roomId).emit('update players', room.players);
                }
            }
        }
    });
});

server.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
});