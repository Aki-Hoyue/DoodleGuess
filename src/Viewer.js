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

    // Use refs to store the judgment result and whether to show the judgment
    const judgmentResultRef = useRef(null);
    const showJudgmentRef = useRef(false);
    const imageUrlRef = useRef('');
    const waitingForImageRef = useRef(true);

    // State to force update the component
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    // States to store the guess and submission status
    const [guess, setGuess] = useState('');
    const [hasGuessed, setHasGuessed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const [otherGuesses, setOtherGuesses] = useState({}); 

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
            socket.emit('join room', { roomId, nickname, role: 'guesser' });
        }

        socket.on('room joined', (roomInfo) => {
            console.log('Joined room:', roomInfo);
            setRoomInfo(roomInfo);
            setPlayers(roomInfo.players);
            setCurrentRound(roomInfo.currentRound);
            setTotalRounds(roomInfo.totalRounds);
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
            setHasGuessed(false);  // Reset the guess status
            forceUpdate();
        });

        socket.on('personal judgment', handlePersonalJudgment);

        // Receive other players' guesses
        socket.on('update guesses', (guesses) => {
            setOtherGuesses(guesses);
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
            socket.off('new drawing');
            socket.off('personal judgment', handlePersonalJudgment);
        };
    }, [roomId, nickname, handlePersonalJudgment]);

    const handleGuess = useCallback(async (e) => {
        e.preventDefault();
        const guessValue = guess.trim();
        // Check if the guess is empty
        if (!guessValue) {
            alert('Please enter your guess');
            return;
        }

        if (guessValue && !isSubmitting) {
            setIsSubmitting(true);
            // Submit the guess to the server
            try {
                const response = await fetch('http://localhost:3001/submit-guess', {
                    method: 'POST',
                    headers: {
                        //'Accept': 'application/json',
                        'Content-Type': 'application/json',                                               
                    },
                    body: JSON.stringify({ roomId, nickname, guess: guessValue }),
                });

                if (response.ok) {
                    setHasGuessed(true);
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
        setHasGuessed(false);
        setGuess('');
        showJudgmentRef.current = false;  
        imageUrlRef.current = '';  
        waitingForImageRef.current = true;   
        navigate(`/waiting/${roomId}`, { state: { roomId, nickname, role: 'guesser' } });
    }, [roomId, nickname, navigate]);


    return (
        <div className="viewer">
            <div className="viewer-header">
                <h2>Doodle Guess</h2>
                <p>Room ID: {roomId}</p>
                <p>Password: {password}</p>
                <p>Round: {currentRound}/{totalRounds}</p>
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
                            <p>Your Guess: {guess}</p>
                            {roomInfo?.keyword && (<p>Keyword: {roomInfo.keyword}</p>)}
                            <p>AI Judgment: {judgmentResultRef.current.aiJudgment ? 'Correct' : 'Incorrect'}</p>
                            <p>AI Reasoning: {judgmentResultRef.current.aiReason}</p>
                            <p>Drawer Judgment: {judgmentResultRef.current.drawerJudgment ? 'Approve AI judgement' : 'Reject AI judgement'}</p>
                            <p>Final Result: {judgmentResultRef.current.finalJudgment ? 'Correct' : 'Incorrect'}</p>
                            <h4>Other Players' Guesses:</h4>
                            <ul>
                                {Object.entries(otherGuesses)
                                    .filter(([playerNickname]) => playerNickname !== nickname)
                                    .map(([playerNickname, playerGuess], index) => (
                                        <li key={index}>{playerNickname}: {playerGuess}</li>
                                    ))
                                }
                            </ul>
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