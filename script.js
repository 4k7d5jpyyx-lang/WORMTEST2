const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

let DPR = window.devicePixelRatio || 1;
let colonies = [];
let buyers = 0;
let volume = 0;
let mcap = 0;

function resize(){
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * DPR;
  canvas.height = r.height * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize);
resize();

// ---- LOG (CAPPED + MERGED) ----
const logEl = document.getElementById("log");
function log(msg){
  const d = document.createElement("div");
  d.textContent = msg;
  logEl.prepend(d);
  if(logEl.children.length > 40){
    logEl.removeChild(logEl.lastChild);
  }
}

// ---- COLONY ----
function newColony(x,y){
  return {
    x,y,
    worms: Array.from({length:8},()=>({
      a:Math.random()*Math.PI*2,
      r:20+Math.random()*30,
      s:.005+Math.random()*.01,
      c:`hsl(${Math.random()*360},90%,60%)`
    }))
  };
}

colonies.push(newColony(0,0));

// ---- SIM LOOP ----
let t=0;
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);

  colonies.forEach(col=>{
    col.worms.forEach(w=>{
      ctx.beginPath();
      ctx.strokeStyle = w.c;
      ctx.lineWidth = 4;
      ctx.arc(
        Math.sin(t*w.s+w.a)*w.r,
        Math.cos(t*w.s+w.a*1.2)*w.r,
        12+Math.sin(t)*4,
        0,
        Math.PI*2
      );
      ctx.stroke();
    });
  });

  ctx.restore();
  t+=0.01;
  requestAnimationFrame(draw);
}
draw();

// ---- ACTIONS ----
document.querySelectorAll("button").forEach(b=>{
  b.onclick=()=>{
    const a=b.dataset.action;
    if(a==="smallBuy"){buyers++;volume+=300;mcap+=1500;}
    if(a==="whaleBuy"){buyers+=3;volume+=3000;mcap+=12000;}
    if(a==="mutate"){colonies[0].worms.push({...colonies[0].worms[0]});log("Mutation event");}
    if(a==="reset"){location.reload();}
    update();
  }
});

function update(){
  document.getElementById("buyers").textContent=buyers;
  document.getElementById("volume").textContent=`$${volume.toLocaleString()}`;
  document.getElementById("mcap").textContent=`$${mcap.toLocaleString()}`;
  document.getElementById("colonies").textContent=colonies.length;
  document.getElementById("worms").textContent=colonies.reduce((a,c)=>a+c.worms.length,0);
}
