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
let floorBounds, fieldStructure, spawnRotation=0, driveSpeed=0;
const collisionBoxes=[], carriedVisuals=[];
// Circumscribed chassis radius keeps corners clear even while turning.
const ROBOT_RADIUS=.85;
let collisionStepLimit=.1;
const motionForward=new THREE.Vector3(), motionDesired=new THREE.Vector3(), animationTarget=new THREE.Vector3();
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
  for(const n of ['QCA_Tile','WarmingShelf','BalanceBuffetShelf','Table_0','Table_1','Table_2','Table_3']){
    if(named[n])named[n].userData.interactionBounds=new THREE.Box3().setFromObject(named[n]);
  }
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
function objectCandidates(){ const out=[]; const add=(o,kind,text,fn)=>{
    if(!o||o.visible===false)return;
    const p=pos(o), b=kind==='score'?o.userData.interactionBounds:null;
    // Reach elevated ingredients in X/Z; scoring uses the zone's surface edge.
    if(b){p.x=THREE.MathUtils.clamp(robot.position.x,b.min.x,b.max.x);p.z=THREE.MathUtils.clamp(robot.position.z,b.min.z,b.max.z);}
    out.push({o,kind,text,fn,d:Math.hypot(p.x-robot.position.x,p.z-robot.position.z)});
  };
  for(let i=0;i<3;i++) if(!state.taken.has(`Plate_${i}`)&&!state.plate)add(named[`Plate_${i}`],'pickup','Press E to pick up Plate',()=>{state.plate={items:[]};take(`Plate_${i}`)});
  for(let i=0;i<2;i++) if(!state.taken.has(`Cup_${i}`)&&!state.cup)add(named[`Cup_${i}`],'pickup','Press E to pick up Cup',()=>{state.cup={water:0};take(`Cup_${i}`)});
  if(!state.opened.fridge)add(named.Fridge,'station','Press E to open Fridge',()=>state.opened.fridge=true);
  if(!state.opened.bread)add(named.Breadbox,'station','Press E to open Breadbox',()=>state.opened.bread=true);
  if(!state.valve)add(named.IrrigationValve,'task','Press E to turn Irrigation Valve (+4)',()=>{state.valve=true;addScore(4,'Irrigation valve');});
  if(state.drone<2)add(named.DronePost,'task',`Press E to crank Drone (${state.drone}/2)`,()=>{if(++state.drone===2)addScore(8,'Drone activated');});
  Object.keys(named).forEach(n=>{const type=ingredientFor(n);if(!type||state.taken.has(n))return; const allowed= type==='water' ? state.cup&&state.valve : state.plate && (!['dairy','protein'].includes(type)||state.opened.fridge) && (type!=='grain'||state.opened.bread); if(allowed)add(named[n],'ingredient',`Press E to add ${label(type)}${type==='water'?' to cup':' to plate'}`,()=>{ if(type==='water')state.cup.water++;else state.plate.items.push(type);take(n);checkBonuses(); });});
  const type=mealType(), drink=state.cup?.water>0;
  const zoneDefs=[['QCA_Tile','QCA'],['WarmingShelf','Warming Shelf'],['BalanceBuffetShelf','Balance Buffet']];
  for(const [n,z] of zoneDefs) if(type||drink)add(named[n],'score',scorePrompt(type,drink,z),()=>scoreAt(type,drink,z,named[n]));
  for(let i=0;i<4;i++)if(!state.tables.has(i)&&(type||drink))add(named[`Table_${i}`],'score',scorePrompt(type,drink,'Dining Table'),()=>{state.tables.add(i);scoreAt(type,drink,'Dining Table',named[`Table_${i}`])});
  return out.filter(x=>x.d<1.35).sort((a,b)=>a.d-b.d);
}
// Shared, tiny meshes: allocations happen only on interactions, never inside the tween loop.
const pickupGeometry={plate:new THREE.CylinderGeometry(.36,.36,.055,24),cup:new THREE.CylinderGeometry(.14,.11,.3,16,1,true),food:new THREE.SphereGeometry(.12,12,8)};
const pickupMaterials={};
for(const [type,color] of Object.entries({plate:0xffffff,cup:0xffe5a6,vegetable:0x53b94a,fruit:0xf34d55,dairy:0xfff4ce,protein:0x9a543e,grain:0xe3aa4b,water:0x37baff}))pickupMaterials[type]=new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide});
function take(n){
  const type=ingredientFor(n)||(/^Plate_/.test(n)?'plate':'cup');
  const cup=type==='cup'||type==='water', index=cup?state.cup.water:state.plate.items.length;
  const mesh=new THREE.Mesh(pickupGeometry[type]||pickupGeometry.food,pickupMaterials[type]);
  scene.add(mesh);mesh.position.copy(pos(named[n]));
  const offset=new THREE.Vector3(cup ? .43 : 0,cup ? .83+Math.min(index,8)*.035:.72+index*.14,-.65);
  carriedVisuals.push({mesh,offset,start:mesh.position.clone(),age:0,delivery:false,cup});
  state.taken.add(n);hideObject(n);
  if(type==='plate')hideObject(n.replace('Plate_','PlateStem_'));
}
function animateDelivery(type,drink,destination){
  for(const v of carriedVisuals){
    if(v.delivery||(v.cup?!drink:!type))continue;
    v.delivery=true;v.age=0;v.start.copy(v.mesh.position);
    v.destination=destination?pos(destination):v.mesh.position.clone();v.destination.y+=.6;
  }
}
function updateAnimations(dt){
  for(let i=carriedVisuals.length-1;i>=0;i--){
    const v=carriedVisuals[i];v.age+=dt;
    const t=Math.min(v.age/(v.delivery ? .5 : .4),1), eased=1-(1-t)**3;
    if(v.delivery)animationTarget.copy(v.destination);
    else {animationTarget.copy(v.offset);robot.localToWorld(animationTarget);}
    v.mesh.position.lerpVectors(v.start,animationTarget,eased);
    v.mesh.position.y+=Math.sin(t*Math.PI)*.35;
    v.mesh.scale.setScalar(v.delivery?(1+.3*Math.sin(t*Math.PI))*(1-t):.25+.75*eased+.15*Math.sin(t*Math.PI));
    if(v.delivery&&t===1){scene.remove(v.mesh);carriedVisuals.splice(i,1);}
  }
}
function clearAnimations(){for(const v of carriedVisuals)scene.remove(v.mesh);carriedVisuals.length=0;}

