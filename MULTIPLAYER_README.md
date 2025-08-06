# Documentation: Upgrading "Dead by AI" to True Multiplayer

The current version of the game cleverly simulates multiplayer on a single device ("hot-seat" mode). To allow users to play together from different devices over the internet, we need to implement a client-server architecture. This document outlines the necessary components and steps for this transition.

---

## 1. Core Architectural Shift: Client-Server Model

The fundamental change is moving from a self-contained React application to a system with two main parts:

*   **Frontend (Client):** The React application you currently have. Its role will change from managing the entire game state to primarily rendering the UI and communicating user actions to the backend.
*   **Backend (Server):** A new, authoritative application that will run on a server. It will manage user accounts, game logic, and communication between players. **Crucially, the server will be the single source of truth for the game state.** This prevents cheating, as players cannot simply change their score or game status locally.

---

## 2. The Backend Server

This is the new brain of your application.

### Responsibilities:
*   **User Authentication:** Handle user registration (e.g., with email/password) and login. It will issue secure tokens (like JSON Web Tokens - JWTs) to authenticated clients to verify their identity on subsequent requests.
*   **Matchmaking & Lobbies:** Manage the creation of game "rooms." Players should be able to join a friend's room with a unique code or be matched with random opponents.
*   **Game State Management:** The server must keep track of everything: which players are in which game, the current scenario, each player's submitted story, the official scores, and whose turn it is.
*   **Secure API Calls:** The Gemini API key **must be moved** from the frontend to the backend. The server will receive stories from players, make the API call to Gemini, and then relay the results back to the players. This is critical for security, as it prevents your API key from being exposed in the browser.
*   **Real-time Communication:** Orchestrate the flow of information between players in real time.

### Recommended Technology:
*   **Node.js with a framework like Express.js or Fastify:** A popular choice for JavaScript developers, allowing you to use the same language on both the front and back end.
*   **WebSockets:** For real-time communication, a persistent connection between the client and server is required. WebSockets are the standard for this. Libraries like **`Socket.io`** or **`ws`** make implementing this much easier by providing event-based communication. The server will broadcast events like `playerJoined`, `storySubmitted`, or `roundOver` to all clients in a game room.

---

## 3. Database

To store information permanently (persistently), you'll need a database connected to your backend server.

### Responsibilities:
*   Store user account information (e.g., `userId`, `username`, `hashedPassword`).
*   Persist game data, such as match history and all-time high scores.
*   Potentially store ongoing game states so a match can be resumed if a player disconnects.

### Example Data Models (Tables/Collections):
*   **`Users`**: `id`, `username`, `email`, `password_hash`
*   **`Games`**: `id`, `room_code`, `status` (e.g., 'lobby', 'in-progress', 'finished')
*   **`GamePlayers`**: A linking table that connects users to games, storing their `score` for that specific match.

### Recommended Technology:
*   **PostgreSQL (SQL):** Excellent for structured, relational data like user accounts and game records.
*   **MongoDB (NoSQL):** Offers more flexibility, which can be useful for storing less structured data like complex game state objects.
*   **Firebase/Supabase (Backend-as-a-Service):** These platforms can significantly speed up development by bundling a database with pre-built authentication, real-time data synchronization, and other backend features.

---

## 4. Frontend (Client) Modifications

Your existing React app will need to be refactored to communicate with the new backend.

*   **Authentication Flow:** Add login and registration pages/modals. After a user logs in, store the authentication token (JWT) securely (e.g., in `localStorage`) and include it in the header of every request to the backend.
*   **UI for Lobby/Matchmaking:** Create new UI components for creating, joining, and waiting in a game lobby.
*   **State Management:** Remove the client-side game logic. Instead of `useState` hooks for `gamePhase` or `players`, the app will listen for WebSocket events from the server and update the UI accordingly. For example, when the server sends a `roundResults` event, the client simply displays the data it receives.
*   **API Calls:** All data-fetching logic will be redirected to your new backend endpoints. The `handleJudge` function, for instance, would be replaced by sending the player's story to the server via a WebSocket event and waiting for a response.

---

## Summary of the New Online Game Flow

1.  **Login:** A player opens the app and logs into their account.
2.  **Lobby:** The player creates a new game room (receiving a shareable code) or joins an existing one.
3.  **Game Start:** Once two players are in the room, the host starts the game. The server generates a random prompt and broadcasts it to both players.
4.  **Story Submission:** Each player writes and submits their story. The frontend sends the story to the backend. The UI might show a "Waiting for opponent..." message.
5.  **Judging:** Once the server has received stories from *both* players, it makes a single, secure call to the Gemini API.
6.  **Results:** The server receives the judgment from Gemini, updates the scores in the database, and broadcasts the final results to both players simultaneously.
7.  **Next Round:** A player clicks "Next Round," which sends an event to the server. The server then starts the loop over from step 3.
