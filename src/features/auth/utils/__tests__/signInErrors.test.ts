import { emailFormatError, signInErrorMessage } from '../signInErrors';

it('flags a missing or malformed email before calling the server', () => {
  expect(emailFormatError('')).toBe('Email is required');
  expect(emailFormatError('navin@')).toMatch(/valid email/);
  expect(emailFormatError('navin.indraj@yahoo')).toMatch(/valid email/);
  expect(emailFormatError(' navin@example.com ')).toBeNull();
});

it.each([
  [
    { message: 'Invalid login credentials', code: 'invalid_credentials' },
    /Incorrect email or password/,
  ],
  [{ message: 'Email not confirmed', code: 'email_not_confirmed' }, /not confirmed/],
  [{ message: 'Request rate limit reached', code: 'over_request_rate_limit' }, /Too many/],
  [new Error('Sign in timed out. Check your network connection.'), /internet connection/],
  [new TypeError('Network request failed'), /internet connection/],
  [new Error('something odd'), /Sign-in failed/],
])('maps %p', (err, expected) => {
  expect(signInErrorMessage(err)).toMatch(expected);
});

it('never reveals whether an account exists', () => {
  const msg = signInErrorMessage({ message: 'Invalid login credentials' });
  expect(msg).not.toMatch(/no account|not registered|does not exist/i);
});