function checkBonuses(){const groups=[['Veg tray emptied',4,/^Veg_/],['Fruit frame emptied',4,/^Fruit_/],['Fridge emptied',8,/^(Dairy|Protein)_/],['Breadbox emptied',8,/^Grain_/]];for(const [why,p,re] of groups)if(!state.bonuses.has(why)){const all=Object.keys(named).filter(n=>re.test(n));if(all.length&&all.every(n=>state.taken.has(n))){state.bonuses.add(why);addScore(p,why);}}}
function scorePrompt(type,drink,zone){if(type)return `Press E to score ${label(type)}${drink?' + drink':''} on ${zone}`;return `Press E to score filled drink on ${zone}`;}
function scoreAt(type,drink,zone,destination){animateDelivery(type,drink,destination);let points=0;if(type){points=zone==='QCA'?{salad:5,pizza:15,sandwich:25}[type]:mealBase[type]+(zone==='Warming Shelf'?5:zone==='Balance Buffet'?15:zone==='Dining Table'?50:0);if(drink)points+=zone==='QCA'?6:12;addScore(points,`${label(type)}${drink?' + drink':''} — ${zone}`);state.plate=null;if(drink)state.cup=null;}else if(drink){points=zone==='QCA'?2:4;addScore(points,`Filled drink — ${zone}`);state.cup=null;}}
function endMatch(){if(state.ended)return;state.ended=true;const type=mealType(),drink=state.cup?.water>0;if(type||drink)animateDelivery(type,drink);if(type){let p=mealBase[type]+(drink?12:0);addScore(p,`${label(type)}${drink?' + drink':''} — carried at match end`);}else if(drink)addScore(4,'Filled drink — carried at match end');$('finalScore').textContent=`${state.score} points`;$('breakdown').innerHTML=state.breakdown.map(x=>`<div>${x.why}<span style="float:right">+${x.points}</span></div>`).join('')||'<div>No points scored.</div>';$('results').classList.add('show');lbOpen();}
function buildCollisionMap(){
  const floor=named.Floor;if(!floor)return;
  const box=new THREE.Box3().setFromObject(floor); floorBounds={minX:box.min.x+.6,maxX:box.max.x-.6,minZ:box.min.z+.6,maxZ:box.max.z-.6};
  // FieldStructure-local X/Z bounds, not its all-enclosing bounds.
  // The first four segments were measured from field.glb CAD geometry.
  // Two dining/garden dividers; the gap at X=3.5..5.5 is the doorway.
  // Two closing walls are separate primitives in FieldStructure.
  const segments=[[-.271,3.5,5.5,5.803],[5.5,5.803,0,5.803],
    [-1.375,-1.225,-1.31,11.79],[-1.31,11.79,-1.375,-1.225],
    // Panel identified by a live click + connected-triangle flood-fill.
    [-0.031,0.031,6.344,9.010],
    // The model only has closing walls on the -X and -Z sides; mirror them onto
    // the open +X / +Z edges (just outside the wood floor) so the robot cannot drive off the field.
    [11.81,11.96,-1.31,11.96],[-1.31,11.96,11.81,11.96]];
  collisionBoxes.length=0;
  collisionStepLimit=.1;
  if(fieldStructure){
    fieldStructure.updateWorldMatrix(true,false);
    for(const [minX,maxX,minZ,maxZ] of segments){
      const wall=new THREE.Box3(new THREE.Vector3(minX,0,minZ),new THREE.Vector3(maxX,1.5,maxZ)).applyMatrix4(fieldStructure.matrixWorld);
      // Use unpadded world-space thickness, including any field scaling.
      const thickness=Math.min(wall.max.x-wall.min.x,wall.max.z-wall.min.z);
      if(thickness>0)collisionStepLimit=Math.min(collisionStepLimit,thickness/2);
      collisionBoxes.push(wall);
    }
  }
}
function blocked(x,z){
  for(const o of others){const d=Math.hypot(x-o.position.x,z-o.position.z);if(d<1.1&&d<Math.hypot(robot.position.x-o.position.x,robot.position.z-o.position.z))return true;}
  for(const b of collisionBoxes)if(x>=b.min.x-ROBOT_RADIUS&&x<=b.max.x+ROBOT_RADIUS&&z>=b.min.z-ROBOT_RADIUS&&z<=b.max.z+ROBOT_RADIUS)return true;
  return false;
}
function moveRobot(distance){
  motionForward.set(0,0,-1).applyAxisAngle(up,robot.rotation.y);
  // Each axis advances at most half the thinnest wall per substep, so even
  // a large frame displacement cannot jump across a padded collision box.
  const steps=Math.max(1,Math.ceil(Math.abs(distance)/collisionStepLimit));
  for(let i=0;i<steps;i++){
    motionDesired.copy(robot.position).addScaledVector(motionForward,distance/steps);
    if(floorBounds){
      // Floor is a single rectangular plane; retain the original .6 clamp plus
      // .25 corner clearance so the rotated chassis cannot overhang its edge.
      motionDesired.x=THREE.MathUtils.clamp(motionDesired.x,floorBounds.minX+.25,floorBounds.maxX-.25);
      motionDesired.z=THREE.MathUtils.clamp(motionDesired.z,floorBounds.minZ+.25,floorBounds.maxZ-.25);
    }
    // Resolve X then Z at each substep; Z uses the accepted X to slide safely.
    if(!blocked(motionDesired.x,robot.position.z))robot.position.x=motionDesired.x;
    if(!blocked(robot.position.x,motionDesired.z))robot.position.z=motionDesired.z;
  }
}
const others=[]; let mp=null, busy=false;
const CLAIM=/^(Plate|Cup|Veg|Fruit|Dairy|Protein|Grain|Water|Table)_\d+$/;
// Shared items (pickups, ingredients, dining tables) need the server's OK first: first claim wins.
async function act(c){if(busy)return;if(!mp||!CLAIM.test(c.o.name)){c.fn();return;}busy=true;try{if(await mp.claim(c.o.name)&&!state.ended)c.fn();}finally{busy=false;}}
function restart(){if(mp){if(state.ended)mp.send({t:'reset'});}else doRestart();}
function doRestart(){
  if(!ready)return;
  state.taken.forEach(n=>{const o=named[n];if(o){o.visible=true;o.userData.hidden=false;}});
  for(let i=0;i<3;i++){const stem=named[`PlateStem_${i}`];if(stem){stem.visible=true;stem.userData.hidden=false;}}
  clearAnimations();resetState(); driveSpeed=0; keys={};
  const start=named.RSA_Tile;robot.position.copy(start?pos(start):new THREE.Vector3());robot.position.y+=.12;robot.rotation.y=spawnRotation;
  $('score').textContent='0';$('results').classList.remove('show');hud();
}
function hud(c){const total=Math.ceil(state.time);$('timer').textContent=`${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`; const plate=state.plate?state.plate.items.map(label).join(' → ')||'empty':'none';const cup=state.cup?(state.cup.water?`filled (${state.cup.water})`:'empty'):'none';$('carry').innerHTML=`<b>PLATE:</b> ${plate}<br><b>CUP:</b> ${cup}<br><span class="muted">WASD / arrows drive · E interact · R restart</span>`;$('prompt').textContent=c?.text||'';marker.visible=!!c;if(c)marker.position.copy(pos(c.o)).add(new THREE.Vector3(0,.18,0));}
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;keys[e.code]=true;if(e.code==='KeyR')restart();if(e.code==='KeyE'&&ready&&!state.ended){const c=objectCandidates()[0];if(c)act(c);}});
addEventListener('keyup',e=>{if(e.target.tagName==='INPUT')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=false;});addEventListener('blur',()=>{keys={};driveSpeed=0;});$('again').onclick=restart;
let minimapCtx;

