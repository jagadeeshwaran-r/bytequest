import {Component, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

type Theme = 'light' | 'dark';
function initialTheme(): Theme {
  try { return localStorage.getItem('bytequest.angular-preview.theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
@Component({
  selector: 'bq-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="shell-header">
      <a class="brand" routerLink="/" aria-label="ByteQuest Angular preview home">
        <span>Byte</span><span class="brand-accent">Quest</span>
      </a>
      <nav aria-label="Primary navigation">
        <a routerLink="/" routerLinkActive="current" [routerLinkActiveOptions]="{exact:true}">Problems</a>
        <a class="muted-link" [href]="liveUrl" target="_blank" rel="noopener noreferrer">Live ByteQuest ↗</a>
      </nav>
      <button class="theme-toggle" type="button" (click)="toggleTheme()"
        [attr.aria-label]="theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
        {{theme() === 'dark' ? '☀ Light' : '◐ Dark'}}
      </button>
    </header>
    <main class="app-main">
      <div class="preview-note" role="status"><span class="preview-pulse"></span>
        Angular migration preview · Java editor and read-only published problems · Run and Submit remain on the live site
      </div>
      <router-outlet />
    </main>
  `,
  host: {'[attr.data-theme]': 'theme()'}
})
export class AppComponent {
  readonly liveUrl = 'https://jagadeeshwaran-r.github.io/bytequest/';
  readonly theme = signal<Theme>(initialTheme());
  toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try { localStorage.setItem('bytequest.angular-preview.theme', next); } catch { /* Storage blocked: theme still works in memory. */ }
  }
}
