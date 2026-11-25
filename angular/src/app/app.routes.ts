import type {Routes} from '@angular/router';

export const routes: Routes = [
  {path: '', loadComponent: () => import('./features/problems/problems.component').then(m => m.ProblemsComponent), title: 'Problems · ByteQuest Preview'},
  {path: 'problem/:id', loadComponent: () => import('./features/practice/practice.component').then(m => m.PracticeComponent), title: 'Practice · ByteQuest Preview'},
  {path: '**', redirectTo: ''},
];
