
const $=s=>document.querySelector(s), rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
const QS=new URLSearchParams(location.search);
const col=h=>new THREE.Color(h).convertSRGBToLinear();
gsap.registerPlugin(ScrollTrigger);

/* ---------- tunables ---------- */
const EYE=[.1,.86,QS.get('seat')==='right'?.36:-.36]; // driver eye point in car space (x fwd, y up, z right). ?seat=right flips it
const PAINTS={ // yellow = the model's own materials/textures (your graffiti stays); the others override the paint material
 '#ffc400':{n:'Sun Yellow · Original livery',orig:1},
 '#4aa3ff':{n:'Night Blue · Metallic',c:'#1456c8',m:.9,r:.32,cc:1,ccr:.06},
 '#e10600':{n:'Signal Red · Candy Pearl',c:'#c40a0a',m:.55,r:.2,cc:1,ccr:.02},
 '#e9e9e4':{n:'Ghost White · Satin',c:'#e9e9e4',m:.05,r:.55,cc:.25,ccr:.35}
};

/* ---------- audio: everything is synthesised with WebAudio, no files needed ---------- */
const AU={ctx:null,on:true,mode:'calm'};
const NF=m=>440*Math.pow(2,(m-69)/12);
const SCH={calm:{n:0,t:0,dur:.25},sport:{n:0,t:0,dur:60/128/4}};
const CH=[[57,60,64,67,71],[53,57,60,64,67],[48,52,55,59,64],[55,59,62,66,69]]; // Am9, Fmaj7, Cmaj7, Gmaj9
const BASS=[33,29,36,31];                                                       // A1 F1 C2 G1

