let cancel;
export function launchCelebration({win=window,doc=document}={}){
 cancel?.();if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const canvas=doc.createElement('canvas');canvas.className='celebration-canvas';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('popover','manual');doc.body.append(canvas);
 try{canvas.showPopover();}catch{doc.querySelector('dialog[open]')?.append(canvas);}
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}const dpr=Math.min(win.devicePixelRatio||1,2),w=win.innerWidth,h=win.innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
 const colors=['#ff4081','#ffce32','#45d5ff','#34d399','#a78bfa','#ff853e'];
 const particles=Array.from({length:150},(_,i)=>({x:w*(i%2?.22:.78),y:h*.58,vx:(Math.random()-.5)*18,vy:-8-Math.random()*15,r:Math.random()*Math.PI,spin:(Math.random()-.5)*.3,size:5+Math.random()*6,color:colors[i%colors.length]}));
 let frame,last=0,elapsed=0,started=null;function cleanup(){win.cancelAnimationFrame(frame);canvas.remove();win.removeEventListener('pagehide',cleanup);if(cancel===cleanup)cancel=null;}cancel=cleanup;win.addEventListener('pagehide',cleanup,{once:true});
 function draw(now){if(!canvas.isConnected)return;const dt=Math.min((now-(last||now))/16.67,2);last=now;started??=now;elapsed=(now-started)/16.67;ctx.clearRect(0,0,w,h);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.24*dt;p.vx*=Math.pow(.991,dt);p.r+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.globalAlpha=Math.min(1,(230-elapsed)/35);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*.65);ctx.restore();}if(elapsed<230)frame=win.requestAnimationFrame(draw);else cleanup();}frame=win.requestAnimationFrame(draw);
}
