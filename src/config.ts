const config = {
  SERVER_URL: import.meta.env.VITE_SERVER_URL || 
    (import.meta.env.PROD 
      ? 'https://aideath-production.up.railway.app' 
      : 'http://localhost:3001')
};

export default config; 