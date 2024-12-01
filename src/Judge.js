import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectWebSocket, sendMessage, addMessageHandler, removeMessageHandler, api } from './utils/websocket';

const Judge = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, clientId, nickname, players: initialPlayers } = location.state || {};

    const [imageUrl, setImageUrl] = useState('');
    const [aiJudgments, setAiJudgments] = useState(null);
    const [aiError, setAiError] = useState(null);
    const [manualJudgments, setManualJudgments] = useState({});
    const [showManualJudge, setShowManualJudge] = useState(false);
    const [roundEnded, setRoundEnded] = useState(false);
    const [roundResults, setRoundResults] = useState(null);
    const [keyword, setKeyword] = useState('');
    const [players, setPlayers] = useState(initialPlayers || []);
    const [guesses, setGuesses] = useState({});
    const [isWaitingAI, setIsWaitingAI] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const [showScoreBoard, setShowScoreBoard] = useState(false);

    useEffect(() => {
        if (!roomId || !clientId || !nickname) {
            navigate('/');
            return;
        }

        document.title = 'Judgment - DoodleGuess';

        // 连接WebSocket
        connectWebSocket(clientId);

        // 获取初始游戏状态
        const fetchGameState = async () => {
            try {
                const state = await api.getGameState(roomId);
                setPlayers(state.players);
                setCurrentRound(state.current_round);
                setTotalRounds(state.total_rounds);
                setKeyword(state.keyword);

                // 获取当前绘画
                const drawingData = await api.getDrawing(roomId);
                if (drawingData.status === 'success') {
                    setImageUrl(`/images/${drawingData.filename}`);
                }
            } catch (error) {
                console.error('Failed to fetch game state:', error);
            }
        };
        fetchGameState();

        // 添加事件处理器
        const handlers = {
            'all_guessed': (data) => {
                setIsWaitingAI(true);
                setGuesses(data.guesses);
                // 触发AI判断
                sendMessage({
                    event: 'request_ai_judgment',
                    roomId,
                    clientId,
                    keyword,
                    guesses: data.guesses
                });
            },
            'ai_judgments': (data) => {
                setIsWaitingAI(false);
                setAiJudgments(data.judgments);
                setKeyword(data.keyword);
                setShowManualJudge(true);
                setAiError(null);
                
                // 预填充AI的判断结果
                const initialJudgments = {};
                data.judgments.forEach(judgment => {
                    initialJudgments[judgment.player_id] = judgment.is_correct;
                });
                setManualJudgments(initialJudgments);
            },
            'ai_judgment_failed': (data) => {
                setIsWaitingAI(false);
                setAiError(data.error);
                setShowManualJudge(true);
                setAiJudgments(null);
                setManualJudgments({});
            },
            'round_end': (data) => {
                setRoundEnded(true);
                setShowManualJudge(false);
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
            'round_start': (data) => {
                console.log('Received round_start event:', data);  // 添加日志
                setCurrentRound(data.currentRound);
                setTotalRounds(data.totalRounds);
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
                } else {
                    navigate(`/view/${roomId}`, {
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
            'game_over': (data) => {
                navigate('/game-over', {
                    state: {
                        players: data.players,
                        finalScores: data.final_scores,
                        nickname,
                        clientId
                    }
                });
            },
            'player_ready_update': (data) => {
                setPlayers(data.players);
            }
        };

        // 注册所有事件处理器
        Object.entries(handlers).forEach(([event, handler]) => {
            addMessageHandler(event, handler);
        });

        // 清理函数
        return () => {
            Object.keys(handlers).forEach(event => {
                removeMessageHandler(event);
            });
        };
    }, [navigate, roomId, clientId, nickname, keyword]);

    // 处理手动判断
    const handleManualJudgment = (playerId, isCorrect) => {
        setManualJudgments(prev => ({
            ...prev,
            [playerId]: isCorrect
        }));
    };

    // 提交判断结果
    const submitJudgments = () => {
        const judgmentsList = Object.entries(manualJudgments).map(([playerId, isCorrect]) => ({
            player_id: playerId,
            is_correct: isCorrect
        }));

        sendMessage({
            event: 'submit_judgments',
            roomId,
            clientId,
            judgments: judgmentsList
        });
        setShowManualJudge(false);
    };

    return (
        <div className="judge-container">
            <h2>Judgment</h2>
            <div className="game-info">
                <div className="room-info">
                    <p>Room ID: {roomId}</p>
                    <p>Round: {currentRound}/{totalRounds}</p>
                    <p>Your answer: {keyword}</p>
                    {}
                </div>
                
            </div>

            {imageUrl && (
                <div className="drawing-section">
                    <img
                        src={imageUrl}
                        alt="Drawing"
                    />
                </div>
            )}

            {!showManualJudge && !roundEnded && (
                <div className="waiting-message">
                    <p>Waiting for all players to guess...</p>
                </div>
            )}

            {isWaitingAI && (
                <div className="waiting-ai">
                    <div className="spinner"></div>
                    <p>Waiting for AI judgment...</p>
                </div>
            )}

            {showManualJudge && !roundEnded && (
                <div className="manual-judge">
                    <h3>Judgment</h3>
                    {aiError && <div className="error-message"><b>Please judge the answer manually.</b> <br /> AI error: {aiError}</div>}
                    <div className="judgments-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Guess</th>
                                    <th>AI Judgment</th>
                                    <th>Judgment Reason</th>
                                    <th>Manual Judgment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {guesses && Object.entries(guesses).map(([playerId, guess]) => {
                                    if (playerId === clientId) return null;
                                    const player = players.find(p => p.client_id === playerId);
                                    if (!player) return null;

                                    const aiJudgment = aiJudgments?.find(j => j.player_id === playerId);

                                    return (
                                        <tr key={playerId} className="judgment-row">
                                            <td className="player-name">{player.nickname}</td>
                                            <td className="guess">{guess}</td>
                                            <td className={`ai-judgment ${aiJudgment?.is_correct ? 'correct' : 'incorrect'}`}>
                                                {aiJudgment ? (aiJudgment.is_correct ? 'Correct' : 'Incorrect') : '-'}
                                            </td>
                                            <td className="reason">
                                                {aiJudgment?.reason || '-'}
                                            </td>
                                            <td className="judgment-buttons">
                                                <button
                                                    className={`correct-button ${manualJudgments[playerId] === true ? 'selected' : ''}`}
                                                    onClick={() => handleManualJudgment(playerId, true)}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className={`incorrect-button ${manualJudgments[playerId] === false ? 'selected' : ''}`}
                                                    onClick={() => handleManualJudgment(playerId, false)}
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <button
                        className="submit-judgments"
                        onClick={submitJudgments}
                        disabled={Object.keys(manualJudgments).length === 0}
                    >
                        Submit Judgment
                    </button>
                </div>
            )}

            {roundEnded && roundResults && (
                <div className="round-end">
                    {/* <h3>Round Result</h3>
                    <div className="round-info">
                        <p>Round {roundResults.current_round}/{roundResults.total_rounds}</p>
                        <p>Correct answer: {keyword}</p>
                    </div>
                    <div className="judgments-results">
                        {roundResults.judgments.map((judgment, index) => {
                            const player = players.find(p => p.client_id === judgment.player_id);
                            return (
                                <div key={index} className={`judgment-result ${judgment.is_correct ? 'correct' : 'incorrect'}`}>
                                    <span className="player-name">{player?.nickname}</span>
                                    <span className="guess">{judgment.guess}</span>
                                    <span className="result">{judgment.is_correct ? 'Correct' : 'Incorrect'}</span>
                                    {judgment.reason && (
                                        <span className="reason">{judgment.reason}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="scores">
                        <h4>Current Scores</h4>
                        {roundResults.players.map((player, index) => (
                            <div key={index} className="player-score">
                                <span>{player.nickname}</span>
                                <span>Score: {player.score || 0}</span>
                            </div>
                        ))} */}
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
                        <p>Waiting for the next player to ready...</p>
                </div>
            )}
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
    );
};


export default Judge;