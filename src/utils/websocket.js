/* 
WebSocket connection management
*/
let ws = null;
let messageHandlers = new Map();
let isConnecting = false;
let currentClientId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

const BASE_URL = process.env.REACT_APP_SERVER_BASE_URL?.replace(/^https?:\/\//, '') || 'localhost:8000';
const API_BASE_URL = process.env.REACT_APP_SERVER_BASE_URL + '/api' || 'http://localhost:8000/api';

export const connectWebSocket = (clientId) => {
    // If already connected and clientId is the same, return directly
    if (ws && ws.readyState === WebSocket.OPEN && currentClientId === clientId) {
        return ws;
    }

    // If already connecting, return
    if (isConnecting) {
        return;
    }

    // If there is an old connection, close it
    if (ws) {
        ws.close();
        ws = null;
    }

    isConnecting = true;
    currentClientId = clientId;

    // Use FastAPI's WebSocket endpoint
    ws = new WebSocket(`ws://${BASE_URL}/ws/${clientId}`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        isConnecting = false;
        reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);
            const handler = messageHandlers.get(data.event);
            if (handler) {
                handler(data);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnecting = false;
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        isConnecting = false;
        ws = null;

        // If not closed by the client and the number of reconnection attempts has not reached the maximum, try to reconnect
        if (currentClientId && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(() => connectWebSocket(currentClientId), RECONNECT_DELAY);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnection attempts reached');
        }
    };

    return ws;
};

export const addMessageHandler = (event, handler) => {
    messageHandlers.set(event, handler);
};

export const removeMessageHandler = (event) => {
    messageHandlers.delete(event);
};

export const sendMessage = (data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending message:', data);
        ws.send(JSON.stringify(data));
    } else {
        console.error('WebSocket is not connected, trying to reconnect...');
        connectWebSocket(currentClientId);
        // Add the message to the queue and send it after reconnection
        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('Retrying to send message:', data);
                ws.send(JSON.stringify(data));
            } else {
                console.error('Failed to send message after reconnection attempt');
            }
        }, 1000);
    }
};

// API endpoints
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const api = {
    // Game state
    getGameState: async (roomId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/game/state/${roomId}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await handleResponse(response);
            console.log('Game state:', data);
            return data;
        } catch (error) {
            console.error('Failed to get game state:', error);
            throw error;
        }
    },

    // Submit guess
    submitGuess: async (roomId, playerId, guess) => {
        try {
            const response = await fetch(`${API_BASE_URL}/game/submit-guess`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    room_id: roomId,
                    player_id: playerId,
                    guess: guess
                }),
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Failed to submit guess:', error);
            throw error;
        }
    },

    // Upload drawing
    uploadDrawing: async (roomId, playerId, imageBlob) => {
        try {
            const formData = new FormData();
            formData.append('file', imageBlob);
            formData.append('room_id', roomId);
            formData.append('player_id', playerId);

            const response = await fetch(`${API_BASE_URL}/image/upload-drawing`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Failed to upload drawing:', error);
            throw error;
        }
    },

    // Get current drawing
    getDrawing: async (roomId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/image/get-drawing/${roomId}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            return handleResponse(response);
        } catch (error) {
            console.error('Failed to get drawing:', error);
            throw error;
        }
    }
}; 
