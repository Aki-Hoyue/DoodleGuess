import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');


const GameOver = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { playerScores, nickname } = location.state || {};

    return (
        <div className="game-over">
            <h2>Game Over</h2>
            <div className="scores">
                <h3>Your Score:</h3>
                {playerScores[nickname] && (
                    <div>
                        <h4>{nickname}</h4>
                        <p>Correct Guesses: {playerScores[nickname].correctGuesses}</p>
                        <p>Drawings Guessed Correctly: {playerScores[nickname].drawingsGuessedCorrectly}</p>
                    </div>
                )}
                <h3>Other Players' Scores:</h3>
                {Object.entries(playerScores)
                    .filter(([player]) => player !== nickname) // Filter out the current player
                    .map(([player, score]) => (
                        <div key={player}>
                            <h4>{player}</h4>
                            <p>Correct Guesses: {score.correctGuesses}</p>
                            <p>Drawings Guessed Correctly: {score.drawingsGuessedCorrectly}</p>
                        </div>
                    ))
                }
            </div>
            <button onClick={() => navigate('/')}>Return to Homepage</button>
        </div>
    );
};

export default GameOver;