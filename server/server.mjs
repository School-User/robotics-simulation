// Tiny room server: relays robot poses, arbitrates item claims (first wins), owns the lobby/match cycle.
// Robot movement stays client-side. ponytail: no rule validation/anti-cheat; add if strangers play.
// One process serves the game files, /health (for the keep-alive pinger) and the WebSocket on the same port, as Render expects.
import {WebSocketServer} from 'ws';
import {createServer} from 'http';
import {createReadStream} from 'fs';
const ROOT=new URL('../',import.meta.url).pathname;
const FILES={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/game.js':['game.js','text/javascript'],'/field.glb':['field.glb','model/gltf-binary']}; // whitelist: nothing else is served
const http=createServer((req,res)=>{const path=new URL(req.url,'http://x').pathname,f=FILES[path];
  if(path==='/health'){res.end('ok');return;}
  if(!f){res.writeHead(404).end('not found');return;}
  res.writeHead(200,{'Content-Type':f[1],'Cache-Control':path==='/field.glb'?'public, max-age=86400':'no-cache'});
  createReadStream(ROOT+f[0]).on('error',()=>res.destroy()).pipe(res);});
const CLAIM=/^([0-3]:)?(Plate|Cup|Veg|Fruit|Dairy|Protein|Grain|Water|Table)_\d+$/;
const rooms=new Map(), wss=new WebSocketServer({server:http,maxPayload:2048});
http.listen(+process.env.PORT||8080);
const MAX=4,LOBBY=15,MATCH=120,BREAK=10; // seconds; BREAK = results screen / score-submit window
// Rooms cycle lobby -> match -> results -> lobby. r.start is when the match begins; joins are only allowed before it (no joining mid-match).
const open=r=>Date.now()<r.start&&r.clients.size<MAX;
// Public rooms are "pub-N": join the fullest one still in its lobby (keeps matches lively), else open a new one.
const pick=()=>{let best,n=-1;for(const[k,v]of rooms)if(k.startsWith('pub-')&&open(v)&&v.clients.size>n){best=k;n=v.clients.size;}
  if(best)return best;let i=1;while(rooms.has('pub-'+i))i++;return 'pub-'+i;};
const newLobby=r=>{r.claims.clear();r.start=Date.now()+LOBBY*1000;r.live=false;r.clients.forEach(c=>send(c,{t:'lobby',in:LOBBY}));};
setInterval(()=>rooms.forEach(r=>{const t=Date.now()-r.start;
  if(!r.live&&t>=0){r.live=true;r.clients.forEach(c=>send(c,{t:'start',len:MATCH}));}else if(t>(MATCH+BREAK)*1000)newLobby(r);}),250);
const send=(ws,o)=>ws.readyState===1&&ws.send(JSON.stringify(o));
wss.on('connection',(ws,req)=>{
  const asked=(new URL(req.url,'http://x').searchParams.get('room')||'').replace(/[^\w-]/g,'').slice(0,24);
  const room=asked||pick();
  const r=rooms.get(room)||rooms.set(room,{claims:new Set(),start:Date.now()+LOBBY*1000,live:false,clients:new Set()}).get(room);
  if(!open(r)){ // named room that is full or already playing
    if(r.clients.size>=MAX)send(ws,{t:'full'});else send(ws,{t:'busy',wait:(r.start+(MATCH+BREAK)*1000-Date.now())/1000});
    ws.close();return;}
  const q=[0,1,2,3].find(i=>![...r.clients].some(c=>c.q===i)); // one robot per quadrant: 0 red, 1 blue, 2 yellow, 3 green
  ws.q=q;const id=Math.random().toString(36).slice(2,8);r.clients.add(ws);
  const others=o=>r.clients.forEach(c=>c!==ws&&send(c,o));
  send(ws,{t:'init',id,room,q,claims:[...r.claims],elapsed:(Date.now()-r.start)/1000});
  ws.on('message',d=>{let m;try{m=JSON.parse(d);}catch{return;}
    if(m.t==='p'&&[m.x,m.z,m.ry,m.score].every(Number.isFinite))others({t:'p',id,q,x:m.x,z:m.z,ry:m.ry,score:m.score,name:String(m.name||'').slice(0,16)});
    else if(m.t==='claim'&&CLAIM.test(m.n)){
      if(r.claims.has(m.n)||!r.live||Date.now()-r.start>MATCH*1000)send(ws,{t:'no',n:m.n});else{r.claims.add(m.n);send(ws,{t:'ok',n:m.n});others({t:'taken',n:m.n});}
    }
  });
  ws.on('close',()=>{r.clients.delete(ws);others({t:'left',id});if(!r.clients.size)rooms.delete(room);});
});
console.log('game server on :'+(+process.env.PORT||8080));
