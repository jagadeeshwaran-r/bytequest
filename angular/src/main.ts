import {bootstrapApplication} from '@angular/platform-browser';
import {PreloadAllModules, provideRouter, withHashLocation, withPreloading} from '@angular/router';
import {AppComponent} from './app/app.component';
import {routes} from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withHashLocation(), withPreloading(PreloadAllModules))],
}).catch(error => console.error('ByteQuest Angular preview failed to start', error));
