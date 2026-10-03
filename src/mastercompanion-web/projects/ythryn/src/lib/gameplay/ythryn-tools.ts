import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlightTool } from './blight-tool';
import { ExpeditionTool } from './expedition-tool';

@Component({
  selector: 'mc-ythryn-tools', imports: [BlightTool, ExpeditionTool],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<mc-ythryn-expedition /><mc-ythryn-blight />',
})
export class YthrynTools {}
