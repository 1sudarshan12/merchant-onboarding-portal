import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../../../../shared/models';
import { AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

const user: User = {
  id: 'sales-1',
  name: 'Demo Sales 01',
  email: 'sales1@example.test',
  role: 'SALES',
};

async function renderLogin(query: Record<string, string> = {}) {
  const response = new Subject<User>();
  const auth = {
    user: signal<User | null>(null),
    isAuthenticated: signal(false),
    login: vi.fn(() => response.asObservable()),
    logout: vi.fn(),
  };
  await TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
      },
    ],
  }).compileComponents();
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Login);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const fill = (field: 'email' | 'password', value: string): void => {
    const input = page.querySelector<HTMLInputElement>(`input[formControlName="${field}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const submit = (): void => {
    page
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
  return { fixture, page, auth, response, navigate, fill, submit };
}

describe('Login', () => {
  it('shows field errors and never calls the API for an invalid form', async () => {
    const { fixture, page, auth, submit, fill } = await renderLogin();
    fill('email', 'not-an-email');
    submit();
    await fixture.whenStable();

    expect(auth.login).not.toHaveBeenCalled();
    expect(page.textContent).toContain('Enter a valid email address.');
    expect(page.textContent).toContain('Enter your password.');
  });

  it('retains entered values and shows a useful error after a wrong password', async () => {
    const { fixture, page, auth, response, navigate, fill, submit } = await renderLogin();
    fill('email', user.email);
    fill('password', 'wrong-password');
    submit();
    response.error(new HttpErrorResponse({ status: 401 }));
    await fixture.whenStable();

    expect(auth.login).toHaveBeenCalledWith({ email: user.email, password: 'wrong-password' });
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Email or password is incorrect',
    );
    expect(page.querySelector<HTMLInputElement>('[formControlName="password"]')?.value).toBe(
      'wrong-password',
    );
    expect(page.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends only one request while sign-in is pending', async () => {
    const { fixture, page, auth, response, fill, submit } = await renderLogin();
    fill('email', user.email);
    fill('password', 'Demo#1234');
    submit();
    submit();
    await fixture.whenStable();

    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(page.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(true);
    expect(page.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    response.complete();
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(false);
  });

  it('navigates to the safe return URL only after a successful login', async () => {
    const { fixture, response, navigate, fill, submit } = await renderLogin({
      returnUrl: '/overview',
    });
    fill('email', user.email);
    fill('password', 'Demo#1234');
    submit();
    expect(navigate).not.toHaveBeenCalled();
    response.next(user);
    response.complete();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/overview', { replaceUrl: true });
  });

  it('falls back to the workspace when a return URL points outside the application', async () => {
    const { fixture, response, navigate, fill, submit } = await renderLogin({
      returnUrl: 'https://untrusted.example.test',
    });
    fill('email', user.email);
    fill('password', 'Demo#1234');
    submit();
    response.next(user);
    response.complete();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/overview', { replaceUrl: true });
  });

  it('fills a demo account without submitting and supports an accessible password toggle', async () => {
    const { fixture, page, auth } = await renderLogin({ reason: 'expired' });
    page.querySelector<HTMLButtonElement>('[aria-label="Use Reviewer demo account"]')!.click();
    await fixture.whenStable();

    expect(page.querySelector<HTMLInputElement>('[formControlName="email"]')?.value).toBe(
      'reviewer1@example.test',
    );
    expect(page.querySelector<HTMLInputElement>('[formControlName="password"]')?.value).toBe(
      'Demo#1234',
    );
    expect(auth.login).not.toHaveBeenCalled();
    expect(page.textContent).toContain('Your session has expired.');

    page.querySelector<HTMLButtonElement>('[aria-label="Show password"]')!.click();
    await fixture.whenStable();
    expect(page.querySelector<HTMLInputElement>('[formControlName="password"]')?.type).toBe('text');
    expect(page.querySelector('[aria-label="Hide password"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(auth.login).not.toHaveBeenCalled();
  });
});
