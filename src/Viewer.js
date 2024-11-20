import React, { useRef, useLayoutEffect, useCallback, useState, useReducer } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Viewer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [roomInfo, setRoomInfo] = useState(null);
    const [players, setPlayers] = useState([]);
    const { roomId, password, nickname } = location.state || {};

    // 使用 useRef 来存储状态
    const judgmentResultRef = useRef(null);
    const showJudgmentRef = useRef(false);
    const imageUrlRef = useRef('');
    const waitingForImageRef = useRef(true);

    // 用于强制重新渲染的 state
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    // 用于跟踪用户猜测的状态
    const [guess, setGuess] = useState('');
    const [hasGuessed, setHasGuessed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePersonalJudgment = useCallback((result) => {
        console.log('Received personal judgment:', result);
        
        judgmentResultRef.current = {
            aiJudgment: result.aiJudge,
            aiReason: result.aiReason,
            drawerJudgment: result.drawerJudge,
            finalJudgment: (result.aiJudge === result.drawerJudge)
        };
        showJudgmentRef.current = true;
        
        console.log('Updated refs:', {
            judgmentResult: judgmentResultRef.current,
            showJudgment: showJudgmentRef.current
        });

        forceUpdate();
    }, []);

    useLayoutEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, password, nickname, role: 'guesser' });
        }

        socket.on('room joined', (roomInfo) => {
            console.log('Joined room:', roomInfo);
            setRoomInfo(roomInfo);
            setPlayers(roomInfo.players);
            if (roomInfo.imageUrl) {
                imageUrlRef.current = roomInfo.imageUrl;
                waitingForImageRef.current = false;
                forceUpdate();
            }
        });

        socket.on('update players', (updatedPlayers) => {
            console.log('Updated players:', updatedPlayers);
            setPlayers(updatedPlayers);
            forceUpdate();
        });

        socket.on('new drawing', ({ keyword, imageUrl }) => {
            imageUrlRef.current = imageUrl;
            waitingForImageRef.current = false;
            setHasGuessed(false);  // 重置猜测状态
            forceUpdate();
        });

        socket.on('personal judgment', handlePersonalJudgment);

        return () => {
            if (!window.location.pathname.includes('/draw') &&
                !window.location.pathname.includes('/view') &&
                !window.location.pathname.includes('/judge')) {
                socket.emit('leave room', { roomId, nickname });
            }
            socket.off('room joined');
            socket.off('new drawing');
            socket.off('personal judgment', handlePersonalJudgment);
        };
    }, [roomId, nickname, handlePersonalJudgment]);

    const handleGuess = useCallback(async (e) => {
        e.preventDefault();
        const guessValue = guess.trim();
        if (guessValue && !isSubmitting) {
            setIsSubmitting(true);
            try {
                const response = await fetch('http://localhost:3001/submit-guess', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roomId, nickname, guess: guessValue }),
                });

                if (response.ok) {
                    setHasGuessed(true);
                    setGuess('');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to submit guess');
                }
            } catch (error) {
                console.error('Error submitting guess:', error);
                alert(error.message);
            } finally {
                setIsSubmitting(false);
            }
        }
    }, [roomId, nickname, guess, isSubmitting]);

    const handleConfirmJudgment = useCallback(() => {
        showJudgmentRef.current = false;  
        imageUrlRef.current = '';  
        waitingForImageRef.current = true;   
        navigate('/waiting', { state: { roomId, password, nickname, role: 'guesser' } });
    }, [roomId, nickname, navigate]);

    return (
        <div className="viewer">
            <div className="viewer-header">
                <h2>Doodle Guess</h2>
                <p>Room ID: {roomId}</p>
                <p>Password: {password}</p>
            </div>
            <div className="viewer-content">
                <div className="viewer-main">
                    {waitingForImageRef.current ? (
                        <p>Waiting for the drawer to upload an image...</p>
                    ) : (
                        <>
                            <img src={imageUrlRef.current} alt="Drawing" style={{ maxWidth: '100%' }} />
                            {!hasGuessed ? (
                                <form onSubmit={handleGuess}>
                                    <input 
                                        type="text" 
                                        value={guess}
                                        onChange={(e) => setGuess(e.target.value)}
                                        placeholder="Enter your guess" 
                                        disabled={isSubmitting}
                                    />
                                    <button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Submitting...' : 'Submit Guess'}
                                    </button>
                                </form>
                            ) : (
                                <p>You have submitted your guess. Waiting for judgement...</p>
                            )}
                        </>
                    )}

                    {showJudgmentRef.current && judgmentResultRef.current && (
                        <div className="judgment-result">
                            <h3>Final Result</h3>
                            <p>AI Judgment: {judgmentResultRef.current.aiJudgment ? 'Correct' : 'Incorrect'}</p>
                            <p>AI Reasoning: {judgmentResultRef.current.aiReason}</p>
                            <p>Drawer Judgment: {judgmentResultRef.current.drawerJudgment ? 'Correct' : 'Incorrect'}</p>
                            <p>Final Result: {judgmentResultRef.current.finalJudgment ? 'Correct' : 'Incorrect'}</p>
                            <button onClick={handleConfirmJudgment}>Confirm and Continue</button>
                        </div>
                    )}
                </div>
                <div className="players-list">
                    <h3>Players({players.length})</h3>
                    <ul>
                        {players.map((player, index) => (
                            <li key={index}>{player.nickname}{player.nickname === nickname ? ' (You)' : ''}{player.role === 'drawer' ? ' (Drawer)' : ''}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Viewer;