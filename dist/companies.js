import {companies} from './companies-data.js?v=social-1';
import {escapeHtml as h} from './community-model.js';
export {companies};
const aliases={meta:'facebook',aws:'amazon','amazon web services':'amazon'};
export function findCompany(name){const q=String(name).toLowerCase();return companies.find(c=>c.name.toLowerCase()===(aliases[q]||q));}
export function companyIcon(name){const c=findCompany(name);return '<span class="company-logo" tabindex="0" role="img" aria-label="'+h(name)+'" title="'+h(name)+'">'+(c?'<img src="'+c.file+'" alt="" loading="lazy">':'<span class="company-unknown">'+h(name.slice(0,1))+'</span>')+'<span class="company-tooltip" aria-hidden="true">'+h(name)+'</span></span>';}
// Show at most three company logos in the problem table. Additional tags are
// revealed only while the +N control is hovered or keyboard-focused.
export function companyIcons(names,limit=3){
 const list=Array.isArray(names)?names.filter(name=>typeof name==="string"&&name.trim()).map(name=>name.trim()):[];
 if(!list.length)return "";
 const shown=list.slice(0,limit).map(companyIcon).join("");
 const extra=list.slice(limit);
 if(!extra.length)return shown;
 return shown+'<span class="company-overflow"><button type="button" class="company-overflow-count" aria-label="Show '+extra.length+' additional company tags" title="Hover to see '+extra.length+' more companies">+'+extra.length+'</button><span class="company-overflow-panel" role="group" aria-label="Additional company tags">'+extra.map(companyIcon).join('')+'</span></span>';
}
export function mountCompanyPicker(){const field=document.getElementById('pCompanies');if(!field)return;const box=document.createElement('section');box.className='company-picker';box.setAttribute('aria-label','Company logo library');box.innerHTML='<input type="search" placeholder="Search 100 company logos…" aria-label="Search company logo library"><div class="company-grid"></div><small>Choose up to 8. Logos identify company tags; they do not imply endorsement. Custom company names can also be entered above.</small>';field.parentElement.after(box);const query=box.querySelector('input'),grid=box.querySelector('.company-grid');function render(){const chosen=field.value.split(',').map(x=>x.trim()).filter(Boolean),list=companies.filter(c=>c.name.toLowerCase().includes(query.value.toLowerCase()));grid.innerHTML=list.map(c=>'<button type="button" class="company-option" data-company="'+h(c.name)+'" aria-pressed="'+chosen.some(x=>x.toLowerCase()===c.name.toLowerCase())+'"><img src="'+c.file+'" alt="" loading="lazy"><span>'+h(c.name)+'</span></button>').join('')||'<span class="no-company">No matching logo. Enter a custom name above.</span>';grid.querySelectorAll('button').forEach(b=>b.onclick=()=>{const found=chosen.findIndex(x=>x.toLowerCase()===b.dataset.company.toLowerCase());if(found>=0)chosen.splice(found,1);else if(chosen.length<8)chosen.push(b.dataset.company);else{box.querySelector('small').textContent='Choose up to 8 companies. Remove a selection first.';return;}field.value=chosen.join(', ');field.dispatchEvent(new Event('input',{bubbles:true}));render();});}query.oninput=render;field.addEventListener('input',render);render();return{refresh:render};}
