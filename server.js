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
