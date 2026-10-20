# Deployment guide

## Render.com
1. Push the project to GitHub.
2. New > Web Service > select the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add `GOOGLE_MAPS_API_KEY`, `ADMIN_TOKEN`, `DEFAULT_LAT`, `DEFAULT_LNG`.
5. Add the Render URL to your Google key's HTTP referrers.

## VPS (Ubuntu)
```bash
sudo apt install nodejs npm nginx
npm install --omit=dev
npm i -g pm2 && pm2 start server.js --name fixmyarea && pm2 save
```
Proxy port 3000 through Nginx and enable HTTPS with certbot.
