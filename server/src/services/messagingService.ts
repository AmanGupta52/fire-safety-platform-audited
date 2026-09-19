import { env } from '../config/env';

/**
 * Provider-agnostic interfaces. In 'mock' mode (the default and the only mode that works
 * without a paid account) messages are logged instead of sent. Swap in a real provider
 * (e.g. Twilio, MSG91, Gupshup, Meta Cloud API) by implementing the same function signature
 * and switching SMS_MODE / WHATSAPP_MODE to 'live'.
 */

export async function sendSms(phone: string, message: string): Promise<{ sent: boolean; providerResponse?: string }> {
  if (env.sms.mode !== 'live' || !env.sms.apiKey) {
    console.log(`[sms:mock] To: ${phone} | Message: ${message}`);
    return { sent: true, providerResponse: 'mock-logged' };
  }

  // Real provider call would go here, e.g.:
  // const res = await fetch('https://api.sms-provider.example/send', { ... apiKey ... });
  console.warn('[sms] SMS_MODE=live but no provider integration wired up yet.');
  return { sent: false, providerResponse: 'no-provider-configured' };
}

export async function sendWhatsApp(phone: string, message: string): Promise<{ sent: boolean; providerResponse?: string }> {
  if (env.whatsapp.mode !== 'live' || !env.whatsapp.apiKey) {
    console.log(`[whatsapp:mock] To: ${phone} | Message: ${message}`);
    return { sent: true, providerResponse: 'mock-logged' };
  }

  console.warn('[whatsapp] WHATSAPP_MODE=live but no provider integration wired up yet.');
  return { sent: false, providerResponse: 'no-provider-configured' };
}
