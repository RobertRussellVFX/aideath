import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import config from './src/config';

// Types for better type safety
interface Player {
  id: string;
  name: string;
  score: number;
}

interface GameState {
  phase: 'login' | 'browser' | 'lobby' | 'writing' | 'judging' | 'results';
  players: Player[];
  roomCode: string;
  playerId: string;
  currentPrompt: string;
  myStory: string;
  roundResults: any[];
  error: string;
  isJudging: boolean;
  totalSubmitted: number;
  totalPlayers: number;
  hasSubmittedStory: boolean;
  timeLimit: number;
  timeRemaining: number;
}

const App = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    phase: 'login',
    players: [],
    roomCode: '',
    playerId: '',
    currentPrompt: '',
    myStory: '',
    roundResults: [],
    error: '',
    isJudging: false,
    totalSubmitted: 0,
    totalPlayers: 0,
    hasSubmittedStory: false,
    timeLimit: 120,
    timeRemaining: 0
  });

  // Form states
  const [playerName, setPlayerName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(120);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [presetPrompts, setPresetPrompts] = useState<string[]>([]);

  // Fetch available rooms
  const fetchRooms = async () => {
    try {
      const response = await fetch(`${config.SERVER_URL}/api/rooms`);
      const rooms = await response.json();
      setAvailableRooms(rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  // Fetch preset prompts
  const fetchPrompts = async () => {
    try {
      const response = await fetch(`${config.SERVER_URL}/api/prompts`);
      const prompts = await response.json();
      setPresetPrompts(prompts);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    }
  };

  const joinRoom = (roomCode?: string, isPublic: boolean = true) => {
    if (!socket || !playerName.trim()) return;
    
    socket.emit('joinRoom', {
      playerName: playerName.trim(),
      roomCode: roomCode || undefined,
      isPublic
    });
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit('startGame', { 
      customPrompt: customPrompt.trim() || undefined,
      timeLimit: selectedTimeLimit 
    });
  };

  const goToBrowser = () => {
    setGameState(prev => ({ ...prev, phase: 'browser' }));
    fetchRooms();
    fetchPrompts();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitStory = () => {
    if (!socket || !gameState.myStory.trim()) return;
    
    // Mark as submitted immediately to prevent double submission
    setGameState(prev => ({ ...prev, hasSubmittedStory: true }));
    
    socket.emit('submitStory', { story: gameState.myStory.trim() });
  };

  const judgeStories = () => {
    if (!socket) return;
    socket.emit('judgeStories');
  };

  const nextRound = () => {
    if (!socket) return;
    socket.emit('nextRound');
  };

  // Connect to server on component mount
  useEffect(() => {
    const newSocket = io(config.SERVER_URL, {
      withCredentials: true,
      transports: ['polling'], // Force polling only for now
      upgrade: false // Prevent upgrading to websocket
    });
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('roomJoined', (data) => {
      console.log('Room joined:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'lobby',
        roomCode: data.roomCode,
        playerId: data.playerId,
        players: data.players,
        error: ''
      }));
    });

    newSocket.on('playerJoined', (data) => {
      console.log('Player joined:', data);
      setGameState(prev => ({
        ...prev,
        players: data.players
      }));
    });

    newSocket.on('gameStarted', (data) => {
      console.log('Game started:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'writing',
        currentPrompt: data.prompt,
        myStory: '',
        totalSubmitted: 0,
        roundResults: [],
        hasSubmittedStory: false,
        timeLimit: data.timeLimit || 120,
        timeRemaining: data.timeRemaining || 120
      }));
    });

    newSocket.on('timeUpdate', (data) => {
      setGameState(prev => ({
        ...prev,
        timeRemaining: data.timeRemaining
      }));
    });

    newSocket.on('timeUp', (data) => {
      setGameState(prev => ({
        ...prev,
        phase: data.gamePhase,
        timeRemaining: 0
      }));
    });

    newSocket.on('storySubmitted', (data) => {
      console.log('Story submitted:', data);
      setGameState(prev => ({
        ...prev,
        totalSubmitted: data.totalSubmitted,
        totalPlayers: data.totalPlayers,
        hasSubmittedStory: prev.hasSubmittedStory || data.playerId === prev.playerId
      }));
    });

    newSocket.on('allStoriesSubmitted', (data) => {
      console.log('All stories submitted:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'judging'
      }));
    });

    newSocket.on('judgingStarted', () => {
      console.log('Judging started');
      setGameState(prev => ({
        ...prev,
        isJudging: true
      }));
    });

    newSocket.on('roundResults', (data) => {
      console.log('Round results:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'results',
        roundResults: data.results,
        players: data.players,
        isJudging: false
      }));
    });

    newSocket.on('playerLeft', (data) => {
      console.log('Player left:', data);
      setGameState(prev => ({
        ...prev,
        players: data.players
      }));
    });

    newSocket.on('error', (data) => {
      console.error('Server error:', data);
      setGameState(prev => ({
        ...prev,
        error: data.message
      }));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const renderLogin = () => (
    <div className="card setup-card">
      <h2>Join Dead by AI</h2>
      <div className="player-inputs">
        <input
          type="text"
          className="player-name-input"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
        />
      </div>
      <div className="room-options">
        <button 
          onClick={() => joinRoom()} 
          className="submit-button"
          disabled={!playerName.trim()}
        >
          Create New Room
        </button>
        <button 
          onClick={goToBrowser} 
          className="submit-button"
          disabled={!playerName.trim()}
        >
          Browse Rooms
        </button>
        <div className="join-room-section">
          <input
            type="text"
            className="player-name-input"
            placeholder="Room Code (e.g. ABC123)"
            value={joinRoomCode}
            onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && joinRoom(joinRoomCode)}
          />
          <button 
            onClick={() => joinRoom(joinRoomCode)} 
            className="submit-button"
            disabled={!playerName.trim() || !joinRoomCode.trim()}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );

  const renderBrowser = () => (
    <div className="card setup-card">
      <h2>Browse Available Rooms</h2>
      <button 
        onClick={() => setGameState(prev => ({ ...prev, phase: 'login' }))} 
        className="submit-button small"
      >
        ← Back
      </button>
      
      <div className="room-list">
        {availableRooms.length === 0 ? (
          <p>No available rooms. Create your own!</p>
        ) : (
          availableRooms.map(room => (
            <div key={room.roomCode} className="room-item" onClick={() => joinRoom(room.roomCode)}>
              <div className="room-code">{room.roomCode}</div>
              <div className="room-info">
                <span>{room.playerCount}/{room.maxPlayers} players</span>
                <span>{room.gamePhase}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <button onClick={fetchRooms} className="submit-button">
        Refresh Rooms
      </button>
    </div>
  );

  const renderLobby = () => (
    <div className="card setup-card">
      <h2>Game Lobby</h2>
      <div className="room-info">
        <h3>Room Code: <span className="room-code">{gameState.roomCode}</span></h3>
        <p>Share this code with your friend!</p>
      </div>
      
      <div className="lobby-players">
        <h4>Players ({gameState.players.length}/2):</h4>
        {gameState.players.map((player, index) => (
          <div key={player.id} className="lobby-player">
            <span>{player.name}</span>
            {player.id === gameState.playerId && <span className="you-indicator">(You)</span>}
          </div>
        ))}
      </div>

      {gameState.players.length === 2 && (
        <div className="game-settings">
          <h4>Game Settings</h4>
          
          <div className="setting-group">
            <label>Custom Prompt (optional):</label>
            <textarea
              className="story-textarea small"
              placeholder="Enter a custom scenario, or leave blank for random..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label>Preset Prompts:</label>
            <div className="preset-prompts">
              {presetPrompts.map((prompt, index) => (
                <button
                  key={index}
                  className="prompt-button"
                  onClick={() => setCustomPrompt(prompt)}
                >
                  {prompt.substring(0, 50)}...
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>Time Limit:</label>
            <select 
              value={selectedTimeLimit} 
              onChange={(e) => setSelectedTimeLimit(Number(e.target.value))}
              className="time-select"
            >
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
          </div>
        </div>
      )}

      {gameState.players.length < 2 ? (
        <p className="waiting-message">Waiting for another player to join...</p>
      ) : (
        <button onClick={startGame} className="submit-button">
          Start Game
        </button>
      )}
    </div>
  );

  const renderWriting = () => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.playerId);

    return (
      <>
        <Scoreboard players={gameState.players} />
        
        {gameState.timeRemaining > 0 && (
          <div className="timer-card card">
            <h3>Time Remaining: <span className={gameState.timeRemaining <= 30 ? 'timer-warning' : 'timer-normal'}>
              {formatTime(gameState.timeRemaining)}
            </span></h3>
          </div>
        )}
        
        <div className="card prompt-card">
          <h2>THE SCENARIO</h2>
          <p className="prompt-text">{gameState.currentPrompt}</p>
        </div>

        {gameState.totalSubmitted > 0 && (
          <div className="card waiting-card">
            <p>Stories submitted: {gameState.totalSubmitted}/{gameState.totalPlayers}</p>
          </div>
        )}

        {!gameState.hasSubmittedStory ? (
          <div className="story-form">
            <h3>{currentPlayer?.name}, how do you survive?</h3>
            <textarea
              className="story-textarea"
              placeholder="Your survival story..."
              value={gameState.myStory}
              onChange={(e) => setGameState(prev => ({ ...prev, myStory: e.target.value }))}
              disabled={gameState.timeRemaining === 0}
            />
            <button 
              onClick={submitStory} 
              className="submit-button" 
              disabled={!gameState.myStory.trim() || gameState.timeRemaining === 0}
            >
              Submit Story
            </button>
          </div>
        ) : (
          <div className="card waiting-card">
            <p>Your story has been submitted. Waiting for other players...</p>
          </div>
        )}
      </>
    );
  };

  const renderJudging = () => (
    <>
      <Scoreboard players={gameState.players} />
      <div className="card prompt-card">
        <h2>THE SCENARIO</h2>
        <p className="prompt-text">{gameState.currentPrompt}</p>
      </div>
      <div className="card judging-card">
        <p>All stories are in!</p>
        <button 
          onClick={judgeStories} 
          disabled={gameState.isJudging} 
          className="submit-button"
        >
          {gameState.isJudging ? 'AI is Judging...' : 'Let the AI Judge!'}
        </button>
      </div>
      {gameState.isJudging && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>The AI is deciding your fate...</p>
        </div>
      )}
    </>
  );

  const renderResults = () => (
    <>
      <Scoreboard players={gameState.players} />
      <div className="results-grid">
        {gameState.roundResults.map((result, index) => (
          <div key={index} className="card result-card">
            <h3>{result.playerName}</h3>
            <div className={`verdict ${result.survived ? 'survived' : 'died'}`}>
              {result.survived ? 'YOU SURVIVED' : 'YOU DIED'}
            </div>
            <p className="reasoning">{result.reasoning}</p>
          </div>
        ))}
      </div>
      <button onClick={nextRound} className="submit-button">Next Round</button>
    </>
  );

  const renderContent = () => {
    if (gameState.error) {
      return (
        <div className="error-container">
          <p className="error-text">{gameState.error}</p>
          <button 
            onClick={() => setGameState(prev => ({ ...prev, error: '', phase: 'login' }))}
            className="submit-button"
          >
            Back to Login
          </button>
        </div>
      );
    }

    switch (gameState.phase) {
      case 'login':
        return renderLogin();
      case 'browser':
        return renderBrowser();
      case 'lobby':
        return renderLobby();
      case 'writing':
        return renderWriting();
      case 'judging':
        return renderJudging();
      case 'results':
        return renderResults();
      default:
        return null;
    }
  };

  return (
    <div className="container">
      <h1>Dead by AI</h1>
      {renderContent()}
    </div>
  );
};

const Scoreboard = ({ players }: { players: Player[] }) => (
  <div className="scoreboard card">
    {players.map((player, index) => (
      <div key={player.id} className="scoreboard-player">
        <span className="scoreboard-name">{player.name}</span>
        <span className="scoreboard-score">{player.score}</span>
      </div>
    ))}
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
