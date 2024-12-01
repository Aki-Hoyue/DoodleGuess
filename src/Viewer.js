import React, { useRef, useLayoutEffect, useCallback, useState, useReducer, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectWebSocket, sendMessage, addMessageHandler, removeMessageHandler, api } from './utils/websocket';

const Viewer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const { roomId, password, nickname, clientId } = location.state || {};

    // Use refs to store judgment results and display status
    const judgmentResultRef = useRef(null);
    const showJudgmentRef = useRef(false);
    const imageUrlRef = useRef('');
    const waitingForImageRef = useRef(true);

    // Forcing the component to update
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const [guess, setGuess] = useState('');
    const [hasGuessed, setHasGuessed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const [otherGuesses, setOtherGuesses] = useState({});
    const [isFinalRound, setIsFinalRound] = useState(false);
    const [currentDrawing, setCurrentDrawing] = useState(null);
    const [roundResults, setRoundResults] = useState(null);
    const [showScoreBoard, setShowScoreBoard] = useState(false);
    const [keyword, setKeyword] = useState('');

    const handlePersonalJudgment = useCallback((data) => {
        judgmentResultRef.current = {
            aiJudgment: data.ai_judgment,
            aiReason: data.ai_reason,
            drawerJudgment: data.drawer_judgment,
            finalJudgment: data.final_judgment
        };
        showJudgmentRef.current = true;
        forceUpdate();
    }, []);

    useLayoutEffect(() => {
        if (!roomId || !nickname || !clientId) {
            navigate('/');
            return;
        }

        document.title = 'Viewer - DoodleGuess';

        connectWebSocket(clientId);

        const fetchGameState = async () => {
            try {
                const state = await api.getGameState(roomId);
                setPlayers(state.players);
                setCurrentRound(state.current_round);
                setTotalRounds(state.total_rounds);
                
                // Get current drawing 
                if (state.status != 'round_start') {
                    const drawingData = await api.getDrawing(roomId);
                    if (drawingData.status === 'success') {
                        setCurrentDrawing(drawingData.url);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch game state:', error);
            }
        };
        fetchGameState();

        const handlers = {
            'player_joined': (data) => {
                setPlayers(data.players);
            },
            'player_left': (data) => {
                setPlayers(data.players);
                if (data.drawer_left) {
                    alert('The drawer has left the room. Redirecting to the home page in 3s...');
                    setTimeout(() => navigate('/'), 3000);
                }
            },
            'new_drawing': (data) => {
                setCurrentDrawing(data.drawingUrl);
                setHasGuessed(false);
                setGuess('');
                setShowScoreBoard(false);
            },
            'judgment_result': handlePersonalJudgment,
            'all_guessed': (data) => {
                setOtherGuesses(data.guesses);
            },
            'round_start': (data) => {
                console.log('Received round_start event:', data);
                setCurrentRound(data.currentRound);
                setTotalRounds(data.totalRounds);
                if (data.currentRound === data.totalRounds) {
                    setIsFinalRound(true);
                }
                // Clear current drawing and score display
                setCurrentDrawing(null);
                setShowScoreBoard(false);
                setHasGuessed(false);
                setGuess('');
                // If it's a new drawer, navigate to the drawing page
                const isDrawing = data.players.find(p => p.client_id === clientId)?.isDrawing;
                if (isDrawing) {
                    navigate(`/draw/${roomId}`, { 
                        state: { 
                            roomId,
                            clientId,
                            nickname,
                            currentRound: data.currentRound,
                            totalRounds: data.totalRounds,
                            players: data.players
                        }
                    });
                }
            },
            'round_end': (data) => {
                setRoundResults(data);
                setShowScoreBoard(true);
                if (data.players) {
                    setPlayers(data.players);
                }
                if (data.current_round) {
                    setCurrentRound(data.current_round);
                }
                if (data.total_rounds) {
                    setTotalRounds(data.total_rounds);
                }
            },
            'player_ready_update': (data) => {
                setPlayers(data.players);
            },
            'game_over': (data) => {
                navigate('/game-over', {
                    state: {
                        players: data.players,
                        finalScores: data.final_scores,
                        nickname,
                        clientId
                    }
                });
            }
        };

        Object.entries(handlers).forEach(([event, handler]) => {
            addMessageHandler(event, handler);
        });

        return () => {
            Object.keys(handlers).forEach(event => {
                removeMessageHandler(event);
            });
        };
    }, [roomId, nickname, clientId, totalRounds, handlePersonalJudgment, navigate]);

    const handleGuess = useCallback(async (e) => {
        e.preventDefault();
        const guessValue = guess.trim();
        if (!guessValue) {
            alert('Please enter your guess');
            return;
        }

        if (!isSubmitting) {
            setIsSubmitting(true);
            try {
                const result = await api.submitGuess(roomId, clientId, guessValue);
                if (result.status === 'success') {
                    setHasGuessed(true);
                }
            } catch (error) {
                console.error('Error submitting guess:', error);
                alert(error.message);
            } finally {
                setIsSubmitting(false);
            }
        }
    }, [roomId, clientId, guess, isSubmitting]);

    const handleConfirmJudgment = useCallback(() => {
        setHasGuessed(false);
        setGuess('');
        showJudgmentRef.current = false;
        imageUrlRef.current = '';
        waitingForImageRef.current = true;
        navigate(`/waiting/${roomId}`, {
            state: {
                roomId,
                nickname,
                clientId,
                role: 'guesser'
            }
        });
    }, [roomId, nickname, clientId, navigate]);

    const isNextDrawer = useCallback(() => {
        const currentDrawerIndex = players.findIndex(p => p.isDrawing);
        const nextDrawerIndex = (currentDrawerIndex + 1) % players.length;
        return players[nextDrawerIndex]?.nickname === nickname;
    }, [players, nickname]);

    return (
        <div className="viewer">
            <div className="viewer-header">
                <h2>Doodle Guess</h2>
                <p>Room ID: {roomId}</p>
                <p>Round: {currentRound}/{totalRounds}</p>
            </div>
            <div className="viewer-header">
                <div className="viewer-main">
                    {!currentDrawing && !showScoreBoard ? (
                        <p>Waiting for the drawer to upload an image...</p>
                    ) : showScoreBoard && roundResults ? (
                        <div className="round-end">
                            <h3>Round Result</h3>
                            <div className="round-info">
                                <p>Round {currentRound}/{totalRounds}</p>
                                <p>Correct answer: {roundResults.keyword}</p>
                            </div>
                            <div className="judgments-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Your Guess</th>
                                            <th>Answer</th>
                                            <th>Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roundResults.judgments.map((judgment, index) => {
                                            const player = players.find(p => p.client_id === judgment.player_id);
                                            return (
                                                <tr key={index} className={`judgment-row ${judgment.is_correct ? 'correct' : 'incorrect'}`}>
                                                    <td className="player-name">{player?.nickname}</td>
                                                    <td className="guess">{judgment.guess}</td>
                                                    <td className="answer">{roundResults.keyword}</td>
                                                    <td className={`result_${judgment.is_correct ? 'correct' : 'incorrect'}`}>
                                                        {judgment.is_correct ? 'Correct' : 'Incorrect'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="scores">
                                <h4>Current Scores</h4>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.map((player, index) => (
                                            <tr key={index} className={player.nickname === nickname ? 'current-player' : ''}>
                                                <td>
                                                    {player.nickname}
                                                    {player.nickname === nickname ? ' (You)' : ''}
                                                    {player.isDrawing ? ' (Next Drawer)' : ''}
                                                </td>
                                                <td>{player.score || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {players.find(p => p.nickname === nickname)?.isDrawing && 
                            <button 
                                className="next-round-button"
                                onClick={() => sendMessage({
                                    event: 'player_ready',
                                    roomId,
                                    clientId
                                })}
                            >
                                Ready for next round
                            </button>
                            }
                            {(players.find(p => p.nickname === nickname)?.isDrawing) === false && 
                            <p>Waiting for the next player to ready...</p>}
                        </div>
                    ) : (
                        <>
                            <img src={currentDrawing} alt="Drawing" style={{ maxWidth: '100%' }} />
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
        </div>
    );
};

export default Viewer;