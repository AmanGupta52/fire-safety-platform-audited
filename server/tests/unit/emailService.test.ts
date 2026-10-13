import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../src/config/env';
import { sendEmail, emailConfigProblem, parseFrom, isEmailConfigured } from '../../src/services/emailService';

const original = JSON.parse(JSON.stringify({ email: env.email, nodeEnv: env.nodeEnv }));

function configureEmailJs() {
  env.email.mode = 'production';
  env.email.provider = 'emailjs';
  env.email.from = 'AK Fire Safety <no-reply@akfire.test>';
  env.email.emailjs = { serviceId: 'service_x', templateId: 'template_y', publicKey: 'pub_key', privateKey: 'priv_key' };
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => {
  Object.assign(env.email, original.email);
  env.nodeEnv = original.nodeEnv;
  vi.unstubAllGlobals();
});

describe('sendEmail via EmailJS', () => {
  it('posts to the EmailJS REST API with the ids, keys and template params the template needs', async () => {
    configureEmailJs();
    const fetchMock = vi.fn(async () => new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail('customer@example.com', 'Verify your email', '<p>Code <b>123456</b></p>');

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      service_id: 'service_x',
      template_id: 'template_y',
      user_id: 'pub_key',
      accessToken: 'priv_key',
      template_params: {
        to_email: 'customer@example.com',
        subject: 'Verify your email',
        message_html: '<p>Code <b>123456</b></p>',
        from_name: 'AK Fire Safety',
        reply_to: 'no-reply@akfire.test'
      }
    });
  });

  it('reports a refused request (for example HTTP 403 when non-browser API calls are disabled) as sent:false, never as a throw', async () => {
    configureEmailJs();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('API calls are disabled for non-browser applications', { status: 403 })));
    await expect(sendEmail('a@b.com', 's', '<p>x</p>')).resolves.toEqual({ sent: false });
  });

  it('reports a network failure or timeout as sent:false', async () => {
    configureEmailJs();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
    await expect(sendEmail('a@b.com', 's', '<p>x</p>')).resolves.toEqual({ sent: false });
  });

  it('does not call EmailJS at all in development mode: the email is only logged', async () => {
    configureEmailJs();
    env.email.mode = 'development';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await sendEmail('a@b.com', 's', '<p>x</p>')).sent).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isEmailConfigured()).toBe(false);
  });

  it('does not call EmailJS when a key is missing, and says which one', async () => {
    configureEmailJs();
    env.email.emailjs.privateKey = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await sendEmail('a@b.com', 's', '<p>x</p>');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(emailConfigProblem()).toBe('EMAIL_PROVIDER=emailjs but these are not set: EMAILJS_PRIVATE_KEY');
  });
});

describe('emailConfigProblem (startup diagnostics)', () => {
  it('is null for a complete EmailJS setup and for plain local development', () => {
    configureEmailJs();
    expect(emailConfigProblem()).toBeNull();
    expect(isEmailConfigured()).toBe(true);
    env.email.mode = 'development';
    env.nodeEnv = 'development';
    expect(emailConfigProblem()).toBeNull();
  });

  it('warns when a production deployment leaves EMAIL_MODE on development (emails would only be printed)', () => {
    env.email.mode = 'development';
    env.nodeEnv = 'production';
    expect(emailConfigProblem()).toContain('EMAIL_MODE is not "production"');
  });

  it('lists every missing EmailJS variable', () => {
    configureEmailJs();
    env.email.emailjs = { serviceId: '', templateId: '', publicKey: 'pub', privateKey: '' };
    expect(emailConfigProblem()).toBe('EMAIL_PROVIDER=emailjs but these are not set: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PRIVATE_KEY');
  });

  it('checks the other providers too', () => {
    env.email.mode = 'production';
    env.email.provider = 'smtp'; env.email.host = '';
    expect(emailConfigProblem()).toContain('EMAIL_HOST');
    env.email.provider = 'brevo'; env.email.apiKey = '';
    expect(emailConfigProblem()).toContain('EMAIL_API_KEY');
    env.email.apiKey = 'k';
    expect(emailConfigProblem()).toBeNull();
  });
});

describe('parseFrom', () => {
  it('splits a display name from the address', () => {
    expect(parseFrom('AK Fire Safety <no-reply@akfire.test>')).toEqual({ name: 'AK Fire Safety', email: 'no-reply@akfire.test' });
    expect(parseFrom('AK Fire Safety no-reply@akfire.test')).toEqual({ name: 'AK Fire Safety', email: 'no-reply@akfire.test' });
    expect(parseFrom('no-reply@akfire.test')).toEqual({ name: undefined, email: 'no-reply@akfire.test' });
  });
});
