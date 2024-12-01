import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectWebSocket, sendMessage, addMessageHandler, removeMessageHandler } from './utils/websocket';
import { v4 as uuidv4 } from 'uuid';
import './style.css';

const RoomManagement = () => {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [painterNickname, setPainterNickname] = useState('');
    const [viewerNickname, setViewerNickname] = useState('');
    const [maxPlayers, setMaxPlayers] = useState(3);
    const [rounds, setRounds] = useState(3);
    const [clientId] = useState(() => uuidv4());
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'DoodleGuess';

        // Connect to WebSocket
        connectWebSocket(clientId);

        addMessageHandler('room_created', (data) => {
            console.log('Room created with ID:', data.roomId);
            navigate(`/draw/${data.roomId}`, {
                state: {
                    roomId: data.roomId,
                    password: createPassword,
                    nickname: painterNickname,
                    clientId: clientId,
                    role: 'drawer'
                }
            });
        });

        addMessageHandler('error', (data) => {
            alert(data.message);
        });

        addMessageHandler('player_joined', (data) => {
            navigate(`/view/${roomId}`, {
                state: {
                    roomId,
                    password,
                    nickname: viewerNickname,
                    clientId: clientId,
                    role: 'guesser'
                }
            });
        });

        return () => {
            removeMessageHandler('room_created');
            removeMessageHandler('error');
            removeMessageHandler('player_joined');
        };
    }, [clientId, createPassword, painterNickname, roomId, password, viewerNickname, navigate]);

    const handleCreateRoom = () => {
        if (!createPassword || !painterNickname) {
            alert('Password and Nickname are required');
            return;
        }

        console.log('Creating room with data:', {
            event: 'create_room',
            password: createPassword,
            maxPlayers,
            rounds,
            creatorNickname: painterNickname,
            clientId
        });

        sendMessage({
            event: 'create_room',
            password: createPassword,
            maxPlayers,
            rounds,
            creatorNickname: painterNickname,
            clientId
        });
    };

    const handleJoinRoom = () => {
        if (!roomId || !password || !viewerNickname) {
            alert('Please enter both Room ID, Password and Nickname');
            return;
        }

        console.log('Joining room with data:', {
            event: 'join_room',
            roomId,
            password,
            nickname: viewerNickname,
            clientId
        });

        sendMessage({
            event: 'join_room',
            roomId,
            password,
            nickname: viewerNickname,
            clientId
        });
    };

    return (
        <div className="main-container">
            <h2>Doodle Guess</h2>
            <h3>Create Room</h3>
            <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Enter Room Password"
            />
            <input
                type="text"
                value={painterNickname}
                onChange={(e) => setPainterNickname(e.target.value)}
                placeholder="Enter your nickname"
            />
            <label className="max-players-label">Maximum Players:
                <select
                    id="maxPlayers"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                >
                    {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num}</option>
                    ))}
                </select>
            </label>
            <label className="rounds-label">
                Rounds:
                <select
                    id="rounds"
                    value={rounds}
                    onChange={(e) => setRounds(parseInt(e.target.value))}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num}</option>
                    ))}
                </select>
            </label>
            <button onClick={handleCreateRoom}>Create Room</button>
            <h3>Join Room</h3>
            <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Room Password"
            />
            <input
                type="text"
                value={viewerNickname}
                onChange={(e) => setViewerNickname(e.target.value)}
                placeholder="Enter your nickname"
            />
            <button onClick={handleJoinRoom}>Join Room</button>
        </div>
    );
};

export default RoomManagement;