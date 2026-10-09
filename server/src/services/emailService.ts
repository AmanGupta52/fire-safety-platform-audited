import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.email.mode === 'production' && env.email.host) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined,
      // Without these, nodemailer waits ~2 minutes for an unreachable SMTP server (e.g. a host that blocks
      // outbound SMTP ports), which used to hold the whole API request open for that long.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; info?: unknown }> {
  if (env.email.mode !== 'production' || !getTransporter()) {
    logger.info({ to, subject }, `[email:dev] Not sent (dev mode): "${subject}" -> ${to}`);
    logger.debug({ html }, '[email:dev] body');
    return { sent: true, info: 'logged-to-console' };
  }

  try {
    const info = await getTransporter()!.sendMail({ from: env.email.from, to, subject, html });
    return { sent: true, info };
  } catch (err) {
    const e = err as { message?: string; code?: string };
    // One readable line instead of a stack trace: a failed send is an expected, recoverable condition.
    logger.error(
      { to, subject, code: e.code },
      `[email] Failed to send "${subject}" to ${to}: ${e.message ?? 'unknown error'}${e.code ? ` (${e.code})` : ''}`
    );
    return { sent: false };
  }
}

/** Escapes text before it is placed inside HTML. Every dynamic value in a template goes through this. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links are allowed in emails (blocks javascript: and data: URLs), then attribute-escaped. */
export function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

const e = escapeHtml;

