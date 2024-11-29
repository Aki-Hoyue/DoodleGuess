import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    const [brushSize, setBrushSize] = useState(2);
    const [currentDrawer, setCurrentDrawer] = useState('');
    const [isDrawer, setIsDrawer] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const location = useLocation();
    const navigate = useNavigate(); 
    const { roomId, password, nickname, role, players: initialPlayers } = location.state || {};

    useEffect(() => {
        console.log('DrawingCanvas 组件已挂载');
        console.log('Initial players:', initialPlayers);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, password, nickname, role: 'drawer' });            
        }

        socket.on('room joined', (roomInfo) => {
            console.log('Joined room:', roomInfo);
            setPlayers(roomInfo.players);
            setCurrentRound(roomInfo.currentRound);
            setTotalRounds(roomInfo.totalRounds);
        });

        socket.on('update players', (updatedPlayers) => {
            console.log('Updated players:', updatedPlayers);
            setPlayers(updatedPlayers);
        });

        // Omit leave room event when closing tab or browser
        const handleBeforeUnload = () => {
            socket.emit('leave room', { roomId, nickname });
        };
    
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            console.log('DrawingCanvas 组件即将卸载');
            // Clear the canvas when the component is unmounted
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            // Leave the room when out of the gaming pages
            if (!window.location.pathname.includes('/draw') &&
                !window.location.pathname.includes('/view') &&
                !window.location.pathname.includes('/judge') &&
                !window.location.pathname.includes('/waiting') &&
                !window.location.pathname.includes('/game-over')) {
                socket.emit('leave room', { roomId, nickname });
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
           
            socket.off('update room');
            socket.off('new guess');
            socket.off('new round');
        };
    }, [roomId, nickname, password, role, initialPlayers]);

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
            ctx.lineWidth = brushSize * 5; // Eraser size is 5 times the brush size
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize; // Use current brush size
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
            const imageData = canvas.toDataURL('image/png');            

            try {
                // Upload the drawing to the server
                const response = await fetch('http://localhost:3001/upload-drawing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roomId, imageData, keyword: keyword.trim() }),
                });

                if (response.ok) {                                           
                    // Clear the canvas
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                     // Navigate to the judge page
                    navigate(`/judge/${roomId}`, { 
                        state: { 
                            roomId, 
                            password,
                            nickname, 
                            role: 'drawer', 
                            keyword: keyword.trim() 
                        } 
                    });

                    alert('Drawing and keyword submitted successfully');
                } else {
                    throw new Error('Fail to upload (1) ');
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Fail to upload (2): ' + error.message);
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
                <p>Round: {currentRound}/{totalRounds}</p>
                <canvas
                    ref={canvasRef}
                    width={700}
                    height={700}
                    style={{ border: '1px solid black' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                ></canvas>               
                <div className="tools-container">                
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        title="Choose your color"
                        className="canvas-button color-picker"
                    />
                    <div className="brush-size-control">
                        <span className="brush-size-value">Brush Size: {brushSize}px</span>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="brush-size-slider"
                        />                        
                    </div>
                    <button
                        className="canvas-button"
                        onClick={() => setIsErasing(!isErasing)}
                    >
                        {isErasing ? 'Stop Erasing' : 'Erase'}
                    </button>
                    <button className="canvas-button" onClick={handleClear}>Clear</button>
                </div>
                <div className='sidebar'>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="Enter a keyword"
                        />
                </div>   
                <button className="canvas-button" onClick={handleConfirm}>Submit</button>                            
            </div>
            <div className="players-list">
                <h3>Players({players.length})</h3>
                <ul>
                {players.map((player, index) => (
                    <li key={index}>
                        {player.nickname}{player.nickname === nickname ? ' (You)' : ''}                        
                    </li>
                ))}
                </ul>
            </div>
        </div>
    );
};

export default DrawingCanvas;