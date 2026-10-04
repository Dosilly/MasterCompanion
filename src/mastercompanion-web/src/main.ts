import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { CAMPAIGN_MODULES } from '@mastercompanion/contracts';
import { Workspace } from '@mastercompanion/engine';
import { ythrynModule } from '@mastercompanion/ythryn';

@Component({ selector: 'mc-app', imports: [Workspace], template: '<mc-workspace />' })
class App {}

bootstrapApplication(App, {
  providers: [provideHttpClient(), { provide: CAMPAIGN_MODULES, useValue: [ythrynModule] }],
}).catch((error) => console.error(error));
