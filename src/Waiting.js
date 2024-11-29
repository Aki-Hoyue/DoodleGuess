import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Waiting = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, nickname, role } = location.state || {};
    const [readyPlayers, setReadyPlayers] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);

    useEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, nickname, role });
        }

        socket.on('room joined', (roomInfo) => {
            console.log('Room joined response:', roomInfo);
            console.log('Sending player ready signal...');
            socket.emit('player ready', { roomId, nickname });  
            setCurrentRound(roomInfo.currentRound);
            setTotalRounds(roomInfo.totalRounds);         
        });

        socket.on('update ready players', (players) => {
            console.log('Received updated ready players:', players);
            setReadyPlayers(players);
        });

        socket.on('game over', (playerScores) => {
            console.log('Game over:', playerScores);
            console.log('Nickname:', nickname);
            navigate('/game-over', { state: { playerScores, nickname} });
        });

        socket.on('new round', ({ currentDrawer, password}) => {
            if (nickname === currentDrawer) {
                navigate('/draw/${roomId}', { state: { roomId, password, nickname, role: 'drawer' } });
            } else {
                navigate('/view/${roomId}', { state: { roomId, password, nickname, role: 'guesser' } });
            }
        });

        const handleBeforeUnload = () => {
            socket.emit('leave room', { roomId, nickname });
        };
    
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (!window.location.pathname.includes('/draw') &&
                !window.location.pathname.includes('/view') &&
                !window.location.pathname.includes('/judge') &&
                !window.location.pathname.includes('/waiting') &&
                !window.location.pathname.includes('/game-over')) {
                socket.emit('leave room', { roomId, nickname });
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);

            socket.off('update ready players');
            socket.off('new round');
        };
    }, [roomId, nickname, navigate]);

    return (
        <div className="waiting-room">
            <h2>Waiting for other players to be prepared...</h2>
            <p>Room ID: {roomId}</p>
            <p>Current round: {currentRound}/{totalRounds}</p>
            <p>Already prepared players: {readyPlayers.map(player => player === nickname ? `${player} (You)` : player).join(', ')}</p>
        </div>
    );
};

export default Waiting;