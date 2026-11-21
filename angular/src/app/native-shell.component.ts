import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from './core/auth.service';
import {ChatComponent} from './features/chat/chat.component';

/** Persistent native Angular shell. Styles are installed once in index.html,
 * before bootstrap, not injected and torn down with routed components. */
type ThemeMode='light'|'dark'|'system';
@Component({
  selector:'bq-native-shell',
  imports:[RouterOutlet,RouterLink,RouterLinkActive,ChatComponent],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
  <header class="minimal-header">
    <a class="minimal-brand" aria-label="ByteQuest home" routerLink="/angular">
      <span class="wordmark-byte">Byte</span><span class="wordmark-quest">Quest</span>
    </a>
    <nav class="minimal-nav" aria-label="Main navigation">
      <a routerLink="/angular" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Problems</a>
      <a routerLink="/angular/leaderboard" routerLinkActive="active">Leaderboard</a>
      <a routerLink="/angular/find" routerLinkActive="active" aria-label="Find friends">Find friends</a>
    </nav>
    <a class="native-compact-find" routerLink="/angular/find" aria-label="Find friends">Find friends...</a>
    <div class="native-shell-tools"><bq-chat/></div>
    <div class="profile-dropdown">
      <button type="button" class="native-profile-toggle" aria-label="Account menu" [attr.aria-expanded]="menuOpen()"
        aria-controls="nativeAccountMenu" (click)="menuOpen.set(!menuOpen())">
        <span class="native-avatar">
          @if(auth.user()?.avatarUrl){
            <img [src]="auth.user()!.avatarUrl" alt="" referrerpolicy="no-referrer"/>
          }@else{
            {{auth.user()?.name?.charAt(0)||'A'}}
          }
        </span>
        <span>{{auth.user()?.name||'Account'}}</span>⌄
      </button>
      @if(menuOpen()){
        <div class="native-account-menu" id="nativeAccountMenu">
          <a routerLink="/angular/profile/me" (click)="menuOpen.set(false)">My profile</a>
          <a routerLink="/angular/find" (click)="menuOpen.set(false)">Find friends</a>
          <a routerLink="/angular/profile/edit" (click)="menuOpen.set(false)">Edit profile</a>
          <a routerLink="/angular/leaderboard" (click)="menuOpen.set(false)">Leaderboard</a>
          <a routerLink="/angular/studio" (click)="menuOpen.set(false)">Problem studio</a>
          <div class="theme-choices">
            <button type="button" (click)="setTheme('light')">☀ Light</button>
            <button type="button" (click)="setTheme('dark')">☾ Dark</button>
            <button type="button" (click)="setTheme('system')">System</button>
          </div>
          <div class="native-account-actions">
            @if(auth.user()) {
              <button type="button" (click)="auth.signOut();menuOpen.set(false)">Sign out</button>
            } @else {
              <button type="button" [disabled]="!auth.ready() || auth.loading()"
                (click)="auth.signIn();menuOpen.set(false)">Sign in with Google</button>
            }
          </div>
        </div>
      }
    </div>
  </header>
  <main class="native-bytequest-content">
    @if(auth.error()){
      <p class="native-auth-error" role="alert">{{auth.error()}}</p>
    }
    <router-outlet/>
  </main>
  `,
  styles:[`
    :host{display:block;min-height:100dvh}
    .native-bytequest-content{max-width:1540px;margin:0 auto;padding:16px 22px 90px}
    .native-shell-tools{display:flex;align-items:center;margin-left:auto}
    .native-compact-find{display:none}
    .native-profile-toggle{display:flex;align-items:center;gap:9px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}
    .native-avatar{display:grid;place-items:center;height:29px;width:29px;border-radius:50%;background:var(--surface,#183026);font-weight:600}
    .native-avatar img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
    .native-account-menu{position:absolute;right:0;top:100%;z-index:50;display:grid;min-width:220px;padding:9px;background:var(--surface,#101916);border:1px solid var(--border,#283b32);border-radius:12px;box-shadow:0 20px 45px #0003}
    .native-account-menu a,.native-account-menu button{display:block;text-align:left;padding:10px;background:transparent;border:0;color:inherit;font:inherit;cursor:pointer}
    .native-account-menu a:hover,.native-account-menu button:hover{color:var(--accent,#54c988)}
    .native-account-actions{border-top:1px solid #80808022}
    .native-auth-error{margin:10px 0;border:1px solid #b75757;border-radius:8px;padding:10px;color:#e78686}
  `]
})
export class NativeShellComponent{
 readonly auth=inject(AuthService);
 readonly menuOpen=signal(false);
 setTheme(value:ThemeMode):void{
  try{localStorage.setItem('bytequest.theme',value)}catch{}
  this.applyTheme(value);
  this.menuOpen.set(false);
 }
 private applyTheme(value:ThemeMode):void{
  const theme=value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value;
  document.documentElement.dataset['theme']=theme;
  document.documentElement.style.colorScheme=theme;
 }
}
