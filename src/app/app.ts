import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [MatCardModule, MatToolbarModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('Merchant applications');
  protected readonly workflow = [
    {
      role: 'Sales',
      title: 'Prepare an application',
      description: 'Collect merchant information and submit an application for review.',
    },
    {
      role: 'Admin',
      title: 'Assign a reviewer',
      description: 'Coordinate assignments and keep track of applications across the team.',
    },
    {
      role: 'Reviewer',
      title: 'Record a decision',
      description: 'Assess assigned applications and record an approval or rejection.',
    },
  ];
}
