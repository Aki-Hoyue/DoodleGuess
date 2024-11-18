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
const FormData = require('form-data');  // 确保这行正确引入
const { Readable } = require('stream');
const app = express();
const pythonPath = 'D:\\Anaconda\\python.exe';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

let rooms = {};

// Modify the room creation to include a playerCount
app.post('/create-room', (req, res) => {
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    const { maxPlayers } = req.body;
    rooms[roomId] = {
        players: [],
        drawer: null,
        keyword: null,
        imageUrl: null,
        guesses: {},
        allGuessesSubmitted: false,
        maxPlayers: maxPlayers
    };
    res.json({ roomId });
});

// 处理图像上传
app.post('/upload-drawing', async (req, res) => {
    try {
        const { roomId, imageData, keyword } = req.body;
        
        // 将 base64 图像数据转换为 Buffer
        const imageBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        // 创建一个可读流
        const stream = new Readable();
        stream.push(imageBuffer);
        stream.push(null);

        // 创建 FormData 对象
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'drawing.png',
            contentType: 'image/png',
            //knownLength: imageBuffer.length 
        });

        // 发送请求到图片上传 API
        const response = await axios.post('http://localhost:8000/api/upload', formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        const imageUrl = response.data.url;

        if (rooms[roomId]) {
            rooms[roomId].imageUrl = imageUrl;
            rooms[roomId].keyword = keyword;
        }
        
        // 通知房间内的所有玩家有新的绘画
        io.to(roomId).emit('new drawing', { imageUrl });
        
        res.json({ imageUrl });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/submit-guess', async (req, res) => {
    try {
        const { roomId, nickname, guess } = req.body;
        const room = rooms[roomId];
        console.log('Received guess:', { roomId, nickname, guess });

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Record the guess
        room.guesses[nickname] = guess;

        // Check if all players have submitted their guesses
        if (Object.keys(room.guesses).length === room.players.length - 1) { // -1 because the drawer doesn't guess
            room.allGuessesSubmitted = true;

            // Prepare data for AI judgment
            const judgmentData = {
                keyword: room.keyword,
                guessed: Object.values(room.guesses)
            };

            try {
                // Make a POST request to the AI judgment API
                const response = await axios.post('http://localhost:8000/api/judge', judgmentData);
                const aiJudgments = response.data;

                // Combine guesses with AI judgments
                const guessResults = Object.entries(room.guesses).map(([nickname, guess], index) => ({
                    nickname,
                    guess,
                    judgment: aiJudgments[index]
                }));

                // Send judgments to all players
                io.to(roomId).emit('all guesses', guessResults);                
                res.json({ message: 'All guesses processed' });
                
            } catch (error) {
                console.error('Error calling AI judgment API:', error);
                res.status(500).json({ error: 'AI judgment failed' });
            }
        } else {
            // If not all players have guessed yet, just acknowledge the guess
            res.json({ message: 'Guess received' });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// WebSocket 连接
io.on('connection', (socket) => {
    
    socket.on('join room', ({ roomId, nickname, maxPlayers }) => {           
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [], maxPlayers };
            console.log(`Room ${roomId} created with max players ${maxPlayers}`);
        }
        
        if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
            console.log(`Room ${roomId} is full`);
            socket.emit('room full');
            return;
        }

        if (!rooms[roomId].players.includes(nickname)) {
            rooms[roomId].players.push(nickname);
        }
        console.log(`Player ${nickname} joined room ${roomId}`); 
        socket.join(roomId);   
        io.to(roomId).emit('update players', rooms[roomId].players);
    });

    socket.on('leave room', ({ roomId, nickname }) => {
        console.log(`Player ${nickname} left room ${roomId}`);
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(player => player !== nickname);
            io.to(roomId).emit('update players', rooms[roomId].players);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            }
        }
    });

    socket.on('set keyword', ({ roomId, keyword }) => {
        if (rooms[roomId]) {
            rooms[roomId].keyword = keyword;
            // 可能需要通知其他玩家关键词已设置
        }
    });

    socket.on('judge result', ({ roomId, nickname, guess, result }) => {
        // 发送最终判断结果给猜画者
        io.to(roomId).emit('guess result', { 
            nickname,
            guess,
            correct: result === 'approve',
            message: result === 'approve' ? 'Your guess was correct!' : 'Your guess was incorrect. Try again!'
        });
        // 通知绘画者判断已完成，可以进行下一个判断
        socket.emit('judgment complete');
    });

});

app.get('/run-python', (req, res) => {
    exec('python3 image.py', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return res.status(500).send('Error executing Python script');
        }
        if (stderr) {
            console.error(`Python script stderr: ${stderr}`);
            return res.status(500).send('Python script error');
        }
        console.log(`Python script stdout: ${stdout}`);
        res.send(`Python script output: ${stdout}`);
    });
});

server.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
});