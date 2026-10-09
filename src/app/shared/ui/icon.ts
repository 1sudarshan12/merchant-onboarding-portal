import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  'grid' | 'checklist' | 'arrow' | 'menu' | 'close' | 'shield' | 'document' | 'chevron' | 'check';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        }
        @case ('checklist') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <rect x="9" y="2" width="6" height="4" rx="1" />
          <path d="m8 11 1 1 2-2M13 11h3m-8 6 1 1 2-2m2 1h3" />
        }
        @case ('arrow') {
          <path d="M4 12h16m-6-6 6 6-6 6" />
        }
        @case ('menu') {
          <path d="M4 6h16M4 12h16M4 18h16" />
        }
        @case ('close') {
          <path d="m6 6 12 12M6 18 18 6" />
        }
        @case ('shield') {
          <path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z" />
          <path d="m8 12 3 3 5-6" />
        }
        @case ('document') {
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        }
        @case ('chevron') {
          <path d="m9 5 7 7-7 7" />
        }
        @case ('check') {
          <path d="m5 12 4 4L19 6" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
