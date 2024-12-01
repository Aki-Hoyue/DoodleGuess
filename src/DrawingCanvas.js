import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectWebSocket, sendMessage, addMessageHandler, removeMessageHandler, api } from './utils/websocket';
import './style.css';

const DrawingCanvas = () => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [isErasing, setIsErasing] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [players, setPlayers] = useState([]);
    const [brushSize, setBrushSize] = useState(2);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, password, nickname, clientId, role } = location.state || {};

    useEffect(() => {
        if (!roomId || !nickname || !clientId) {
            navigate('/');
            return;
        }

        document.title = 'Drawing - DoodleGuess';

        // Initialize the canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        connectWebSocket(clientId);

        addMessageHandler('player_joined', (data) => {
            setPlayers(data.players);
        });

        addMessageHandler('player_left', (data) => {
            setPlayers(data.players);
        });

        addMessageHandler('game_start', (data) => {
            setCurrentRound(data.currentRound);
        });

        addMessageHandler('round_start', (data) => {
            setCurrentRound(data.currentRound);
        });

        // Get initial game state
        const fetchGameState = async () => {
            try {
                const state = await api.getGameState(roomId);
                setPlayers(state.players);
                setCurrentRound(state.current_round);
                setTotalRounds(state.total_rounds);
            } catch (error) {
                console.error('Failed to fetch game state:', error);
            }
        };
        fetchGameState();

        const handleBeforeUnload = () => {
            sendMessage({
                event: 'leave_room',
                roomId,
                clientId
            });
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            removeMessageHandler('player_joined');
            removeMessageHandler('player_left');
            removeMessageHandler('game_start');
            removeMessageHandler('round_start');
            
            // Leave the room
            if (!window.location.pathname.includes('/draw') &&
                !window.location.pathname.includes('/view') &&
                !window.location.pathname.includes('/judge') &&
                !window.location.pathname.includes('/waiting') &&
                !window.location.pathname.includes('/game-over')) {
                handleBeforeUnload();
            }
        };
    }, [roomId, nickname, clientId, navigate]);

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
            ctx.lineWidth = brushSize * 5;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
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
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleConfirm = async () => {
        if (!keyword.trim()) {
            alert('Please enter a keyword');
            return;
        }

        try {
            const canvas = canvasRef.current;
            // Convert the canvas to a Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

            // Upload the drawing
            const uploadResult = await api.uploadDrawing(roomId, clientId, blob);
            if (uploadResult.status !== 'success') {
                throw new Error('Failed to upload drawing');
            }

            // Send the drawing and keyword to WebSocket
            sendMessage({
                event: 'submit_drawing',
                roomId,
                clientId,
                drawingUrl: uploadResult.url,
                keyword: keyword.trim()
            });

            // Navigate to the judge page
            navigate(`/judge/${roomId}`, {
                state: {
                    roomId,
                    password,
                    nickname,
                    clientId,
                    role: 'drawer',
                    keyword: keyword.trim()
                }
            });

        } catch (error) {
            console.error('Error uploading drawing:', error);
            alert('Failed to upload drawing: ' + error.message);
        }
    };

    return (
        <div className="game-container">
            <div className="canvas-container">
                <h1>Draw as you like</h1>
                {roomId && <p>Room ID: {roomId}</p>}
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
                        <li key={index} className={`player-item ${player.isDrawing ? 'drawing' : ''}`}>
                            <span>
                                {player.nickname}
                                {player.nickname === nickname ? ' (You)' : ''}
                                {player.isDrawing ? ' (Drawing)' : ''}
                            </span>
                            <span className="player-score">Score: {player.score || 0}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default DrawingCanvas;