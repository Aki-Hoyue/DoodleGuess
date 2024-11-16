import React, { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import './style.css';

const socket = io('http://localhost:3001');

const DrawingCanvas = () => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [isErasing, setIsErasing] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [players, setPlayers] = useState([]);
    const location = useLocation();
    const { roomId, password, nickname } = location.state || {};

    useEffect(() => {
        console.log('DrawingCanvas 组件已挂载');
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 加入房间
        if (roomId && nickname) {
            // 加入房间并添加自己到玩家列表
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, nickname });            
        }

        socket.on('update players', (updatedPlayers) => {
            console.log(`Player list for room ${roomId}:`, updatedPlayers);
            // 将绘画者的昵称固定在列表的第一个位置
            const sortedPlayers = [nickname, ...updatedPlayers.filter(player => player !== nickname)];
            setPlayers(sortedPlayers);
        });

        return () => {
            console.log('DrawingCanvas 组件即将卸载');
            // 清理画布
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            // 离开房间
            if (roomId) {
                console.log(`Leaving room ${roomId} with nickname ${nickname}`);
                socket.emit('leave room', roomId, nickname);
            }
            // 断开 socket 连接
            socket.disconnect();
        };
    }, [roomId, nickname]);

    const getMousePos = (canvas, evt) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getMousePos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getMousePos(canvas, e);
        if (isErasing) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 10; // 橡皮擦的线宽
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2; // 画笔的线宽
        }
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleConfirm = async () => {
        if (keyword.trim()) {
            const canvas = canvasRef.current;
            const dataURL = canvas.toDataURL('image/png'); 
            // 将 base64 字符串转换为 Blob
            const blob = await (await fetch(dataURL)).blob();

            // 创建 FormData 对象
            const formData = new FormData();
            formData.append('image', blob, `drawing_${roomId}_${Date.now()}.png`);

            try {
                // 调用后端 API 上传图片
                const response = await fetch('http://localhost:3000/upload-image', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    const imageUrl = result.url; 
                    socket.emit('submit drawing', { roomId, keyword: keyword.trim(), drawing: dataURL });
                    setKeyword('');
                    // 清空画布
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    alert('图片已上传成功');
                } else {
                    throw new Error('图片上传失败1');
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('图片上传失败2: ' + error.message);
            }
        }

        else{
            alert('Please enter a keyword');
        }
    };
    

    return (
        <div className="game-container">
            <div className="canvas-container">
                <h1>Draw as you like</h1>
                {roomId && <p>Room ID: {roomId}</p>}
                {password && <p>Password: {password}</p>}
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={800}
                    style={{ border: '1px solid black' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                ></canvas>
                <div className='sidebar'>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="Enter a keyword"
                        />
                </div>
                <div className="button-container">                
                    <button className="canvas-button" onClick={handleClear}>Clear</button>
                    <button className="canvas-button" onClick={handleConfirm}>Confirm</button>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        title="Choose your color"
                        className="canvas-button color-picker"
                    />
                    <button
                        className="canvas-button"
                        onClick={() => setIsErasing(!isErasing)}
                    >
                        {isErasing ? 'Stop Erasing' : 'Erase'}
                    </button>
                </div>                               
            </div>
            <div className="players-list">
                <h3>Players({players.length})</h3>
                <ul>
                    {players.map((player, index) => (
                        <li key={index}>{player}{player === nickname ? ' (You)' : ''}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default DrawingCanvas;