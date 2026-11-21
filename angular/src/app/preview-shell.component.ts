import {Component, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {inject} from '@angular/core';
import {AuthService} from './core/auth.service';

type Theme = 'light' | 'dark';
function initialTheme(): Theme {
  try { return localStorage.getItem('bytequest.angular-preview.theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
@Component({
  selector: 'bq-preview-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="shell-header">
      <a class="brand" routerLink="/" aria-label="ByteQuest Angular preview home">
        <span>Byte</span><span class="brand-accent">Quest</span>
      </a>
      <nav aria-label="Primary navigation">
        <a routerLink="/" routerLinkActive="current" [routerLinkActiveOptions]="{exact:true}">Problems</a>
        <a routerLink="/leaderboard" routerLinkActive="current">Leaderboard</a>
        <a routerLink="/profile/me" routerLinkActive="current">Profile</a>
        <a class="muted-link" [href]="liveUrl" target="_blank" rel="noopener noreferrer">Live ByteQuest ↗</a>
      </nav>
      <button class="theme-toggle" type="button" (click)="toggleTheme()"
        [attr.aria-label]="theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
        {{theme() === 'dark' ? '☀ Light' : '◐ Dark'}}
      </button>
      @if(auth.user()){
        <button class="theme-toggle account-toggle" type="button" (click)="auth.signOut()">Sign out</button>
      }@else{
        <button class="theme-toggle account-toggle" type="button" [disabled]="!auth.ready()||auth.loading()" (click)="auth.signIn()">
          {{auth.loading() ? 'Signing in…' : 'Google sign-in'}}
        </button>
      }
    </header>
    <main class="app-main">
      @if(auth.error()){<p class="auth-error" role="alert">{{auth.error()}} · If this is an unauthorized domain, authorize the stable staging hostname in Firebase first.</p>}
      <div class="preview-note" role="status"><span class="preview-pulse"></span>
        Angular staging · Java public Run available · Verified Submit and writes remain on the live site
      </div>
      <router-outlet />
    </main>
  `,
  host: {'[attr.data-theme]': 'theme()'}
})
export class PreviewShellComponent {
  readonly auth=inject(AuthService);
  readonly liveUrl = 'https://jagadeeshwaran-r.github.io/bytequest/';
  readonly theme = signal<Theme>(initialTheme());
  toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try { localStorage.setItem('bytequest.angular-preview.theme', next); } catch { /* Storage blocked: theme still works in memory. */ }
  }
}
