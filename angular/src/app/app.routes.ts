import type {Routes} from '@angular/router';

// The default route displays ByteQuest's canonical UI unchanged. This
// compatibility bridge preserves features while native Angular migration is
// incrementally completed. It is not a claim of full Angular code migration.
const screen=()=>import('./legacy-screen.component').then(m=>m.LegacyScreenComponent);
export const routes:Routes=[
  {path:'',loadComponent:screen,data:{screen:'index.html'},title:'ByteQuest · Problems'},
  {path:'classic/community',loadComponent:screen,data:{screen:'community.html'},title:'ByteQuest · Community'},
  {path:'classic/leaderboard',loadComponent:screen,data:{screen:'leaderboard.html'},title:'ByteQuest · Leaderboard'},
  {path:'classic/studio',loadComponent:screen,data:{screen:'studio.html'},title:'ByteQuest · Studio'},
  {path:'angular',loadComponent:()=>import('./preview-shell.component').then(m=>m.PreviewShellComponent),children:[
    {path:'',loadComponent:()=>import('./features/problems/problems.component').then(m=>m.ProblemsComponent),title:'Angular problems · ByteQuest'},
    {path:'problem/:id',loadComponent:()=>import('./features/practice/practice.component').then(m=>m.PracticeComponent),title:'Angular practice · ByteQuest'},
    {path:'profile/:target',loadComponent:()=>import('./features/profile/profile.component').then(m=>m.ProfileComponent),title:'Angular profile · ByteQuest'},
    {path:'leaderboard',loadComponent:()=>import('./features/leaderboard/leaderboard.component').then(m=>m.LeaderboardComponent),title:'Angular leaderboard · ByteQuest'}
  ]},
  {path:'**',redirectTo:''}
];
