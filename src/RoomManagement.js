import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './style.css';

const socket = io('http://localhost:3001');

const RoomManagement = () => {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [painterNickname, setPainterNickname] = useState(''); // Nickname of the creator
    const [viewerNickname, setViewerNickname] = useState(''); // Nickname of the new joiner
    const [maxPlayers, setMaxPlayers] = useState(3); // Maximum number of players
    const [rounds, setRounds] = useState(1); // Number of rounds
    const navigate = useNavigate();

    useEffect(() => {
        console.log('RoomManagement 组件已挂载');

        socket.on('room created', ({ roomId, players, drawer }) => {
            console.log(`Room created with ID: ${roomId}, players:`, players);
            navigate(`/draw/${roomId}`, { 
                state: { 
                    roomId, 
                    password: createPassword,  
                    nickname: painterNickname, 
                    maxPlayers,
                    role: 'drawer',
                    players: players
                } 
            });
        });

        return () => {
            socket.off('room created');
        };
    }, [createPassword, painterNickname, maxPlayers, navigate]);

    const handleCreateRoom = async () => {
        if (createPassword && painterNickname) {
            console.log(`Creating room with nickname ${painterNickname}`);
            socket.emit('create room', { 
                password: createPassword,
                maxPlayers, 
                rounds,
                creatorNickname: painterNickname 
            });
        } else {
            alert('Password and Nickname are required');
        }
    };

    const handleJoinRoom = () => {
        if (roomId && password && viewerNickname) {
            socket.emit('check password and nickname', { roomId, password, nickname: viewerNickname });
            
            socket.on('incorrect password', () => {
                alert('Incorrect password.');
            });

            socket.on('duplicate nickname', () => {
                alert('Nickname already taken.');
            });    

            socket.on('password and nickname valid', () => {

                console.log(`Joining room ${roomId} with nickname ${viewerNickname}`);
                socket.emit('join room', { roomId, nickname: viewerNickname, role: 'guesser' });

                socket.on('room full', () => {
                    alert('The room is full.');
                });

                socket.on('room joined', (roomInfo) => {
                    console.log('Joined room:', roomInfo);
                    navigate(`/view/${roomId}`, { state: { roomId, password, nickname: viewerNickname } });
                });
            });
        } else {
            alert('Please enter both Room ID, Password and Nickname');
        }          
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
                    {[3, 4, 5, 6, 7, 8].map(num => (
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
                {[1, 2, 3, 4, 5].map(num => (
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