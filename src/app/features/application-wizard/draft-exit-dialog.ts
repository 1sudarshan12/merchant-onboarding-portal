import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DraftExitData {
  reload: boolean;
  canSave: boolean;
}
export type DraftExitChoice = 'stay' | 'discard' | 'save';

@Component({
  selector: 'app-draft-exit-dialog',
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.reload ? 'Load the server copy?' : 'Leave this draft?' }}</h2>
    <mat-dialog-content>
      <p>
        {{
          data.reload
            ? 'Your local edits will be discarded. Stay here if you need to review or copy them first.'
            : 'Some changes have not been confirmed as saved. Stay to keep editing, save first, or leave without saving your remaining changes.'
        }}
      </p>
      <p>A save already sent to the server may still finish.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close="stay" cdkFocusInitial>Stay here</button>
      <button mat-button mat-dialog-close="discard">
        {{ data.reload ? 'Discard edits and reload' : 'Leave without saving' }}
      </button>
      @if (data.canSave && !data.reload) {
        <button mat-flat-button mat-dialog-close="save">Save and leave</button>
      }
    </mat-dialog-actions>
  `,
})
export class DraftExitDialog {
  protected readonly data = inject<DraftExitData>(MAT_DIALOG_DATA);
}
