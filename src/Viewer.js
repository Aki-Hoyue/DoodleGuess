import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Viewer = () => {
    const [keyword, setKeyword] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [guess, setGuess] = useState('');
    const [waitingForImage, setWaitingForImage] = useState(true);
    const location = useLocation();
    const { roomId, nickname } = location.state || {};

    useEffect(() => {
        if (roomId && nickname) {
            console.log(`Joining room ${roomId} with nickname ${nickname}`);
            socket.emit('join room', { roomId, nickname });
        }

        socket.on('new drawing', ({ keyword, imageUrl }) => {
            setKeyword(keyword);
            setImageUrl(imageUrl);
            setWaitingForImage(false); // 图片显示后取消提示语
        });

        return () => {
            if (roomId) {
                console.log(`Leaving room ${roomId} with nickname ${nickname}`);
                socket.emit('leave room', { roomId, nickname });
            }
            socket.off('new drawing');
        };
    }, [roomId, nickname]);

    const handleGuess = (e) => {
        e.preventDefault();
        // 处理猜测逻辑
        console.log('Guessed:', guess);
        setGuess('');
    };

    return (
        <div className="viewer-container">
            <h2>Doodle Guess</h2>
            {waitingForImage && <p>Waiting for the painter to draw...</p>}
            {imageUrl && (
                <img 
                    src={imageUrl} 
                    alt="Drawing" 
                    className="drawing-image"
                />
            )}
            <form onSubmit={handleGuess}>
                <input
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Input your guess"
                />
                <button type="submit">submit</button>
            </form>
        </div>
    );
};

export default Viewer;