import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9dc8df);
const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 200);
scene.add(new THREE.HemisphereLight(0xd9efff,0x334225,2.2)); const sun=new THREE.DirectionalLight(0xffffff,2.4);sun.position.set(8,14,5);sun.castShadow=true;scene.add(sun);
const clock = new THREE.Clock(), loader = new GLTFLoader();
let named={}, robot, robotVisual, marker, ready=false, keys={}, lastPrompt='', state;
let floorBounds, fieldBounds, fieldStructure, spawnRotation=0, driveSpeed=0;
const up=new THREE.Vector3(0,1,0), cameraOffset=new THREE.Vector3(0,5.5,7.5);
const targetNames = ['RSA_Tile','DriverBox_Tile','QCA_Tile','Fridge','Breadbox','VegTray','FruitFrame','WaterStation','DronePost','Drone','IrrigationValve','WarmingShelf','BalanceBuffetShelf','Robot_Chassis','Robot_Arm'];
for(let i=0;i<4;i++) targetNames.push(`Table_${i}`,`TableFiducial_${i}`);
for(let i=0;i<3;i++) targetNames.push(`Plate_${i}`,`PlateStem_${i}`,`Dairy_${i}`,`Protein_${i}`,`Grain_${i}`);
for(let i=0;i<2;i++) targetNames.push(`Cup_${i}`); for(let i=0;i<6;i++) targetNames.push(`Veg_${i}`,`Fruit_${i}`); for(let i=0;i<8;i++) targetNames.push(`Water_${i}`);
const pos = o => { const v=new THREE.Vector3(); o.getWorldPosition(v); return v; };
const label = s => s[0].toUpperCase()+s.slice(1);
function resetState(){ state={score:0,time:120,ended:false,plate:null,cup:null,valve:false,drone:0,opened:{fridge:false,bread:false},taken:new Set(),tables:new Set(),bonuses:new Set(),breakdown:[]}; }
function addScore(points, why){ if(!points)return; state.score+=points; state.breakdown.push({points,why}); $('score').textContent=state.score; }
function hideObject(name){const o=named[name];if(o){o.visible=false; o.userData.hidden=true;}}
function setup(){
  scene.traverse(o=>{if(o.name) named[o.name]=o; if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  fieldStructure=named.FieldStructure;
  if(fieldStructure) fieldStructure.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  const missing=targetNames.filter(n=>!named[n]); if(missing.length) console.warn('Field objects not found:',missing.join(', '));
  robot=new THREE.Group(); scene.add(robot); const start=named.RSA_Tile;
  robot.position.copy(start ? pos(start) : new THREE.Vector3()); robot.position.y+=.12;
  // The arm is the front marker, so make local -Z (the driving direction) face it.
  const chassis=named.Robot_Chassis, arm=named.Robot_Arm;
  if(chassis&&arm){const front=pos(arm).sub(pos(chassis));front.y=0;if(front.lengthSq()>.0001)spawnRotation=Math.atan2(-front.x,-front.z);}
  else spawnRotation=Math.PI;
  robot.rotation.y=spawnRotation;
  robotVisual=named.Robot_Chassis;
  if(robotVisual){ robot.attach(robotVisual); if(arm && arm.parent!==robotVisual) robot.attach(arm); }
  else { const m=new THREE.Mesh(new THREE.BoxGeometry(.55,.2,.7),new THREE.MeshStandardMaterial({color:0xff4545}));robot.add(m); }
  buildCollisionMap();
  marker=new THREE.Mesh(new THREE.TorusGeometry(.35,.025,8,24),new THREE.MeshBasicMaterial({color:0x00eaff})); marker.rotation.x=Math.PI/2; marker.visible=false;scene.add(marker);
  resetState(); ready=true;
}
loader.load('./field.glb',g=>{scene.add(g.scene);setup()},undefined,e=>{ $('carry').textContent='Could not load field.glb — run a local web server.'; console.error(e); });

function mealType(){ if(!state.plate)return null; const a=state.plate.items, set=new Set(a), first=a[0], last=a.at(-1), non=new Set(a.filter(x=>x!=='grain'));
  if(first==='grain'&&last==='grain'&&non.size>=4)return 'sandwich';
  if(first==='grain'&&non.size>=3)return 'pizza';
  if(set.size>=2)return 'salad'; return null;
}
const mealBase={salad:10,pizza:30,sandwich:50};
function ingredientFor(name){if(/^Veg_/.test(name))return 'vegetable';if(/^Fruit_/.test(name))return 'fruit';if(/^Dairy_/.test(name))return 'dairy';if(/^Protein_/.test(name))return 'protein';if(/^Grain_/.test(name))return 'grain';if(/^Water_/.test(name))return 'water';return null;}
function objectCandidates(){ const out=[]; const add=(o,kind,text,fn)=>{if(o&&o.visible!==false)out.push({o,kind,text,fn,d:pos(o).distanceTo(robot.position)});};
  for(let i=0;i<3;i++) if(!state.taken.has(`Plate_${i}`)&&!state.plate)add(named[`Plate_${i}`],'pickup','Press E to pick up Plate',()=>{state.plate={items:[]};take(`Plate_${i}`)});
  for(let i=0;i<2;i++) if(!state.taken.has(`Cup_${i}`)&&!state.cup)add(named[`Cup_${i}`],'pickup','Press E to pick up Cup',()=>{state.cup={water:0};take(`Cup_${i}`)});
  if(!state.opened.fridge)add(named.Fridge,'station','Press E to open Fridge',()=>state.opened.fridge=true);
  if(!state.opened.bread)add(named.Breadbox,'station','Press E to open Breadbox',()=>state.opened.bread=true);
  if(!state.valve)add(named.IrrigationValve,'task','Press E to turn Irrigation Valve (+4)',()=>{state.valve=true;addScore(4,'Irrigation valve');});
  if(state.drone<2)add(named.DronePost,'task',`Press E to crank Drone (${state.drone}/2)`,()=>{if(++state.drone===2)addScore(8,'Drone activated');});
  Object.keys(named).forEach(n=>{const type=ingredientFor(n);if(!type||state.taken.has(n))return; const allowed= type==='water' ? state.cup&&state.valve : state.plate && (!['dairy','protein'].includes(type)||state.opened.fridge) && (type!=='grain'||state.opened.bread); if(allowed)add(named[n],'ingredient',`Press E to add ${label(type)}${type==='water'?' to cup':' to plate'}`,()=>{ if(type==='water')state.cup.water++;else state.plate.items.push(type);take(n);checkBonuses(); });});
  const type=mealType(), drink=state.cup?.water>0;
  const zoneDefs=[['QCA_Tile','QCA'],['WarmingShelf','Warming Shelf'],['BalanceBuffetShelf','Balance Buffet']];
  for(const [n,z] of zoneDefs) if(type||drink)add(named[n],'score',scorePrompt(type,drink,z),()=>scoreAt(type,drink,z));
  for(let i=0;i<4;i++)if(!state.tables.has(i)&&(type||drink))add(named[`Table_${i}`],'score',scorePrompt(type,drink,'Dining Table'),()=>{state.tables.add(i);scoreAt(type,drink,'Dining Table')});
  return out.filter(x=>x.d<1.35).sort((a,b)=>a.d-b.d);
}
function take(n){state.taken.add(n);hideObject(n);}
function checkBonuses(){const groups=[['Veg tray emptied',4,/^Veg_/],['Fruit frame emptied',4,/^Fruit_/],['Fridge emptied',8,/^(Dairy|Protein)_/],['Breadbox emptied',8,/^Grain_/]];for(const [why,p,re] of groups)if(!state.bonuses.has(why)){const all=Object.keys(named).filter(n=>re.test(n));if(all.length&&all.every(n=>state.taken.has(n))){state.bonuses.add(why);addScore(p,why);}}}
function scorePrompt(type,drink,zone){if(type)return `Press E to score ${label(type)}${drink?' + drink':''} on ${zone}`;return `Press E to score filled drink on ${zone}`;}
function scoreAt(type,drink,zone){let points=0;if(type){points=zone==='QCA'?{salad:5,pizza:15,sandwich:25}[type]:mealBase[type]+(zone==='Warming Shelf'?5:zone==='Balance Buffet'?15:zone==='Dining Table'?50:0);if(drink)points+=zone==='QCA'?6:12;addScore(points,`${label(type)}${drink?' + drink':''} — ${zone}`);state.plate=null;if(drink)state.cup=null;}else if(drink){points=zone==='QCA'?2:4;addScore(points,`Filled drink — ${zone}`);state.cup=null;}}
function endMatch(){if(state.ended)return;state.ended=true;const type=mealType(),drink=state.cup?.water>0;if(type){let p=mealBase[type]+(drink?12:0);addScore(p,`${label(type)}${drink?' + drink':''} — carried at match end`);}else if(drink)addScore(4,'Filled drink — carried at match end');$('finalScore').textContent=`${state.score} points`;$('breakdown').innerHTML=state.breakdown.map(x=>`<div>${x.why}<span style="float:right">+${x.points}</span></div>`).join('')||'<div>No points scored.</div>';$('results').classList.add('show');}
function buildCollisionMap(){
  const floor=named.Floor;if(!floor)return;
  const box=new THREE.Box3().setFromObject(floor); floorBounds={minX:box.min.x+.6,maxX:box.max.x-.6,minZ:box.min.z+.6,maxZ:box.max.z-.6};
  // Cache the coarse bounds once; interior wall collision is disabled for the MVP.
  if(fieldStructure)fieldBounds=new THREE.Box3().setFromObject(fieldStructure);
}

function moveRobot(distance){
  const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(up,robot.rotation.y), desired=robot.position.clone().addScaledVector(forward,distance);
  if(floorBounds){desired.x=THREE.MathUtils.clamp(desired.x,floorBounds.minX,floorBounds.maxX);desired.z=THREE.MathUtils.clamp(desired.z,floorBounds.minZ,floorBounds.maxZ);}
  robot.position.x=desired.x;
  robot.position.z=desired.z;
}
function restart(){
  if(!ready)return;
  state.taken.forEach(n=>{const o=named[n];if(o){o.visible=true;o.userData.hidden=false;}});
  resetState(); driveSpeed=0; keys={};
  const start=named.RSA_Tile;robot.position.copy(start?pos(start):new THREE.Vector3());robot.position.y+=.12;robot.rotation.y=spawnRotation;
  $('score').textContent='0';$('results').classList.remove('show');hud();
}
function hud(c){const total=Math.ceil(state.time);$('timer').textContent=`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`; const plate=state.plate?state.plate.items.map(label).join(' → ')||'empty':'none';const cup=state.cup?(state.cup.water?`filled (${state.cup.water})`:'empty'):'none';$('carry').innerHTML=`<b>PLATE:</b> ${plate}<br><b>CUP:</b> ${cup}<br><span class="muted">WASD / arrows drive · E interact · R restart</span>`;$('prompt').textContent=c?.text||'';marker.visible=!!c;if(c)marker.position.copy(pos(c.o)).add(new THREE.Vector3(0,.18,0));}
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;keys[e.code]=true;if(e.code==='KeyR')restart();if(e.code==='KeyE'&&ready&&!state.ended){const c=objectCandidates()[0];if(c)c.fn();}});
addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=false;});addEventListener('blur',()=>{keys={};driveSpeed=0;});$('again').onclick=restart;
function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);if(ready&&!state.ended){
  const turn=(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0);robot.rotation.y+=turn*3*dt;
  const input=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0), target=input>0?4.5:input<0?-3:0;
  driveSpeed=THREE.MathUtils.damp(driveSpeed,target,input?16:20,dt);if(Math.abs(driveSpeed)<.01)driveSpeed=0;moveRobot(driveSpeed*dt);
  state.time=Math.max(0,state.time-dt);const c=objectCandidates()[0];hud(c);if(state.time===0)endMatch();
}if(robot){const look=robot.position.clone().add(new THREE.Vector3(0,.35,0)), desired=robot.position.clone().add(cameraOffset.clone().applyAxisAngle(up,robot.rotation.y));
  camera.position.lerp(desired,1-Math.exp(-8*dt));camera.lookAt(look);
}renderer.render(scene,camera);} tick();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