// Reusable, simple templates. Keep styling inline for maximum email-client compatibility.
// Every interpolated value is escaped: names, device strings and booking text can all be user-controlled.
export const emailTemplates = {
  welcome: (name: string) => `<h2>Welcome, ${e(name)}!</h2><p>Your fire-safety account has been created.</p>`,
  orderConfirmation: (orderNumber: string, total: number) =>
    `<h2>Order Confirmed</h2><p>Your order <b>${e(orderNumber)}</b> for ₹${total.toFixed(2)} has been received.</p>`,
  invoiceReady: (invoiceNumber: string, orderNumber: string, invoiceUrl: string, totalAmount: number) =>
    `<h2>Tax Invoice #${e(invoiceNumber)}</h2>
     <p>Dear Customer,</p>
     <p>Your GST Tax Invoice for order <b>${e(orderNumber)}</b> (Amount: ₹${totalAmount.toFixed(2)}) is now available.</p>
     <p style="margin: 20px 0;">
       <a href="${safeUrl(invoiceUrl)}" style="background-color: #c1272d; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
         Download GST Tax Invoice (PDF)
       </a>
     </p>
     <p>Includes complete GSTIN, HSN codes, and CGST/SGST/IGST breakdown.</p>`,
  serviceReportReady: (bookingNumber: string, serviceType: string, reportUrl: string) =>
    `<h2>Service Report & Certificate #${e(bookingNumber)}</h2>
     <p>Dear Customer,</p>
     <p>Your equipment service <b>${e(serviceType)}</b> has been completed by our certified technician.</p>
     <p style="margin: 20px 0;">
       <a href="${safeUrl(reportUrl)}" style="background-color: #2e7d4f; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
         View Service & Inspection Report (PDF)
       </a>
     </p>
     <p>This report includes before/after inspection photos, pressure readings, and the customer sign-off certificate.</p>`,
  orderStatus: (orderNumber: string, status: string) =>
    `<h2>Order Update</h2><p>Order <b>${e(orderNumber)}</b> status changed to <b>${e(status)}</b>.</p>`,
  quoteCreated: (quoteNumber: string) =>
    `<h2>Quotation Received</h2><p>Your quotation request <b>${e(quoteNumber)}</b> is being reviewed by our team.</p>`,
  serviceBooking: (bookingNumber: string, type: string) =>
    `<h2>Service Booking Confirmed</h2><p>Booking <b>${e(bookingNumber)}</b> (${e(type)}) has been received.</p>`,
  amcReminder: (planName: string, endDate: string) =>
    `<h2>AMC Reminder</h2><p>Your AMC plan <b>${e(planName)}</b> is due for renewal on <b>${e(endDate)}</b>.</p>`,
  refillReminder: (equipmentName: string, dueDate: string) =>
    `<h2>Refill Reminder</h2><p>Your equipment <b>${e(equipmentName)}</b> refill is due on <b>${e(dueDate)}</b>.</p>`,
  inspectionReminder: (equipmentName: string, dueDate: string) =>
    `<h2>Inspection Reminder</h2><p>Your equipment <b>${e(equipmentName)}</b> inspection is due on <b>${e(dueDate)}</b>.</p>`,
  passwordReset: (resetLink: string) =>
    `<h2>Reset Your Password</h2><p>Click <a href="${safeUrl(resetLink)}">here</a> to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  passwordChanged: () =>
    `<h2>Your password was changed</h2><p>This is a confirmation that your password was just reset. If this wasn't you, contact support immediately.</p>`,
  staffPasswordReset: (name: string) =>
    `<h2>Security Alert: Staff Account Password Reset</h2>
     <p>Hello ${e(name)},</p>
     <p>The password for your staff account was recently reset. All active sessions have been terminated for security.</p>
     <p>If you did not perform or authorize this change, please contact the Super Administrator immediately.</p>`,
  newDeviceLogin: (details: { name: string; ipAddress: string; userAgent: string; time: string; reason?: string }) =>
    `<h2>Security Alert: New Sign-in</h2>
     <p>Hello ${e(details.name)},</p>
     <p>We noticed a sign-in from ${e(details.reason || 'a device we have not seen before')}:</p>
     <ul>
       <li><b>Time:</b> ${e(details.time)}</li>
       <li><b>IP Address:</b> ${e(details.ipAddress)}</li>
       <li><b>Device / Browser:</b> ${e(details.userAgent)}</li>
     </ul>
     <p>If this was you, you can safely ignore this alert. If you do not recognize this activity, please reset your password immediately and contact support.</p>`,
  accountLocked: (details: { name: string; ipAddress: string; minutes: number }) =>
    `<h2>Security Alert: Account Temporarily Locked</h2>
     <p>Hello ${e(details.name)},</p>
     <p>Your account was locked for ${e(details.minutes)} minutes after a large number of incorrect password attempts from many different addresses (the most recent from <b>${e(details.ipAddress)}</b>). That pattern means someone is actively trying to break in.</p>
     <p>Reset your password now using "Forgot password"; that also clears the lock.</p>`,
  ipBlocked: (details: { name: string; ipAddress: string; minutes: number }) =>
    `<h2>Security Alert: Repeated Failed Sign-ins</h2>
     <p>Hello ${e(details.name)},</p>
     <p>Someone entered the wrong password for your account several times from IP address <b>${e(details.ipAddress)}</b>. That address is blocked from signing in to your account for ${e(details.minutes)} minutes. <b>You are not locked out</b>: you can still sign in normally from your own device.</p>
     <p>If this was not you, someone may be guessing your password. Reset it now using "Forgot password".</p>`,
  staffInviteSetPassword: (details: { name: string; role: string; setPasswordLink: string; expiresInHours: number }) =>
    `<h2>Welcome to Fire Safety Platform</h2>
     <p>Hello ${e(details.name)},</p>
     <p>A staff account has been created for you with the role: <b>${e(details.role)}</b>.</p>
     <p>To access the system, please set your password using the secure link below:</p>
     <p style="margin: 20px 0;"><a href="${safeUrl(details.setPasswordLink)}" style="background-color: #e11d48; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Set Your Password</a></p>
     <p>This link is one-time use and will expire in ${e(details.expiresInHours)} hours.</p>
     <p>If the button doesn't work, copy and paste this URL into your browser:</p>
     <p style="font-size: 12px; color: #64748b; word-break: break-all;">${e(details.setPasswordLink)}</p>`,
  otpVerification: (otp: string, minutesValid: number) =>
    `<h2>Verify your email</h2>
     <p>Your verification code is:</p>
     <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 12px 0;">${e(otp)}</p>
     <p>This code expires in ${e(minutesValid)} minutes. If you didn't request this, you can ignore this email.</p>`
};
