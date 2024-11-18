import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Viewer = () => {
    const [keyword, setKeyword] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [guess, setGuess] = useState('');
    const [waitingForImage, setWaitingForImage] = useState(true);
    const [hasGuessed, setHasGuessed] = useState(false);
    const [allGuessesResult, setAllGuessesResult] = useState(null);
    const location = useLocation();
    const navigate = useNavigate(); // 初始化 navigate
    const { roomId, nickname } = location.state || {};

    useEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, nickname });
        }

        socket.on('room full', () => {
            alert('The room is full.');
            navigate('/');
        });

        // 测试在线地址图片
        // setKeyword('Test Keyword');
        // setImageUrl('https://picsum.photos/200/300');
        // setWaitingForImage(false);

        socket.on('new drawing', ({ keyword, imageUrl }) => {
            setKeyword(keyword);
            setImageUrl(imageUrl);
            setWaitingForImage(false); // 图片显示后取消提示语
        });

        socket.on('guess received', ({ message }) => {
            alert(message);
        });

        socket.on('all guesses', ({ guesses, judgments }) => {
            setAllGuessesResult({ guesses, judgments });
        });

        return () => {
            if (roomId) {
                console.log(`Leaving room ${roomId} with nickname ${nickname}`);
                socket.emit('leave room', { roomId, nickname });
            }
            socket.off('room full');
            socket.off('new drawing');     
            socket.off('guess received');
            socket.off('all guesses');  
        };
    }, [roomId, nickname, navigate]);

    const handleGuess = async (e) => {
        e.preventDefault();
        if (guess.trim()) {
            try {
                const response = await fetch('http://localhost:3001/submit-guess', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roomId, nickname, guess: guess.trim() }),
                });

                if (response.ok) {
                    setHasGuessed(true);
                    setGuess('');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error);
                }
            } catch (error) {
                console.error('Error submitting guess:', error);
                alert(error.message || 'Failed to submit guess. Please try again.');
            }
        } else if (hasGuessed) {
            alert('You have already submitted your guess.');
        } else {
            alert('Please enter a guess.');
        }
    };

    return (
        <div>
            <h2>Viewer</h2>
            {waitingForImage ? (
                <p>Waiting for the drawer to upload an image...</p>
            ) : (
                <>
                    <img src={imageUrl} alt="Drawing" style={{ maxWidth: '100%' }} />
                    {!hasGuessed ? (
                        <>
                            <input
                                type="text"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                placeholder="Enter your guess"
                            />
                            <button onClick={handleGuess}>Submit Guess</button>
                        </>
                    ) : (
                        <p>You have submitted your guess. Waiting for other players...</p>
                    )}
                </>
            )}
            {allGuessesResult && (
                <div>
                    <h3>All Guesses:</h3>
                    {allGuessesResult.map((result, index) => (
                        <div key={index}>
                            <p>{result.nickname}: {result.guess}</p>
                            <p>判断: {result.judgment.Judge ? '正确' : '错误'}</p>
                            <p>原因: {result.judgment.Reason}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Viewer;