import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

const RoomManagement = () => {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [painterNickname, setPainterNickname] = useState(''); // 新增昵称状态
    const [viewerNickname, setViewerNickname] = useState(''); // 新增昵称状态
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

    const handleCreateRoom = () => {
        if (createPassword && painterNickname) {
            const generatedRoomId = Math.floor(1000 + Math.random() * 9000).toString();
            setRoomId(generatedRoomId);
            setPassword(createPassword);
            console.log(`Creating room ${generatedRoomId} with nickname ${painterNickname}`);
            navigate(`/draw/${generatedRoomId}`, { state: { roomId: generatedRoomId, password: createPassword,  nickname: painterNickname} });
        } else {
            alert('Password and Nickname is required');
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