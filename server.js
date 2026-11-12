const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const rooms = new Map();
const sockets = new Map();
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const cars = ['Verna Street', 'Falcon GT', 'Cairo Coupe', 'Desert Runner', 'Nightline S'];
const botNames = ['Ninja', 'Turbo', 'Sahra', 'Shadow', 'Racer X', 'Lina', 'Drift King', 'Comet', 'Blaze'];

function newRoom(code) {
  return { code, players: new Map(), bots: [], state: 'lobby', mode: 'group', created: Date.now(), finishOrder: [] };
}
function roomSnapshot(room) {
  return { code: room.code, state: room.state, mode: room.mode,
    players: [...room.players.values()].map(({id, name, color, car, progress, lane, speed, finished, isBot}) => ({id, name, color, car, progress, lane, speed, finished, isBot})),
    bots: room.bots.map(({id,name,color,car,progress,lane,speed,finished}) => ({id,name,color,car,progress,lane,speed,finished,isBot:true})) };
}
function emitRoom(room) { io.to(room.code).emit('room:update', roomSnapshot(room)); }
function addBot(room, index) {
  room.bots.push({ id: `bot-${room.code}-${index}`, name: botNames[index % botNames.length], color: ['#f04e42','#45d6bd','#bc7cff','#f7c548','#4da3ff'][index%5], car: cars[(index+1)%cars.length], progress: 0, lane: (index%3-1)*0.45, speed: 0, finished: false, target: 105 + Math.random()*38 });
}
function startRace(room, mode) {
  if (room.state === 'race') return false;
  const humans = room.players.size;
  if (mode === 'group' && humans < 2) return false;
  room.mode = mode;
  room.bots = [];
  if (mode === 'solo') for (let i=0; i<5; i++) addBot(room,i);
  for (const p of room.players.values()) { p.progress=0; p.lane=0; p.speed=0; p.finished=false; p.input={gas:0,brake:0,steer:0}; }
  for (const b of room.bots) { b.progress=0; b.speed=0; b.finished=false; }
  room.state='race'; room.raceStarted=Date.now(); room.finishOrder=[];
  io.to(room.code).emit('race:started', {mode, countdown:3}); emitRoom(room); return true;
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req,res)=>res.json({ok:true,rooms:rooms.size,players:sockets.size}));

io.on('connection', socket => {
  socket.on('profile:join', data => {
    const name=String(data?.name||'Driver').replace(/[<>]/g,'').trim().slice(0,18)||'Driver';
    const code=String(data?.room||'SADAT').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,8)||'SADAT';
    let room=rooms.get(code); if(!room){room=newRoom(code);rooms.set(code,room);}
    if(room.players.size>=MAX_PLAYERS){socket.emit('notice',{message:'الغرفة ممتلئة (10 لاعبين).'});return;}
    if(sockets.has(socket.id)){
      const old=rooms.get(sockets.get(socket.id)); if(old){old.players.delete(socket.id);emitRoom(old);}
    }
    const player={id:socket.id,name,color:['#e8a241','#32c7b1','#f07167','#9d84ed','#77adff'][room.players.size%5],car:cars[0],progress:0,lane:0,speed:0,finished:false,input:{gas:0,brake:0,steer:0}};
    room.players.set(socket.id,player);sockets.set(socket.id,code);socket.join(code);socket.emit('profile:ready',{id:socket.id,room:code,name});emitRoom(room);
  });
  socket.on('garage:car', data=>{const room=rooms.get(sockets.get(socket.id));const p=room?.players.get(socket.id);if(!p||room.state==='race')return;p.car=cars.includes(data?.car)?data.car:cars[0];emitRoom(room);});
  socket.on('race:request', data=>{const room=rooms.get(sockets.get(socket.id));if(!room)return;const mode=data?.mode==='solo'?'solo':'group';if(!startRace(room,mode))socket.emit('notice',{message:'السباق الجماعي يحتاج لاعبين حقيقيين على الأقل. اختار اللعب الفردي ضد السائقين الآليين أو ادعُ صديقًا.'});});
  socket.on('race:input', input=>{const room=rooms.get(sockets.get(socket.id));const p=room?.players.get(socket.id);if(!p||room.state!=='race'||p.finished)return;p.input={gas:clamp(Number(input?.gas)||0,0,1),brake:clamp(Number(input?.brake)||0,0,1),steer:clamp(Number(input?.steer)||0,-1,1)};});
  socket.on('chat:send', data=>{const room=rooms.get(sockets.get(socket.id));const p=room?.players.get(socket.id);const text=String(data?.text||'').replace(/[<>]/g,'').trim().slice(0,120);if(room&&p&&text)io.to(room.code).emit('chat:new',{name:p.name,text});});
  socket.on('disconnect',()=>{const code=sockets.get(socket.id);const room=rooms.get(code);if(room){room.players.delete(socket.id);if(room.players.size===0)rooms.delete(code);else emitRoom(room);}sockets.delete(socket.id);});
});

setInterval(()=>{
  const dt=0.05;
  for(const room of rooms.values()){
    if(room.state!=='race')continue;
    for(const p of room.players.values()){
      if(p.finished)continue;
      p.speed=clamp(p.speed+(p.input.gas*44-p.input.brake*82-3)*dt,0,155);
      p.lane=clamp(p.lane+p.input.steer*dt*0.9,-1.2,1.2);
      p.progress+=p.speed*dt/3000;
      if(p.progress>=1){p.progress=1;p.finished=true;room.finishOrder.push({id:p.id,name:p.name,place:room.finishOrder.length+1,coins:250});}
    }
    for(const b of room.bots){if(b.finished)continue;b.speed=clamp(b.speed+(b.target-b.speed)*dt*0.22,0,145);b.progress+=b.speed*dt/3000;if(b.progress>=1){b.progress=1;b.finished=true;room.finishOrder.push({id:b.id,name:b.name,place:room.finishOrder.length+1,coins:250});}}
    io.to(room.code).emit('race:state',{...roomSnapshot(room),finishOrder:room.finishOrder});
    if([...room.players.values()].every(p=>p.finished)&&room.bots.every(b=>b.finished)){room.state='results';io.to(room.code).emit('race:results',{finishOrder:room.finishOrder});emitRoom(room);}
  }
},50);

server.listen(PORT,()=>console.log(`Street Rush Arena listening on :${PORT}`));