function tone(bus,f,t,d,type,v,a,lpf){
  const c=AU.ctx,o=c.createOscillator(),g=c.createGain(),l=c.createBiquadFilter();
  o.type=type;o.frequency.value=f;l.type='lowpass';l.frequency.value=lpf||4000;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(l);l.connect(g);g.connect(bus);o.start(t);o.stop(t+d+.05);
}
function noise(bus,t,d,type,f,v,to){
  const c=AU.ctx,s=c.createBufferSource(),g=c.createGain(),b=c.createBiquadFilter();
  s.buffer=AU.nb;s.loop=true;b.type=type;b.frequency.setValueAtTime(f,t);
  if(to)b.frequency.exponentialRampToValueAtTime(to,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(.03,d/4));g.gain.exponentialRampToValueAtTime(.0001,t+d);
  s.connect(b);b.connect(g);g.connect(bus);s.start(t,Math.random());s.stop(t+d+.05);
}
function kick(t,v){
  const c=AU.ctx,o=c.createOscillator(),g=c.createGain();
  o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.34);
  o.connect(g);g.connect(AU.sport);o.start(t);o.stop(t+.36);
}
function schedCalm(t,n){
  if(n%32===0){ // a new chord every 8 seconds, soft swell
    const ch=CH[(n/32)%4];
    ch.forEach((m,i)=>tone(AU.calm,NF(m),t+i*.08,10,'triangle',.05,2.5,1400));
    tone(AU.calm,NF(ch[0]-12),t,10,'sine',.09,2,500);
  }
  if(n%4===2&&Math.random()<.28){ // sparse bell notes
    const P=[69,72,74,76,79,81];
    tone(AU.calm,NF(P[Math.random()*P.length|0]),t,3.2,'sine',.045,.01,3000);
  }
}
function schedSport(t,n){
  const st=n%16,bi=(n/16|0)%4,r=BASS[bi];
  if(st%4===0)kick(t,.9);
  if(st===4||st===12)noise(AU.sport,t,.18,'bandpass',1800,.35);
  if(st%4===2)noise(AU.sport,t,.05,'highpass',7000,.18);
  else if(st%2===1)noise(AU.sport,t,.03,'highpass',8000,.06);
  if(st%4===2||st===7||st===15)tone(AU.sport,NF(r+(st===15?12:0)),t,.2,'sawtooth',.22,.005,650);
  if(n%2===0){ // square-wave arpeggio over the bass root
    const sc=[0,3,7,10,12,15,12,7];
    tone(AU.sport,NF(r+36+sc[(n/2|0)%8]),t,.16,'square',.04,.005,2600);
  }
}
function initAudio(){
  if(AU.ctx)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const c=AU.ctx=new AC(),mk=v=>{const g=c.createGain();g.gain.value=v;return g};
  AU.master=mk(AU.on?1:0);const cp=c.createDynamicsCompressor();AU.master.connect(cp);cp.connect(c.destination);
  const mus=mk(.45);mus.connect(AU.master);
  AU.calm=mk(AU.mode==='calm'?1:0);AU.sport=mk(AU.mode==='sport'?1:0);AU.calm.connect(mus);AU.sport.connect(mus);
  AU.sfx=mk(.8);AU.sfx.connect(AU.master);
  AU.eng=mk(0);AU.eng.connect(AU.master);
  const nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=nb.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.nb=nb;
  /* engine: stacked saw / square / triangle through a lowpass whose cutoff follows speed */
  AU.lp=c.createBiquadFilter();AU.lp.type='lowpass';AU.lp.frequency.value=800;AU.lp.Q.value=2;AU.lp.connect(AU.eng);
  const eo=(type,v)=>{const o=c.createOscillator(),g=mk(v);o.type=type;o.frequency.value=42;o.connect(g);g.connect(AU.lp);o.start();return o};
  AU.eo=[eo('sawtooth',.5),eo('sawtooth',.4),eo('square',.35),eo('triangle',.2)];AU.eo[1].detune.value=14;
  setInterval(()=>{
    if(AU.ctx.state!=='running')return;
    const m=AU.mode,Q=SCH[m],now=AU.ctx.currentTime;
    if(Q.t<now)Q.t=now+.05;
    while(Q.t<now+.25){(m==='calm'?schedCalm:schedSport)(Q.t,Q.n);Q.t+=Q.dur;Q.n++}
  },60);
  c.resume();
}
function setMusic(m){
  AU.mode=m;SCH[m].n=0;SCH[m].t=0;if(!AU.ctx)return;
  const t=AU.ctx.currentTime;
  AU.calm.gain.setTargetAtTime(m==='calm'?1:0,t,m==='calm'?1.5:.6);
  AU.sport.gain.setTargetAtTime(m==='sport'?1:0,t,m==='sport'?.4:.8);
}
function engineUpdate(spd,cb){
  if(!AU.ctx)return;
  const t=AU.ctx.currentTime,g=Math.min(4,Math.floor(spd/62)),fr=Math.min(1,(spd-g*62)/62),f=42+fr*95+g*8; // gears: pitch climbs, drops on each shift
  AU.eo[0].frequency.setTargetAtTime(f,t,.05);AU.eo[1].frequency.setTargetAtTime(f*1.003,t,.05);
  AU.eo[2].frequency.setTargetAtTime(f/2,t,.05);AU.eo[3].frequency.setTargetAtTime(f*3,t,.05);
  AU.lp.frequency.setTargetAtTime((500+spd*7+fr*400)*(1-cb*.45),t,.08);
  AU.eng.gain.setTargetAtTime((.03+Math.min(1,spd/220)*.14)*(1+cb*.4),t,.1);
}
const SFX={
  click(f){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,f||900,t,.12,'sine',.25,.003,5000);tone(AU.sfx,(f||900)*1.5,t+.05,.14,'sine',.15,.003,5000)},
  whoosh(d,lo,hi,v){if(!AU.ctx)return;noise(AU.sfx,AU.ctx.currentTime,d||.9,'bandpass',lo||300,v||.5,hi||3000)},
  thunk(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,70,t,.35,'sine',.6,.005,400);noise(AU.sfx,t,.2,'lowpass',500,.4)},
  ping(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,1318,t,.5,'sine',.18,.005,6000);tone(AU.sfx,1760,t+.08,.6,'sine',.12,.005,6000)},
  launch(){if(!AU.ctx)return;const t=AU.ctx.currentTime;noise(AU.sfx,t,1.8,'bandpass',250,.7,5000);noise(AU.sfx,t+.3,1.2,'highpass',2500,.22);tone(AU.sfx,70,t,1.2,'sawtooth',.3,.05,500)}
};
const snd=$('#snd');
function setSnd(){snd.dataset.on=String(!!AU.ctx&&AU.on);$('#snd span').textContent=!AU.ctx?'Sound · tap to enable':AU.on?'Sound on':'Sound off'}
snd.onclick=()=>{
  if(!AU.ctx){AU.on=true;initAudio()}
  else{AU.on=!AU.on;AU.master.gain.setTargetAtTime(AU.on?1:0,AU.ctx.currentTime,.1);AU.ctx.resume()}
  setSnd();
};
['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,e=>{ // browsers only allow audio after a gesture
  if(!AU.ctx&&!(e.target.closest&&e.target.closest('#snd'))){initAudio();setSnd()}
},{passive:true}));

