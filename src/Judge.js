// src/Judge.js
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Judge = () => {
    const location = useLocation();
    const { roomId, keyword } = location.state || {};
    const [guessQueue, setGuessQueue] = useState([]);
    const [currentGuess, setCurrentGuess] = useState(null);

    useEffect(() => {
        // 监听猜画者返回的答案
        socket.on('new guess', ({ nickname, guess,aiJudgment, guessCount}) => {
            setGuessQueue(prevQueue => [...prevQueue, { nickname, guess, aiJudgment, guessCount }]);
        });        

        return () => {
            socket.off('new guess');
        };
    }, []);

    useEffect(() => {
        // 如果当前没有正在判断的猜测，且队列中有待判断的猜测，则取出一个进行判断
        if (!currentGuess && guessQueue.length > 0) {
            setCurrentGuess(guessQueue[0]);
            setGuessQueue(prevQueue => prevQueue.slice(1));
        }
    }, [currentGuess, guessQueue]);

    const handleJudge = (result) => {
        if (currentGuess) {
            socket.emit('judge result', { 
                roomId, 
                nickname: currentGuess.nickname, 
                guess: currentGuess.guess, 
                result 
            });
            // 清除当前猜测，触发下一个猜测的判断
            setCurrentGuess(null);
        }
    };

    if (!currentGuess) {
        return <div>Waiting for guesses...</div>;
    }

    return (
        <div>
            <h2>Judge Page</h2>
            <p>Keyword: {keyword}</p>
            <div>
                <p>{currentGuess.nickname}: {currentGuess.guess}</p>
                <div>
                    <p>AI Judgment: {currentGuess.aiJudgment.Judge ? 'Correct' : 'Incorrect'}</p>
                    <p>Reason: {currentGuess.aiJudgment.Reason}</p>
                </div>
                <button onClick={() => handleJudge('approve')}>Approve</button>
                <button onClick={() => handleJudge('reject')}>Reject</button>
            </div>
            <p>Remaining guesses to judge: {guessQueue.length}</p>
        </div>
    );
};

export default Judge;