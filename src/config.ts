const config = {
  SERVER_URL: import.meta.env.PROD 
    ? 'https://aideath-production.up.railway.app/' // Will update this after Railway deployment
    : 'http://localhost:3001'
};

export default config; 