/* ---------- intro overlay: crest fades in, then shutters open ---------- */
let logoDone=false,loaded=false,shown=0;
gsap.timeline({onComplete:()=>{logoDone=true;openSite()}})
  .from('#crest',{opacity:0,scale:.8,y:14,duration:1.3,ease:'power3.out'})
  .from('#pw',{opacity:0,letterSpacing:'1.6em',duration:1,ease:'power3.out'},'-=.7')
  .to({},{duration:.5});
function openSite(){
  if(!(logoDone&&loaded))return;
  SFX.whoosh(1.4,150,4000,.4);
  gsap.timeline({onComplete:()=>$('#pre').remove()})
    .to('#pc',{scale:1.18,opacity:0,duration:.6,ease:'power2.in'})
    .to('.shut.t',{yPercent:-100,duration:1.1,ease:'power4.inOut'},.35)
    .to('.shut.b',{yPercent:100,duration:1.1,ease:'power4.inOut'},.35);
  gsap.delayedCall(.7,()=>intro.play());
}

/* ---------- renderer / scene ---------- */
const R=new THREE.WebGLRenderer({canvas:$('#gl'),antialias:true,alpha:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));
R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.15;
const S=new THREE.Scene(), C=new THREE.PerspectiveCamera(32,1,.05,100);

/* studio environment for reflections */
const pm=new THREE.PMREMGenerator(R), es=new THREE.Scene();
es.add(new THREE.Mesh(new THREE.BoxGeometry(40,40,40),new THREE.MeshBasicMaterial({color:0x0a0a0c,side:THREE.BackSide})));
[[0,14,0,20,.2,6,9,0xffffff],[-14,5,0,.2,6,16,4,0xffffff],[14,4,5,.2,5,12,5,0xffffff],[0,3,-15,18,4,.2,3,0xffd24a]].forEach(([x,y,z,w,h,d,i,c])=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i)}));
  m.position.set(x,y,z);es.add(m);
});
S.environment=pm.fromScene(es,.03).texture;
const key=new THREE.DirectionalLight(0xffffff,.9);key.position.set(4,7,5);S.add(key);
const rim=new THREE.PointLight(0xffc400,2.2,20);rim.position.set(-5,2.5,-4);S.add(rim);

const car=new THREE.Group();S.add(car);
const wheels=[],parts=[],pmap=new Map();
let paintMat=null,paintOrig=null;

/* shadow + ring */
const sc=document.createElement('canvas');sc.width=sc.height=128;
const sg=sc.getContext('2d'),gr=sg.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.85)');gr.addColorStop(1,'rgba(0,0,0,0)');sg.fillStyle=gr;sg.fillRect(0,0,128,128);
const sh=new THREE.Mesh(new THREE.PlaneGeometry(7.5,3.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));
sh.rotation.x=-Math.PI/2;sh.position.y=.01;car.add(sh);
const ring=new THREE.Mesh(new THREE.RingGeometry(3.5,3.52,128),new THREE.MeshBasicMaterial({color:0xffc400,transparent:true,opacity:.45,side:THREE.DoubleSide}));
ring.rotation.x=-Math.PI/2;ring.position.y=.005;S.add(ring);

