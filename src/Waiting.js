import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Waiting = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, nickname, role } = location.state || {};
    const [readyPlayers, setReadyPlayers] = useState([]);

    useEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, nickname, role });
        }

        socket.on('room joined', (response) => {
            console.log('Room joined response:', response);
            console.log('Sending player ready signal...');
            socket.emit('player ready', { roomId, nickname });           
        });

        socket.on('update ready players', (players) => {
            console.log('Received updated ready players:', players);
            setReadyPlayers(players);
        });

        socket.on('new round', ({ currentDrawer, password}) => {
            if (nickname === currentDrawer) {
                navigate('/draw/${roomId}', { state: { roomId, password, nickname, role: 'drawer' } });
            } else {
                navigate('/view/${roomId}', { state: { roomId, password, nickname, role: 'guesser' } });
            }
        });

        return () => {
            socket.off('update ready players');
            socket.off('new round');
        };
    }, [roomId, nickname, navigate]);

    return (
        <div className="waiting-room">
            <h2>Waiting for other players to be prepared...</h2>
            <p>Room ID: {roomId}</p>
            <p>Already prepared players: {readyPlayers.map(player => player === nickname ? `${player} (You)` : player).join(', ')}</p>
        </div>
    );
};

export default Waiting;