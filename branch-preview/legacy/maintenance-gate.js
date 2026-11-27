const allowed=Object.freeze({
 'index.html':'./app.js','studio.html':'./studio-page.js',
 'community.html':'./community.js','leaderboard.html':'./leaderboard.js',
 'privacy.html':'./reference-motion.js','runner.html':'./runner-core.js',
 'native-runner.html':'./native-runner-core.js'
});
const page=location.pathname.split('/').pop()||'index.html';
const script=document.querySelector('script[data-bq-app]');
const entry=script?.getAttribute('data-bq-app')||'';
const expected=allowed[page];
if(!expected||!entry.startsWith(expected+'?')){
 document.documentElement.removeAttribute('data-bq-maintenance-check');
 console.error('ByteQuest staging: invalid page entrypoint');
}else{
 // Staging can't independently confirm production maintenance without backend
 // Origin authorization. Protected API requests remain server-enforced.
 document.documentElement.removeAttribute('data-bq-maintenance-check');
 void import(entry).catch(error=>{
   console.error('ByteQuest staging application could not load',error);
   const node=document.createElement('p');
   node.role='alert';node.style.cssText='padding:24px;color:#ed9292;font:14px system-ui';
   node.textContent='The staging application could not start. Reload this page.';
   document.body.prepend(node);
 });
}
