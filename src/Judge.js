import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Judge = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, password, nickname, role, keyword } = location.state || {};

    const [roomInfo, setRoomInfo] = useState(null);
    const [aiJudgments, setAiJudgments] = useState([]);
    const [finalJudgments, setFinalJudgments] = useState({});
    const [players, setPlayers] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);

    useEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} as judge with keyword: ${keyword}`);
            socket.emit('join room', { roomId, nickname, role: 'drawer' });
        }

        socket.on('room joined', (roomInfo) => {
            console.log('Room joined:', roomInfo);
            setRoomInfo(roomInfo);
            setPlayers(roomInfo.players);
            setCurrentRound(roomInfo.currentRound);
            setTotalRounds(roomInfo.totalRounds);
        });

        socket.on('ai judgments', (judgments) => {
            console.log('Received AI judgments:', judgments);
            setAiJudgments(judgments);
        });

        socket.on('update players', (updatedPlayers) => {
            console.log('Updated players:', updatedPlayers);
            setPlayers(updatedPlayers);
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
            
            socket.off('room joined');
            socket.off('ai judgments');
            socket.off('update players');
        };
    }, [roomId, nickname, keyword]);

    const handleJudge = (playerNickname, isCorrect) => {
        setFinalJudgments(prev => ({
            ...prev,
            [playerNickname]: isCorrect
        }));
    };

    const handleSubmitJudgments = () => {
         // Check if AI judgments are ready
        if (aiJudgments.length === 0) {
            alert('Please wait for AI judgements');
            return;
        }

        // Check if all players have been judged
        if (Object.keys(finalJudgments).length !== aiJudgments.length) {
            alert('Please judge all players before submitting.');
            return;
        }

        console.log('Submitting judgments:', finalJudgments);
        // Send final judgments to players
        socket.emit('judge result', { roomId, judgments: finalJudgments });
        navigate(`/waiting/${roomId}`, { state: { roomId, nickname, role: 'drawer' } });
    };

    if (!roomInfo) {
        return <div>Loading room information...</div>;
    }

    return (
        <div className="judge-container">
            <h2>Judge Page</h2>
            <p>Room ID: {roomId}</p>
            <p>Password: {password}</p>
            <p>Rounds: {currentRound}/{totalRounds}</p>
            {roomInfo?.imageUrl && (
                <img 
                    src={roomInfo.imageUrl} 
                    alt="Drawing" 
                    style={{ maxWidth: '100%' }} 
                />
            )}
            <p>Keyword: {keyword}</p>
            <div className="players-list">
                <h3>Players ({players.length})</h3>
                <ul>
                    {players.map((player, index) => (
                        <li key={index}>{player.nickname} ({player.role})</li>
                    ))}
                </ul>
            </div>
            <h3>AI Judgments:</h3>
            <ul className="judgments-list">
                {aiJudgments.map((judgment, index) => (
                    <li key={index} className="judgment-item">
                        <div><strong>Player:</strong> {judgment.nickname}</div>
                        <div><strong>Guess:</strong> {judgment.guess}</div>
                        <div><strong>AI Judgment:</strong> {judgment.Judge ? 'Correct' : 'Incorrect'}</div>
                        <div><strong>Reason:</strong> {judgment.Reason}</div>
                        <div className="judge-actions">
                            <span className="button-label">Approve</span>
                            <label className={`judge-button approve ${finalJudgments[judgment.nickname] === true ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name={`judgment-${index}`}
                                    value="approve"
                                    checked={finalJudgments[judgment.nickname] === true}
                                    onChange={() => handleJudge(judgment.nickname, true)}
                                />
                                ✓
                            </label>
                            <span className="button-label">Reject</span>
                            <label className={`judge-button reject ${finalJudgments[judgment.nickname] === false ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name={`judgment-${index}`}
                                    value="reject"
                                    checked={finalJudgments[judgment.nickname] === false}
                                    onChange={() => handleJudge(judgment.nickname, false)}
                                />
                                ✕
                            </label>
                        </div>
                    </li>
                ))}
            </ul>
            <button onClick={handleSubmitJudgments} className="submit-button">Submit Judgments</button>
        </div>
    );
};


export default Judge;