function drawMinimap() {
  if (!minimapCtx) {
    const canvas = document.createElement('canvas');
    canvas.id = 'minimap';
    canvas.width = 180;
    canvas.height = 180;
    canvas.style.position = 'fixed';
    canvas.style.right = '14px';
    canvas.style.top = '50%';
    canvas.style.transform = 'translateY(-50%)';
    canvas.style.border = '2px solid #5bc4dc99';
    canvas.style.borderRadius = '10px';
    canvas.style.background = '#07111bd9';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    minimapCtx = canvas.getContext('2d');
  }

  if (!floorBounds) return;

  const margin = 8;
  const canvasWidth = minimapCtx.canvas.width;
  const canvasHeight = minimapCtx.canvas.height;
  
  // Calculate world bounds with 1 unit padding
  const paddedMinX = floorBounds.minX - 1;
  const paddedMaxX = floorBounds.maxX + 1;
  const paddedMinZ = floorBounds.minZ - 1;
  const paddedMaxZ = floorBounds.maxZ + 1;
  
  // Calculate scale and offset to fit the world in canvas with margin
  const worldWidth = paddedMaxX - paddedMinX;
  const worldHeight = paddedMaxZ - paddedMinZ;
  const scale = Math.min(
    (canvasWidth - 2 * margin) / worldWidth,
    (canvasHeight - 2 * margin) / worldHeight
  );
  
  const offsetX = margin - paddedMinX * scale;
  const offsetY = margin - paddedMinZ * scale;

  // Clear canvas
  minimapCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Fill floor rectangle
  minimapCtx.fillStyle = '#1d3a2a';
  minimapCtx.fillRect(
    offsetX,
    offsetY,
    worldWidth * scale,
    worldHeight * scale
  );

  // Draw collision boxes
  minimapCtx.fillStyle = '#d0d8e0';
  for (const box of collisionBoxes) {
    const x = box.min.x * scale + offsetX;
    const z = box.min.z * scale + offsetY;
    const width = (box.max.x - box.min.x) * scale;
    const height = (box.max.z - box.min.z) * scale;
    minimapCtx.fillRect(x, z, width, height);
  }

  // Draw others
  minimapCtx.fillStyle = 'orange';
  for (const obj of others) {
    const x = obj.position.x * scale + offsetX;
    const z = obj.position.z * scale + offsetY;
    minimapCtx.beginPath();
    minimapCtx.arc(x, z, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  // Draw robot
  minimapCtx.fillStyle = 'cyan';
  const robotX = robot.position.x * scale + offsetX;
  const robotZ = robot.position.z * scale + offsetY;
  const directionX = -Math.sin(robot.rotation.y);
  const directionZ = -Math.cos(robot.rotation.y);
  
  // Create triangle pointing in robot's facing direction
  const length = 8;
  const tipX = robotX + directionX * length;
  const tipZ = robotZ + directionZ * length;
  const angle = Math.atan2(directionZ, directionX);
  const leftX = robotX + Math.cos(angle + Math.PI/2) * length/2;
  const leftZ = robotZ + Math.sin(angle + Math.PI/2) * length/2;
  const rightX = robotX + Math.cos(angle - Math.PI/2) * length/2;
  const rightZ = robotZ + Math.sin(angle - Math.PI/2) * length/2;
  
  minimapCtx.beginPath();
  minimapCtx.moveTo(tipX, tipZ);
  minimapCtx.lineTo(leftX, leftZ);
  minimapCtx.lineTo(rightX, rightZ);
  minimapCtx.closePath();
  minimapCtx.fill();

  // Show/hide canvas based on state
  if (state && state.ended) {
    minimapCtx.canvas.style.display = 'none';
  } else {
    minimapCtx.canvas.style.display = 'block';
  }
}
function tick(){requestAnimationFrame(tick);if(ready)drawMinimap();const dt=Math.min(clock.getDelta(),.05);if(ready&&!state.ended){
  const turn=(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0);robot.rotation.y+=turn*3*dt;
  const input=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0), target=input>0?4.5:input<0?-3:0;
  driveSpeed=THREE.MathUtils.damp(driveSpeed,target,input?16:20,dt);if(Math.abs(driveSpeed)<.01)driveSpeed=0;moveRobot(driveSpeed*dt);
  state.time=Math.max(0,state.time-dt);const c=objectCandidates()[0];hud(c);if(state.time===0)endMatch();
}if(robot){
  updateAnimations(dt);const look=robot.position.clone().add(new THREE.Vector3(0,.35,0)), desired=robot.position.clone().add(cameraOffset.clone().applyAxisAngle(up,robot.rotation.y));
  camera.position.lerp(desired,1-Math.exp(-8*dt));camera.lookAt(look);
}renderer.render(scene,camera);} tick();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// VEX controller bridge: maps live joystick/button state (from controller_bridge.py)
// onto the same `keys` object used by keyboard input, so all existing driving/
// interact/restart logic is reused as-is.
(function(){
  const DEADZONE=20;
  let prevA=0, prevB=0;
  function connect(){
    const ws=new WebSocket('ws://localhost:8765');
    ws.onmessage=e=>{
      const s=JSON.parse(e.data);
      if(s.ly>DEADZONE){keys.KeyW=true;keys.KeyS=false;}
      else if(s.ly<-DEADZONE){keys.KeyS=true;keys.KeyW=false;}
      else{keys.KeyW=false;keys.KeyS=false;}
      if(s.rx>DEADZONE){keys.KeyD=true;keys.KeyA=false;}
      else if(s.rx<-DEADZONE){keys.KeyA=true;keys.KeyD=false;}
      else{keys.KeyA=false;keys.KeyD=false;}
      if(s.a&&!prevA&&ready&&!state.ended){const c=objectCandidates()[0];if(c)act(c);}
      if(s.b&&!prevB)restart();
      prevA=s.a;prevB=s.b;
    };
    ws.onclose=()=>setTimeout(connect,2000);
    ws.onerror=()=>ws.close();
  }
  connect();
})();

// Leaderboard on Supabase (REST). Score is client-reported, so it is honor-system.
const sb=(p,o={})=>fetch(SUPABASE_URL+'/rest/v1/'+p,{...o,headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'}});
async function lbLoad(){try{const rows=await(await sb('leaderboard?select=name,score&order=score.desc&limit=20')).json();$('lb').innerHTML=rows.map(x=>`<li>${x.name.replace(/[<&]/g,'')}<span style="float:right">${x.score}</span></li>`).join('')||'<li>No scores yet</li>';}catch{$('lb').innerHTML='<li>Leaderboard offline</li>';}}
function lbOpen(){try{$('uname').value=localStorage.getItem('uname')||'';}catch{}$('lbmsg').textContent='';$('post').disabled=false;lbLoad();}
$('post').onclick=async()=>{const name=$('uname').value.trim();if(!name){$('lbmsg').textContent='Enter a username';return;}try{localStorage.setItem('uname',name);}catch{}$('post').disabled=true;try{const r=await sb('scores',{method:'POST',body:JSON.stringify({name,score:state.score})});$('lbmsg').textContent=r.ok?'Submitted!':'Rejected (bad name or score)';if(!r.ok)$('post').disabled=false;}catch{$('lbmsg').textContent='Could not reach leaderboard';$('post').disabled=false;}lbLoad();};

// Multiplayer client: WebSocket to server/server.mjs (?room=NAME, ?ws=ws://host:port to override).
// Falls back to solo play if the server is unreachable.
(function(){
  const room=new URLSearchParams(location.search).get('room')||'lobby';
  const url=new URLSearchParams(location.search).get('ws')||`ws://${location.hostname}:8080`;
  const peers=new Map(), pending=new Map(), esc=s=>String(s).replace(/[<&]/g,'');
  const name=()=>{try{return(localStorage.getItem('uname')||'').slice(0,16)||'Player';}catch{return'Player';}};
  const list=document.createElement('div');list.className='card';list.style.cssText='position:absolute;top:18px;right:18px;min-width:150px;display:none';$('hud').append(list);
  const applyTaken=n=>{if(!ready)return;if(n.startsWith('Table_'))state.tables.add(+n.slice(6));else{state.taken.add(n);hideObject(n);if(n.startsWith('Plate_'))hideObject(n.replace('Plate_','PlateStem_'));}};
  const drop=k=>{const o=peers.get(k);if(o){scene.remove(o.mesh);others.splice(others.indexOf(o.mesh),1);peers.delete(k);}};
  const ws=new WebSocket(`${url}/?room=${encodeURIComponent(room)}`);
  ws.onopen=()=>{mp={send:o=>ws.readyState===1&&ws.send(JSON.stringify(o)),
    claim:n=>new Promise(r=>{pending.set(n,r);mp.send({t:'claim',n});setTimeout(()=>pending.delete(n)&&r(false),1500);})};list.style.display='';};
  ws.onclose=()=>{mp=null;list.style.display='none';[...peers.keys()].forEach(drop);for(const r of pending.values())r(false);pending.clear();};
  ws.onmessage=async e=>{const m=JSON.parse(e.data);
    if(m.t==='init'){while(!ready)await new Promise(r=>setTimeout(r,100));m.claims.forEach(applyTaken);state.time=Math.max(0,120-m.elapsed);}
    else if(m.t==='p'){let o=peers.get(m.id);
      if(!o){const hue=[...m.id].reduce((a,c)=>a+c.charCodeAt(0)*37,0)%360,mesh=new THREE.Mesh(new THREE.BoxGeometry(.55,.2,.7),new THREE.MeshStandardMaterial({color:new THREE.Color(`hsl(${hue},80%,55%)`)}));
        mesh.position.set(m.x,robot.position.y,m.z);scene.add(mesh);others.push(mesh);o={mesh,hue};peers.set(m.id,o);}
      Object.assign(o,{x:m.x,z:m.z,ry:m.ry,name:m.name,score:m.score,seen:performance.now()});}
    else if(m.t==='left')drop(m.id);
    else if(m.t==='taken')applyTaken(m.n);
    else if(m.t==='start')doRestart();
    else if(m.t==='ok'||m.t==='no'){const r=pending.get(m.n);pending.delete(m.n);r?.(m.t==='ok');}};
  setInterval(()=>{if(ready&&mp)mp.send({t:'p',name:name(),x:robot.position.x,z:robot.position.z,ry:robot.rotation.y,score:state.score});},100);
  (function loop(){requestAnimationFrame(loop);if(!mp)return;const now=performance.now();
    for(const[k,o]of[...peers]){if(now-o.seen>3000){drop(k);continue;}
      o.mesh.position.x+=(o.x-o.mesh.position.x)*.25;o.mesh.position.z+=(o.z-o.mesh.position.z)*.25;o.mesh.position.y=robot.position.y;o.mesh.rotation.y=o.ry;}
    const rows=[{n:name()+' (you)',s:state?.score??0,c:'#7ae6ff'},...[...peers.values()].map(o=>({n:o.name,s:o.score,c:`hsl(${o.hue},80%,65%)`}))].sort((a,b)=>b.s-a.s);
    list.innerHTML=`<span class="muted">ROOM ${esc(room)}</span>`+rows.map(r=>`<div style="color:${r.c}">${esc(r.n)}<span style="float:right">${r.s}</span></div>`).join('');})();
})();