/* ---------- materials ---------- */
const up=(m,k)=>new THREE.MeshPhysicalMaterial(Object.assign({name:m.name,color:m.color.clone(),map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,aoMap:m.aoMap,emissive:m.emissive,emissiveMap:m.emissiveMap,side:m.side,transparent:m.transparent,opacity:m.opacity,roughness:m.roughness,metalness:m.metalness},k));
const SKIP=/glass|window|tyre|tire|rubber|light|lamp|carbon|brake|disc|interior|seat|logo|chrome|mirror|rim|wheel|plastic|grill|decal/i, PAINT=/paint|body|livery|colou?r|exterior|shell|main/i;
function setupMaterials(m){
  const area=new Map(),cache=new Map();
  m.traverse(o=>{if(!o.isMesh)return;const z=new THREE.Box3().setFromObject(o).getSize(V());
    [].concat(o.material).forEach(x=>area.set(x,(area.get(x)||0)+z.x*z.y+z.y*z.z+z.x*z.z))});
  const all=[...area.keys()];console.log('materials in model (use ?paint=Name to force the paint one):',all.map(x=>x.name));
  const cands=all.filter(x=>!SKIP.test(x.name)),want=QS.get('paint');
  let pool=want?cands.filter(x=>x.name===want):[];if(!pool.length)pool=cands.filter(x=>PAINT.test(x.name));
  const old=(pool.length?pool:cands).sort((a,b)=>area.get(b)-area.get(a))[0];
  const mat=x=>{
    if(cache.has(x))return cache.get(x);let y=x;const n=x.name;
    if(x===old){ // keeps its original texture (graffiti / livery) until another colour is picked
      y=up(x,{});paintMat=y;
      paintOrig={color:y.color.clone(),map:y.map,rm:y.roughnessMap,mm:y.metalnessMap,m:y.metalness,r:y.roughness};
    }
    else if(/glass|window|windshield/i.test(n))y=up(x,{map:null,color:col('#06090d'),transparent:true,opacity:.3,roughness:.04,metalness:0,depthWrite:false});
    else if(/tyre|tire|rubber/i.test(n)){x.roughness=.9;x.metalness=0}
    else if(/rim|alloy|chrome|caliper|disc|brake/i.test(n)){x.metalness=1;x.roughness=Math.min(x.roughness,.3)}
    else if(/carbon/i.test(n))y=up(x,{clearcoat:1,clearcoatRoughness:.08});
    y.envMapIntensity=1.3;cache.set(x,y);return y};
  m.traverse(o=>{if(!o.isMesh)return;
    o.material=Array.isArray(o.material)?o.material.map(mat):mat(o.material);
    if(o.material.map)o.material.map.anisotropy=8});
}
function applyPaint(k,now){
  const p=PAINTS[k];if(!p)return;$('#fin').textContent=p.n;if(!paintMat)return;
  const d=now?0:.9,M=paintMat,o=paintOrig;
  gsap.killTweensOf(M.color);gsap.killTweensOf(M);
  if(p.orig){ // default yellow: put back the model's own materials and textures, nothing overridden
    M.map=o.map;M.roughnessMap=o.rm;M.metalnessMap=o.mm;M.needsUpdate=true;
    gsap.to(M.color,{r:o.color.r,g:o.color.g,b:o.color.b,duration:d});
    gsap.to(M,{metalness:o.m,roughness:o.r,clearcoat:0,clearcoatRoughness:0,duration:d});
    return;
  }
  if(M.map||M.roughnessMap||M.metalnessMap){M.map=M.roughnessMap=M.metalnessMap=null;M.needsUpdate=true}
  const c=col(p.c);
  gsap.to(M.color,{r:c.r,g:c.g,b:c.b,duration:d});
  gsap.to(M,{metalness:p.m,roughness:p.r,clearcoat:p.cc,clearcoatRoughness:p.ccr,duration:d});
}

/* ---------- exploded view: every mesh flies out along its own vector, staggered rear → front ---------- */
function buildParts(m){
  const bb=new THREE.Box3().setFromObject(holder),ct=bb.getCenter(V()),sz=bb.getSize(V()),md=sz.length()/2;
  m.traverse(o=>{if(!o.isMesh)return;
    const c=new THREE.Box3().setFromObject(o).getCenter(V()),d=c.clone().sub(ct),len=d.length(),i=parts.length;
    d.y+=.3;d.normalize().multiplyScalar((.5+2.2*Math.min(1,len/md))*(.85+.3*Math.abs(Math.sin(i*12.9898))));
    const tg=o.parent.worldToLocal(o.getWorldPosition(V()).add(d));
    /* so = the extra offset used when this part is clicked and pulled out of the car */
    const so=o.parent.worldToLocal(o.getWorldPosition(V()).add(d.clone().normalize().multiplyScalar(1.9))).sub(o.position),
          dm=new THREE.Box3().setFromObject(o).getSize(V());
    const p={o,base:o.position.clone(),off:tg.sub(o.position),so,sv:0,dm,del:(c.x-bb.min.x)/sz.x*.45};
    parts.push(p);pmap.set(o,p);
  });
  wheels.forEach(w=>{
    const z=Math.sign(w.position.z||1),p={o:w,base:w.position.clone(),off:V().set(w.position.x*.3,.3,z*1.9),so:V().set(0,.15,z*2.3),sv:0,dm:new THREE.Box3().setFromObject(w).getSize(V()),del:.2,wheel:1};
    parts.push(p);pmap.set(w,p);
  });
  console.log('explodable parts:',parts.length);
}
let lastEx=-1,dirty=false;
function applyEx(){
  const e=X.v;if(e===lastEx&&!dirty)return;lastEx=e;dirty=false;
  parts.forEach(p=>{let u=Math.min(1,Math.max(0,e*1.45-p.del));u=u*u*(3-2*u);p.o.position.copy(p.base).addScaledVector(p.off,u).addScaledVector(p.so,p.sv)});
}

