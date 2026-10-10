/** Only existing workspace destinations can be used after login. Extend with new features. */
export function safeReturnUrl(value: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u001f]/.test(value)
  ) {
    return '/overview';
  }
  try {
    const url = new URL(value, 'https://merchant.invalid');
    if (url.origin === 'https://merchant.invalid' && url.pathname === '/overview') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Invalid or unknown destinations go to the workspace rather than a login loop.
  }
  return '/overview';
}
