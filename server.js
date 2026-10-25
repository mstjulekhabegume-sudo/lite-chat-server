const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const cors = require('cors');
const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let messages = [];
try{ if(fs.existsSync('./db.json')) messages = JSON.parse(fs.readFileSync('./db.json')); }catch(e){}
function saveDB(){ fs.writeFileSync('./db.json', JSON.stringify(messages.slice(-500))); }
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ t: 'history', d: messages.slice(-50) }));
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      let packet = { u: data.u.slice(0,20), m: data.m, ts: Date.now() };
      messages.push(packet); saveDB();
      let out = JSON.stringify({ t: 'msg', d: packet });
      wss.clients.forEach(c => { if(c.readyState === 1) c.send(out); });
    } catch(e){}
  });
});
app.get('/', (req,res) => res.send('Lite Server Running'));
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log('Running on '+PORT));
