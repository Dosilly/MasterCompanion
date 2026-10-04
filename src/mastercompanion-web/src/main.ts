import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { CAMPAIGN_MODULES } from '@mastercompanion/contracts';
import { ythrynModule } from '@mastercompanion/ythryn';
import { appRoutes } from './app.routes';

@Component({ selector: 'mc-app', imports: [RouterOutlet], template: '<router-outlet />' })
class App {}

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter(appRoutes),
    { provide: CAMPAIGN_MODULES, useValue: [ythrynModule] },
  ],
}).catch((error) => console.error(error));
