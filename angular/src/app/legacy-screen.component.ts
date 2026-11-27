import {Component, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {DomSanitizer, type SafeResourceUrl} from '@angular/platform-browser';

type LegacyScreen='index.html'|'community.html'|'leaderboard.html'|'studio.html';
const allowed:readonly LegacyScreen[]=['index.html','community.html','leaderboard.html','studio.html'];
@Component({
  selector:'bq-legacy-screen',
  template:`
    <iframe
      class="legacy-workspace-frame"
      [src]="source"
      [title]="title"
      loading="eager"
      referrerpolicy="strict-origin-when-cross-origin">
    </iframe>
  `,
  styles:[`
    :host{display:block;width:100%;height:100dvh;overflow:hidden}
    .legacy-workspace-frame{display:block;border:0;width:100%;height:100%;background:#070909}
  `]
})
export class LegacyScreenComponent{
  private readonly route=inject(ActivatedRoute);
  private readonly sanitizer=inject(DomSanitizer);
  readonly screen:LegacyScreen=allowed.includes(this.route.snapshot.data['screen'])
    ?this.route.snapshot.data['screen'] as LegacyScreen:'index.html';
  readonly title='ByteQuest '+(this.screen==='index.html'?'Problems':this.screen.replace('.html',''));
  // Safety: only hard-coded trusted same-origin page filenames enter this
  // resource URL; never use a user-controlled path with bypassSecurityTrust.
  readonly source:SafeResourceUrl=this.sanitizer.bypassSecurityTrustResourceUrl(
    new URL('legacy/'+this.screen,document.baseURI).href
    +(this.screen==='index.html'?'#map':'')
  );
}
