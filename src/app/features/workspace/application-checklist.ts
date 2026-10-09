import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-application-checklist',
  imports: [MatDialogModule, MatButtonModule, Icon],
  templateUrl: './application-checklist.html',
  styleUrl: './application-checklist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationChecklist {}
