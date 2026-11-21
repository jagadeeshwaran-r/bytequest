import {ChangeDetectionStrategy,Component,inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MaintenanceStatusService} from './core/maintenance-status.service';

@Component({
  selector:'bq-root',imports:[RouterOutlet],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    @if(maintenance.blocked()){
      <main class="native-maintenance" role="main">
        <span class="eyebrow">BYTEQUEST SYSTEM STATUS</span>
        <h1>ByteQuest is under maintenance.</h1>
        <p>{{maintenance.upcoming()?.message||'We are upgrading ByteQuest to make your coding experience better.'}}</p>
        <p class="muted">The server controls the maintenance window. Other pages are unavailable during maintenance.</p>
        <button type="button" (click)="maintenance.refresh()">Check again</button>
      </main>
    } @else if(maintenance.strict&&(maintenance.loading()||maintenance.error())){
      <main class="native-maintenance" role="main">
        <h1>Checking ByteQuest availability</h1>
        <p class="muted">The maintenance service could not be confirmed.
           Other pages remain unavailable until the server can be reached.</p>
        @if(maintenance.error()){<button type="button" (click)="maintenance.refresh()">Retry</button>}
      </main>
    } @else {
      @if(maintenance.upcoming()){
        <aside class="native-maintenance-banner" role="status">
          Scheduled maintenance: {{maintenance.upcoming()!.startsAt||'Time pending'}}
          to {{maintenance.upcoming()!.endsAt||'Time pending'}}.
          {{maintenance.upcoming()!.message||''}}
        </aside>
      }
      <router-outlet/>
    }
  `,
  styles:[`
    .native-maintenance{min-height:100dvh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;padding:40px 24px;
      color:var(--text,#e8f0e8);background:var(--page,#0c130e)}
    .native-maintenance h1{font-size:clamp(24px,4vw,42px);letter-spacing:-.04em}
    .native-maintenance p{max-width:550px;font-size:14px;line-height:1.7}
    .native-maintenance button{cursor:pointer;padding:10px 15px;border:1px solid #637965;
      border-radius:9px;background:transparent;color:inherit}
    .native-maintenance-banner{position:relative;z-index:60;background:#242017;color:#f4e5b9;
      padding:9px 17px;text-align:center;font-size:11px;line-height:1.5}
  `]
})
export class AppComponent {
 readonly maintenance=inject(MaintenanceStatusService);
}
