import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

const RoomManagement = () => {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [painterNickname, setPainterNickname] = useState(''); // 创建房间玩家的昵称
    const [viewerNickname, setViewerNickname] = useState(''); // 加入房间玩家的昵称
    const [maxPlayers, setMaxPlayers] = useState(3); // 最大玩家数量
    const navigate = useNavigate();

    useEffect(() => {
        // 组件挂载时的逻辑
        console.log('RoomManagement 组件已挂载');

        return () => {
            // 组件卸载时的清理逻辑
            console.log('RoomManagement 组件即将卸载');
            setRoomId('');
            setPassword('');
            setCreatePassword('');
            setPainterNickname('');
            setViewerNickname('');   
        };
    }, []);

    const handleCreateRoom = async () => {
        if (createPassword && painterNickname) {
            try {
                // 调用服务器端的create-room接口
                const response = await fetch('http://localhost:3001/create-room', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ maxPlayers }),
                });

                if (response.ok) {
                    const { roomId } = await response.json();
                    console.log(`Creating room ${roomId} with nickname ${painterNickname} and max players ${maxPlayers}`);
                    navigate(`/draw/${roomId}`, { 
                        state: { 
                            roomId, 
                            password: createPassword,  
                            nickname: painterNickname, 
                            maxPlayers
                        } 
                    });
                } else {
                    throw new Error('Failed to create room');
                }
            } catch (error) {
                console.error('Error creating room:', error);
                alert('Failed to create room. Please try again.');
            }
        } else {
            alert('Password and Nickname are required');
        }
    };

    const handleJoinRoom = () => {
        if (roomId && password && viewerNickname) {
            console.log(`Joining room ${roomId} with nickname ${viewerNickname}`);
            navigate(`/view/${roomId}`, { state: { roomId, nickname: viewerNickname } });
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