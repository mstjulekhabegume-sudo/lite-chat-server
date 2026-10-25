const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIG =====
let isServerOn = true;
const ADMIN_PASSWORD = "jiyam123";
let users = {}; // {userId: ws}
let offlineMessages = {}; // {userId: [msgs]}

// ===== ADMIN CONTROL =====
app.get('/', (req,res)=>{
  res.send('Jiyam Private Server Running - 50 User Private Chat Ready');
});

app.get('/admin/status', (req,res)=>{
  res.json({ 
    on: isServerOn, 
    onlineUsers: Object.keys(users).length,
    users: Object.keys(users)
  });
});

app.post('/admin/:action', (req,res)=>{
  const pw = req.headers['x-admin-password'] || req.body.password || req.query.password;
  if(pw !== ADMIN_PASSWORD) return res.status(401).json({error:"Wrong admin password"});
  
  if(req.params.action === 'on') isServerOn = true;
  if(req.params.action === 'off') isServerOn = false;
  if(req.params.action === 'toggle') isServerOn = !isServerOn;
  
  res.json({ on: isServerOn, onlineUsers: Object.keys(users).length });
});

// ===== HTTP SERVER =====
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ===== PRIVATE CHAT LOGIC =====
wss.on('connection', (ws)=>{
  
  // Server OFF check
  if(!isServerOn){
    ws.send(JSON.stringify({type:"error", text:"Server is OFF by Admin"}));
    ws.close();
    return;
  }

  ws.on('message', (raw)=>{
    try{
      let msg = JSON.parse(raw);

      // 1. LOGIN - User connects with his ID
      if(msg.type === 'login'){
        let userId = msg.userId?.toLowerCase().trim();
        if(!userId) return;
        
        // Remove old connection if exists
        if(users[userId] && users[userId] !== ws){
          try{ users[userId].close(); }catch{}
        }
        
        users[userId] = ws;
        ws.userId = userId;
        console.log(`User online: ${userId}`);

        // Send offline messages if any
        if(offlineMessages[userId] && offlineMessages[userId].length > 0){
          ws.send(JSON.stringify({
            type: "offline",
            messages: offlineMessages[userId]
          }));
          delete offlineMessages[userId];
        }

        // Confirm login
        ws.send(JSON.stringify({type:"login_ok", userId: userId}));
        
        // Notify others? No, private system so no broadcast
        return;
      }

      // Must be logged in for other actions
      if(!ws.userId) {
        ws.send(JSON.stringify({type:"error", text:"Please login first"}));
        return;
      }

      // 2. PRIVATE MESSAGE - Only to specific user
      if(msg.to && msg.text){
        let toId = msg.to.toLowerCase().trim();
        let fromId = ws.userId;
        let text = msg.text;

        let payload = JSON.stringify({
          type: "private",
          from: fromId,
          to: toId,
          text: text,
          time: new Date().toISOString()
        });

        let targetWs = users[toId];
        
        if(targetWs && targetWs.readyState === 1){
          // User ONLINE - send directly, only he will see
          targetWs.send(payload);
          // Send delivery confirm to sender
          ws.send(JSON.stringify({type:"sent", to: toId, text: text}));
        } else {
          // User OFFLINE - store for later
          if(!offlineMessages[toId]) offlineMessages[toId] = [];
          offlineMessages[toId].push({
            from: fromId,
            text: text,
            time: new Date().toISOString()
          });
          // Keep only last 20 offline msgs per user
          if(offlineMessages[toId].length > 20) offlineMessages[toId].shift();
          
          ws.send(JSON.stringify({type:"offline_stored", to: toId, text: "User offline, will deliver later"}));
        }
        return;
      }

      // 3. GET ONLINE USERS (optional, for admin)
      if(msg.type === 'getUsers'){
        ws.send(JSON.stringify({
          type: "userList",
          users: Object.keys(users)
        }));
        return;
      }

    }catch(e){
      console.log("Message error:", e.message);
    }
  });

  ws.on('close', ()=>{
    if(ws.userId && users[ws.userId] === ws){
      delete users[ws.userId];
      console.log(`User offline: ${ws.userId}`);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, ()=> console.log(`Private Server running on ${PORT}`));
