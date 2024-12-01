import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectWebSocket, sendMessage } from './utils/websocket';

const GameOver = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { players, nickname, clientId } = location.state || {};

    useEffect(() => {
        if (!players || !nickname || !clientId) {
            navigate('/');
            return;
        }
        document.title = 'Game Over';
    }, [players, nickname, clientId, navigate]);

    // Calculate and sort player scores
    const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
    const currentPlayer = players?.find(p => p.nickname === nickname);

    return (
        <div className="game-over">
            <h2>Game Over</h2>
            <div className="scores">
                <h3>Your Score:</h3>
                {currentPlayer && (
                    <div className="player-score">
                        <h4>{currentPlayer.nickname}</h4>
                        <p>Score: {currentPlayer.score}</p>
                        <p>Correct Guesses: {currentPlayer.correct_guesses || 0}</p>
                        <p>Drawings Guessed Correctly: {currentPlayer.drawings_guessed_correctly || 0}</p>
                    </div>
                )}
                <h3>Final Rankings:</h3>
                <div className="rankings">
                    {sortedPlayers.map((player, index) => (
                        <div key={player.client_id} className={`player-rank ${player.nickname === nickname ? 'current-player' : ''}`}>
                            <h4>#{index + 1} - {player.nickname} {player.nickname === nickname ? '(You)' : ''}</h4>
                            <p>Score: {player.score}</p>
                            <p>Correct Guesses: {player.correct_guesses || 0}</p>
                            <p>Drawings Guessed Correctly: {player.drawings_guessed_correctly || 0}</p>
                        </div>
                    ))}
                </div>
            </div>
            <button className="return-button" onClick={() => navigate('/')}>
                Return to Homepage
            </button>
        </div>
    );
};

export default GameOver;