/* ---------- GLB car ---------- */
let ready=false,target=0;
const FILE=QS.get('model')||'2024_porsche_992_gt3_r.glb';
const holder=new THREE.Group();car.add(holder);
const V=()=>new THREE.Vector3();
function fit(){
  holder.position.set(0,0,0);car.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(holder),c=b.getCenter(V());
  holder.position.set(-c.x,-b.min.y,-c.z);car.updateMatrixWorld(true);
}
function maxY(side){ // highest sampled vertex on one side of the car centre (rear wing = highest point)
  let y=-1e9,v=V();
  holder.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,st=Math.max(1,a.count/15000|0);
    for(let i=0;i<a.count;i+=st){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.x*side>0&&v.y>y)y=v.y}});
  return y;
}
const gl=new THREE.GLTFLoader();
if(THREE.DRACOLoader)gl.setDRACOLoader(new THREE.DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/'));
gl.load(FILE,g=>{
  const m=g.scene,sp=car.position.clone(),sr=car.rotation.clone();
  car.position.set(0,0,0);car.rotation.set(0,0,0);
  holder.add(m);holder.updateMatrixWorld(true);
  let sz=new THREE.Box3().setFromObject(m).getSize(V());
  if(sz.z>sz.x)holder.rotation.y=Math.PI/2;                 // length -> X
  m.scale.setScalar(4.7/Math.max(sz.x,sz.z));fit();
  if(maxY(1)>maxY(-1))holder.rotation.y+=Math.PI;           // wing side = rear -> -X
  if(QS.get('flip'))holder.rotation.y+=Math.PI;
  fit();
  setupMaterials(m);
  /* wheels: re-pivot each wheel-sized node around its own centre so it can spin on the car's Z axis */
  const wl=[];
  (function col(o){
    if(/wheel|tyre|tire|rim/i.test(o.name)){const s=new THREE.Box3().setFromObject(o).getSize(V());
      if(Math.max(s.x,s.y)>.5&&Math.max(s.x,s.y)<1.1&&s.z<.5){wl.push(o);return}}
    o.children.slice().forEach(col);
  })(m);
  wl.forEach(o=>{const c=new THREE.Box3().setFromObject(o).getCenter(V()),pv=new THREE.Group();
    car.worldToLocal(c);pv.position.copy(c);car.add(pv);pv.updateMatrixWorld(true);pv.attach(o);wheels.push(pv)});
  console.log('wheels found:',wheels.length);
  car.updateMatrixWorld(true);buildParts(m);
  applyPaint('#ffc400',true);
  car.position.copy(sp);car.rotation.copy(sr);
  ready=true;loaded=true;
  $('#pn').textContent='100';$('#pbar i').style.transform='scaleX(1)';
  openSite();
},e=>{if(e.lengthComputable)target=Math.min(95,e.loaded/e.total*100)},
()=>{$('#pm').textContent='Could not load '+FILE+'. Use a local server and check the file name.'});

/* ---------- state, scroll choreography ---------- */
const s={ry:0,x:0,cy:1.1,cz:9.4,fov:32,ly:.65}, launch={x:0,boost:0}, ptr={x:0,y:0}, shk={a:0}, X={v:1}, cab={v:0};
const stops=[
 [2.6,1.8,1.2,8.2,30,.9],     // aero
 [-.7,-1.8,1.2,8.8,32,.65],   // livery
 [.4,1.8,2.6,12.8,34,.6],     // anatomy (pulled back for the exploded car)
 [-.9,-1.8,1.3,6.6,44,.7],    // cockpit
 [-1.1,1.9,.45,6.2,48,.5],    // specs
 [0,0,1,10.6,30,.65]          // grid
];
const tl=gsap.timeline({defaults:{ease:'power2.inOut'},scrollTrigger:{trigger:'#track',start:'top top',end:'bottom bottom',scrub:rm?0:1.1}});
stops.forEach((p,i)=>tl.to(s,{ry:p[0],x:p[1],cy:p[2],cz:p[3],fov:p[4],ly:p[5],duration:1},i));
gsap.to('#bar',{scaleY:1,ease:'none',scrollTrigger:{trigger:'#track',start:'top top',end:'bottom bottom',scrub:true}});
gsap.to('#big',{xPercent:-35,ease:'none',scrollTrigger:{trigger:'#track',start:'top top',end:'bottom bottom',scrub:true}});

let sv=0;
ScrollTrigger.create({onUpdate:self=>sv=Math.abs(self.getVelocity())});

/* text reveals */
document.querySelectorAll('.panel').forEach((p,i)=>{
  const ls=p.querySelectorAll('.l');
  if(i){gsap.set(ls,{yPercent:115});
    const show=()=>gsap.to(ls,{yPercent:0,stagger:.07,duration:rm?0:.9,ease:'power4.out',overwrite:true}),
          hide=()=>gsap.to(ls,{yPercent:115,duration:rm?0:.4,overwrite:true});
    ScrollTrigger.create({trigger:p,start:'top 60%',end:'bottom 40%',onEnter:show,onEnterBack:show,onLeave:hide,onLeaveBack:hide});
  }
});

/* intro: the car assembles itself part by part */
gsap.set('.hero .l',{yPercent:115});
const intro=gsap.timeline({paused:true});
intro.to(X,{v:0,duration:rm?.01:3.4,ease:'power3.inOut'},0)
     .to('.hero .l',{yPercent:0,stagger:.12,duration:rm?0:1,ease:'power4.out'},2)
     .from('#big',{opacity:0,xPercent:12,duration:rm?0:1.8,ease:'power3.out'},0);

/* anatomy: scroll into the section to take it apart, scroll away to rebuild */
function explode(to){
  SFX.whoosh(1.6,to?200:3000,to?3000:200,.35);
  gsap.to(X,{v:to,duration:rm?.01:(to?2.4:2.8),ease:'power3.inOut',overwrite:true});
  $('#ex').textContent=to?'Assemble':'Disassemble';
}
ScrollTrigger.create({trigger:'#anatomy',start:'top 55%',end:'bottom 45%',onEnter:()=>explode(1),onEnterBack:()=>explode(1),onLeave:()=>explode(0),onLeaveBack:()=>explode(0)});
$('#ex').onclick=()=>explode(X.v<.5?1:0);

/* cockpit: camera glides through the driver side to the seat; sport music kicks in */
let cabOn=false;
function enterCab(){cabOn=true;select(null);setMusic('sport');SFX.thunk();SFX.whoosh(1.8,200,2500,.4);
  document.body.classList.add('cab');document.documentElement.style.overflow='hidden';
  gsap.to(cab,{v:1,duration:rm?.01:2.6,ease:'power3.inOut',overwrite:true})}
function exitCab(){cabOn=false;setMusic('calm');SFX.thunk();document.body.classList.remove('cab');document.documentElement.style.overflow='';
  gsap.to(cab,{v:0,duration:rm?.01:2.2,ease:'power3.inOut',overwrite:true})}
$('#enter').onclick=enterCab;$('#exit').onclick=exitCab;
addEventListener('keydown',e=>{if(e.key==='Escape'){if(cabOn)exitCab();else select(null)}});

/* ---------- part inspector: click a part → it slides out of the car and an info card opens ---------- */
const INFO=[ // first match wins; the last entry is the fallback. [pattern, group, title, text]
 [/wheel|tyre|tire|rim|alloy/i,'Wheels and tyres','Wheel and slick tyre','Forged alloy rim held by a single centre-lock nut, wrapped in a racing slick. Low unsprung weight lets the suspension react faster over kerbs.'],
 [/brake|caliper|disc|rotor/i,'Braking','Brake system','Large steel discs and multi-piston calipers, fed with cooling air from the bumper. Built to survive repeated heavy stops from very high speed.'],
 [/glass|window|windshield|screen/i,'Cabin','Window','Race cars swap most side glass for lightweight polycarbonate to save weight. Tinted to cut glare on long stints.'],
 [/light|lamp|led|head|tail/i,'Lighting','Light unit','LED units tuned for night running. They are designed to be swapped quickly in the pits.'],
 [/mirror/i,'Aerodynamics','Side mirror','A compact housing shaped to keep drag low while giving the driver a clear view of the cars behind.'],
 [/wing|spoiler|flap/i,'Aerodynamics','Rear wing','A large adjustable carbon wing that creates most of the rear downforce. It keeps the rear axle planted at the end of long straights.'],
 [/diffuser/i,'Aerodynamics','Rear diffuser','Speeds up the air under the car, creating a low-pressure zone that pulls the body toward the track.'],
 [/splitter|canard|lip|dive/i,'Aerodynamics','Front splitter','A carbon blade that controls the air going under the nose and adds downforce to the front axle.'],
 [/exhaust|pipe|muffler|tailpipe/i,'Powertrain','Exhaust','Carries the flat-six exhaust out of the car. Its tuned length shapes both the power curve and the sound.'],
 [/engine|motor|piston|cylinder/i,'Powertrain','Flat-six engine','A naturally aspirated 4.2 L flat-six mounted behind the rear axle. Output depends on the class Balance of Performance.'],
 [/door/i,'Body','Door','A lightweight composite door panel with a slim profile to keep the cabin narrow and rigid.'],
 [/hood|bonnet|trunk|boot|lid|frunk/i,'Body','Access lid','Lightweight lid held with quick-release pins so mechanics can reach the compartment in seconds.'],
 [/roof/i,'Body','Roof','A low roofline that cuts frontal area. Race versions include an emergency escape hatch.'],
 [/seat|interior|steering|wheel_|dash|cage|cockpit|pedal/i,'Cockpit','Cockpit hardware','Fixed-back race seat, a steering wheel packed with switches, and a safety cage that protects the driver.'],
 [/grill|grille|vent|duct|intake|scoop|radiator/i,'Cooling','Cooling duct','Channels air to the brakes, radiators and engine bay, shaped to cool without adding much drag.'],
 [/carbon/i,'Materials','Carbon-fibre panel','Strong and very light. Used wherever weight must come off the car.'],
 [/number|plate|decal|sticker|livery|graffiti|logo/i,'Livery','Livery graphics','The number 91 and the car’s graphics, applied as a wrap over the bodywork.'],
 [/./,'Body','Body panel','Part of the lightweight body shell. The panels are shaped to guide air and protect the chassis.']
];
const RC=new THREE.Raycaster();
let sel=null;
function fillInfo(p){
  const o=p.o,mt=[].concat(o.material||[])[0],txt=[o.name,o.parent&&o.parent.name,mt&&mt.name].join(' ');
  const i=p.wheel?INFO[0]:INFO.find(x=>x[0].test(txt)),f=98; // ≈ cm per scene unit (car is 4.7 units long)
  $('#ik').textContent=i[1];$('#it').textContent=i[2];$('#id').textContent=i[3];
  const clean=v=>(v||'').replace(/[_.]+/g,' ').trim(),dm=p.dm;
  const rows=[['Mesh',clean(o.name).slice(0,26)||'Unnamed'],['Material',clean(mt&&mt.name).slice(0,24)||'n/a'],['Size ≈',Math.round(dm.x*f)+' × '+Math.round(dm.z*f)+' × '+Math.round(dm.y*f)+' cm']];
  const dl=$('#is');dl.textContent='';
  rows.forEach(([a,b])=>{const r=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;r.append(dt,dd);dl.append(r)});
}
function select(p){
  if(sel&&sel!==p)gsap.to(sel,{sv:0,duration:.9,ease:'power3.inOut',overwrite:true,onUpdate:()=>dirty=true});
  sel=p;
  if(!p){$('#info').classList.remove('on');return}
  fillInfo(p);$('#info').classList.add('on');
  gsap.to(p,{sv:1,duration:1.1,ease:'power3.out',overwrite:true,onUpdate:()=>dirty=true});
  SFX.whoosh(.5,400,2600,.25);SFX.ping();
}
function pick(e){
  if(cabOn||!ready)return;
  const r=$('#gl').getBoundingClientRect();
  RC.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-((e.clientY-r.top)/r.height)*2+1},C);
  let found=null;
  for(const h of RC.intersectObjects(car.children,true)){
    if(!h.object.visible)continue;
    const mt=[].concat(h.object.material||[])[0];if(mt&&mt.transparent&&mt.opacity<.5)continue; // look through glass
    let n=h.object,p;while(n&&!(p=pmap.get(n)))n=n.parent;
    if(p){found=p;break}
  }
  select(found&&found!==sel?found:null);
}
$('#gl').addEventListener('click',pick);
$('#ix').onclick=()=>select(null);

