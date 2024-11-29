import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import DrawingCanvas from './DrawingCanvas';
import Viewer from './Viewer';
import RoomManagement from './RoomManagement';
import Judge from './Judge';
import Waiting from './Waiting';
import GameOver from './GameOver';

// 滚动恢复组件
function ScrollToTop() {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// 主App组件
function App() {
  return (
    <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<RoomManagement />} />
          <Route 
            path="/draw/:roomId" 
            element={<DrawingCanvas key={window.location.pathname} />} 
          />
          <Route 
            path="/view/:roomId" 
            element={<Viewer key={window.location.pathname} />} 
          />
          <Route 
            path="/judge/:roomId" 
            element={<Judge key={window.location.pathname}/>} 
          />
          <Route 
            path="/waiting/:roomId" 
            element={<Waiting key={window.location.pathname} />} />
          <Route 
            path="/game-over" 
            element={<GameOver key={window.location.pathname} />} />
        </Routes>        
    </Router>
  );
}

export default App;