import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Upload from './Upload';
import Editor from './pages/Editor';
import ARViewer from './pages/ARViewer';
import './App.css';

function UploadWrapper() {
  const navigate = useNavigate();
  return (
    <Upload 
      onUploadSuccess={() => {}} 
      onNavigate={(path) => navigate(path)} 
    />
  );
}

function App() {
  const [theme, setTheme] = useState('dark'); // default to dark theme

  useEffect(() => {
    // Apply theme class to document element so it globally affects variables
    document.documentElement.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <BrowserRouter>
      <header className="app-header">
        <div className="nav-container">
          <Link to="/" className="nav-logo-link">
            <svg className="nav-logo-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            <span className="nav-title">3D Model Processor</span>
          </Link>
          <div style={{ marginLeft: 'auto' }}>
            <button 
              onClick={toggleTheme} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<UploadWrapper />} />
          <Route path="/editor/:fileId" element={<Editor />} />
          <Route path="/ar/:fileId" element={<ARViewer />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
