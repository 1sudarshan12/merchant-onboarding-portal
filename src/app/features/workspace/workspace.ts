import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/ui/icon';
import { ApplicationChecklist } from './application-checklist';

@Component({
  selector: 'app-workspace',
  imports: [MatButtonModule, Icon],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  private readonly dialog = inject(MatDialog);
  protected readonly stages = [
    {
      number: '01',
      role: 'Sales',
      title: 'Prepare & submit',
      description:
        'Bring the merchant details together, save your progress, and submit when ready.',
      icon: 'document',
    },
    {
      number: '02',
      role: 'Admin',
      title: 'Assign for review',
      description: 'Direct each submitted application to the right reviewer for assessment.',
      icon: 'grid',
    },
    {
      number: '03',
      role: 'Reviewer',
      title: 'Assess & decide',
      description: 'Review the information and record a decision with a clear risk history.',
      icon: 'shield',
    },
  ] as const;

  protected openChecklist(): void {
    this.dialog.open(ApplicationChecklist, {
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
    });
  }
}