/* mood: accent light + a real paint finish (colour, metalness, roughness, clearcoat) */
document.querySelectorAll('.sw button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.sw button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  const c=new THREE.Color(b.dataset.c),o={r:c.r,g:c.g,b:c.b,duration:.7};
  gsap.to(document.documentElement,{'--acc':b.dataset.c,duration:.7});
  gsap.to(rim.color,o);gsap.to(ring.material.color,o);gsap.to(stM.color,o);
  gsap.fromTo(rim,{intensity:7},{intensity:2.2,duration:1.3,ease:'power3.out'});
  applyPaint(b.dataset.c);SFX.click(600+Math.random()*200);SFX.whoosh(.5,500,2500,.2);
});

/* launch */
let busy=false;
function launchCar(){
  if(busy)return;busy=true;SFX.launch();
  gsap.fromTo(shk,{a:.12},{a:0,duration:1.6,ease:'power3.out'});
  gsap.timeline({onComplete:()=>busy=false})
    .to(launch,{boost:300,duration:.6,ease:'power2.in'},0)
    .to(launch,{x:16,duration:1.1,ease:'power3.in'},.25)
    .set(launch,{x:-16})
    .to(launch,{x:0,duration:1.8,ease:'power4.out'})
    .to(launch,{boost:0,duration:1.6,ease:'power2.out'},'<');
}
$('#go').onclick=launchCar;$('#go2').onclick=launchCar;

