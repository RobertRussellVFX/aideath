const config = {
  SERVER_URL: import.meta.env.PROD 
    ? 'https://your-railway-app.railway.app' // Will update this after Railway deployment
    : 'http://localhost:3001'
};

export default config; 