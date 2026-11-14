import {rankCup} from './rewards.js?v=upgrade-2';
import {escapeHtml as h} from './community-model.js';
export function leaderboardRow(p){
 const rank=Number(p.rank)||0,solved=Number(p.solved)||0,url='./community.html#user/'+encodeURIComponent(p.username);
 const photo=p.avatar_url&&/^https:\/\//.test(p.avatar_url)?'<img src="'+h(p.avatar_url)+'" alt="" referrerpolicy="no-referrer" loading="lazy">':'';
 return '<tr'+(p.isYou?' class="your-ranking"':'')+'><td><span class="rank-number '+(rank<=3?'rank-leading':'')+'">'+rankCup(rank)+'<span>'+rank+'</span></span></td><td><a class="leader-person" href="'+url+'"><span class="leader-avatar">'+h((p.display_name||p.username).charAt(0).toUpperCase())+photo+'</span><span><strong>'+h(p.display_name)+'</strong><small>@'+h(p.username)+'</small></span>'+(p.isYou?'<span class="leader-you">You</span>':'')+'</a></td><td class="leader-points">'+(Number(p.points)||0)+'</td><td class="leader-solved">'+solved+'</td>'+['easy','medium','hard'].map(k=>'<td class="leader-difficulty '+k+'">'+(Number(p[k])||0)+'</td>').join('')+'</tr>';
}
// A filter change or account switch invalidates every outstanding result.
export function latestLeaderboard(request){
 let generation=0;
 return{cancel(){generation++;},async load(query,owner){const ticket=++generation;try{const result=await request('leaderboard',query,owner);return ticket===generation?{result}:null;}catch(error){if(ticket!==generation)return null;throw error;}}};
}