/* pointer parallax / cockpit look-around */
addEventListener('pointermove',e=>gsap.to(ptr,{x:e.clientX/innerWidth-.5,y:e.clientY/innerHeight-.5,duration:1.2,ease:'power3.out',overwrite:true}));

/* ---------- loop ---------- */
const stM=new THREE.MeshBasicMaterial({color:0xffc400,transparent:true,opacity:0,depthWrite:false});
const streaks=[...Array(46)].map(()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1.6,.012,.02),stM);
  m.position.set((Math.random()-.5)*28,.02,(Math.random()-.5)*7);m.userData.v=.6+Math.random()*.8;S.add(m);return m});
function resize(){R.setSize(innerWidth,innerHeight,false);C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
let spd=0,lean=0;
gsap.ticker.add((t,dtm)=>{
  const k=Math.min(dtm/1000,.05);
  if(!ready){target=Math.min(95,target+k*10);shown+=(target-shown)*Math.min(1,k*5);
    $('#pn').textContent=String(Math.round(shown)).padStart(3,'0');$('#pbar i').style.transform='scaleX('+shown/100+')'}
  sv*=Math.pow(.02,k);
  spd+=(Math.min(300,sv/9)+launch.boost-spd)*Math.min(1,k*6);
  const f=Math.max(1,1.7/C.aspect),wide=innerWidth>900,cb=cab.v;
  lean+=((launch.boost/300)*.025-lean)*Math.min(1,k*3);
  car.position.x=(wide?s.x:0)*(1-cb)+launch.x;
  car.rotation.y=(s.ry+ptr.x*.18)*(1-cb);           // car squares up while the camera moves in
  car.rotation.z=-lean+Math.sin(t*38)*spd/300*.0025;
  car.updateMatrixWorld(true);
  applyEx();

  /* camera: orbit rig, blended along a curve (outside → driver window → seat) when cab > 0 */
  const A=V().set((Math.random()-.5)*shk.a,s.cy-ptr.y*.25+(Math.random()-.5)*shk.a,s.cz*f);
  const L=V().set(0,s.ly,0);let fov=s.fov+spd/300*7;
  if(cb>.001){
    const u=1-cb,E=car.localToWorld(V().set(EYE[0],EYE[1],EYE[2])),
          B=car.localToWorld(V().set(EYE[0]-.3,EYE[1]+.55,EYE[2]*6.5)),yw=ptr.x*2.2,
          D=car.localToWorld(V().set(EYE[0]+Math.cos(yw)*6,EYE[1]-ptr.y*3,EYE[2]+Math.sin(yw)*6));
    A.multiplyScalar(u*u).addScaledVector(B,2*u*cb).addScaledVector(E,cb*cb);
    L.lerp(D,cb);fov+=(72-fov)*cb;
  }
  C.fov=fov;C.updateProjectionMatrix();C.position.copy(A);C.lookAt(L);

  engineUpdate(spd,cb);
  const sp=spd*.14*k;wheels.forEach(w=>w.rotation.z-=sp);
  stM.opacity=Math.min(.7,spd/220);
  streaks.forEach(m=>{m.position.x-=spd*.06*k*m.userData.v+k*.2;m.scale.x=1+spd/50;if(m.position.x<-14)m.position.x=14});
  ring.rotation.z+=k*.15;
  $('#kmh').textContent=String(Math.round(spd)).padStart(3,'0');
  R.render(S,C);
});
