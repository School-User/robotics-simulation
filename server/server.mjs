// Tiny room server: relays robot poses, arbitrates item claims (first wins), owns match start/reset.
// Robot movement stays client-side. ponytail: no rule validation/anti-cheat; add if strangers play.
import {WebSocketServer} from 'ws';
const CLAIM=/^([0-3]:)?(Plate|Cup|Veg|Fruit|Dairy|Protein|Grain|Water|Table)_\d+$/;
const rooms=new Map(), wss=new WebSocketServer({port:+process.env.PORT||8080,maxPayload:2048});
const MAX=4,MATCH=120,BREAK=10; // seconds; BREAK = results screen / score-submit window before auto-restart
// Public rooms are "pub-N": join the fullest one with space (keeps matches lively), else open a new one.
const pick=()=>{let best,n=-1;for(const[k,v]of rooms)if(k.startsWith('pub-')&&v.clients.size<MAX&&v.clients.size>n){best=k;n=v.clients.size;}
  if(best)return best;let i=1;while(rooms.has('pub-'+i))i++;return 'pub-'+i;};
const newMatch=r=>{r.claims.clear();r.start=Date.now();r.clients.forEach(c=>send(c,{t:'start'}));};
setInterval(()=>rooms.forEach(r=>{if(Date.now()-r.start>(MATCH+BREAK)*1000)newMatch(r);}),1000);
const send=(ws,o)=>ws.readyState===1&&ws.send(JSON.stringify(o));
wss.on('connection',(ws,req)=>{
  const asked=(new URL(req.url,'http://x').searchParams.get('room')||'').replace(/[^\w-]/g,'').slice(0,24);
  const room=asked||pick();
  const r=rooms.get(room)||rooms.set(room,{claims:new Set(),start:Date.now(),clients:new Set()}).get(room);
  const q=[0,1,2,3].find(i=>![...r.clients].some(c=>c.q===i)); // one robot per quadrant: 0 red, 1 blue, 2 yellow, 3 green
  if(q===undefined){send(ws,{t:'full'});ws.close();return;}
  ws.q=q;const id=Math.random().toString(36).slice(2,8);r.clients.add(ws);
  const others=o=>r.clients.forEach(c=>c!==ws&&send(c,o));
  send(ws,{t:'init',id,room,q,claims:[...r.claims],elapsed:(Date.now()-r.start)/1000});
  ws.on('message',d=>{let m;try{m=JSON.parse(d);}catch{return;}
    if(m.t==='p'&&[m.x,m.z,m.ry,m.score].every(Number.isFinite))others({t:'p',id,q,x:m.x,z:m.z,ry:m.ry,score:m.score,name:String(m.name||'').slice(0,16)});
    else if(m.t==='claim'&&CLAIM.test(m.n)){
      if(r.claims.has(m.n))send(ws,{t:'no',n:m.n});else{r.claims.add(m.n);send(ws,{t:'ok',n:m.n});others({t:'taken',n:m.n});}
    }else if(m.t==='reset'&&Date.now()-r.start>MATCH*1000)newMatch(r);
  });
  ws.on('close',()=>{r.clients.delete(ws);others({t:'left',id});if(!r.clients.size)rooms.delete(room);});
});
console.log('game server on :'+wss.options.port);
