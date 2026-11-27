// Keep the editor's selected problem in the shareable URL.
// Preserve unrelated URL parameters and the GitHub Pages subdirectory.
export function selectedProblemUrl(href,id){
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,79}$/.test(id))throw new Error('Invalid problem ID');
 const url=new URL(href);
 url.searchParams.set('problem',id);
 url.hash='practice';
 return url.pathname+url.search+url.hash;
}
