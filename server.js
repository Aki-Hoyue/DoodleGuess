const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // 导入 image.py 中的函数

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

let rooms = {};

// 处理图像上传
app.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }
        console.log('Received file:', req.file.originalname, 'Size:', req.file.size);

        const imageBuffer = req.file.buffer;
        const imageUrl = await image_upload(imageBuffer);
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Error in /upload-image route:', error);
        res.status(500).json({ error: `Image upload failed: ${error.message}` });
    }
});

// WebSocket 连接
io.on('connection', (socket) => {
    
    socket.on('join room', ({ roomId, nickname }) => {
        console.log(`Player ${nickname} joined room ${roomId}`);
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [] };
        }
        if (!rooms[roomId].players.includes(nickname)) {
            rooms[roomId].players.push(nickname);
        }
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

    socket.on('submit drawing', ({ roomId, keyword, drawing }) => {
        if (rooms[roomId]) {
            rooms[roomId].keyword = keyword;
            
            // 保存图片
            const base64Data = drawing.replace(/^data:image\/png;base64,/, "");
            const fileName = `drawing_${roomId}_${Date.now()}.png`;
            const filePath = path.join(__dirname, 'public', fileName);
            
            fs.writeFile(filePath, base64Data, 'base64', (err) => {
                if (err) {
                    console.error('Error saving the image:', err);
                } else {
                    console.log('The image has been saved successfully');
                    // 通知房间内的其他玩家新的绘画已提交
                    socket.to(roomId).emit('new drawing', { keyword, imagePath: fileName });
                }
            });
        }
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