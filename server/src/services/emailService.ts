import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.email.mode === 'production' && env.email.host) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; info?: unknown }> {
  if (env.email.mode !== 'production' || !getTransporter()) {
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] Body:\n${html}\n`);
    return { sent: true, info: 'logged-to-console' };
  }

  try {
    const info = await getTransporter()!.sendMail({ from: env.email.from, to, subject, html });
    return { sent: true, info };
  } catch (err) {
    console.error('[email] send failed', err);
    return { sent: false };
  }
}

// Reusable, simple templates. Keep styling inline for maximum email-client compatibility.
export const emailTemplates = {
  welcome: (name: string) => `<h2>Welcome, ${name}!</h2><p>Your fire-safety account has been created.</p>`,
  orderConfirmation: (orderNumber: string, total: number) =>
    `<h2>Order Confirmed</h2><p>Your order <b>${orderNumber}</b> for ₹${total.toFixed(2)} has been received.</p>`,
  orderStatus: (orderNumber: string, status: string) =>
    `<h2>Order Update</h2><p>Order <b>${orderNumber}</b> status changed to <b>${status}</b>.</p>`,
  quoteCreated: (quoteNumber: string) =>
    `<h2>Quotation Received</h2><p>Your quotation request <b>${quoteNumber}</b> is being reviewed by our team.</p>`,
  serviceBooking: (bookingNumber: string, type: string) =>
    `<h2>Service Booking Confirmed</h2><p>Booking <b>${bookingNumber}</b> (${type}) has been received.</p>`,
  amcReminder: (planName: string, endDate: string) =>
    `<h2>AMC Reminder</h2><p>Your AMC plan <b>${planName}</b> is due for renewal on <b>${endDate}</b>.</p>`,
  refillReminder: (equipmentName: string, dueDate: string) =>
    `<h2>Refill Reminder</h2><p>Your equipment <b>${equipmentName}</b> refill is due on <b>${dueDate}</b>.</p>`,
  inspectionReminder: (equipmentName: string, dueDate: string) =>
    `<h2>Inspection Reminder</h2><p>Your equipment <b>${equipmentName}</b> inspection is due on <b>${dueDate}</b>.</p>`,
  passwordReset: (resetLink: string) =>
    `<h2>Reset Your Password</h2><p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  passwordChanged: () =>
    `<h2>Your password was changed</h2><p>This is a confirmation that your password was just reset. If this wasn't you, contact support immediately.</p>`,
  otpVerification: (otp: string, minutesValid: number) =>
    `<h2>Verify your email</h2>
     <p>Your verification code is:</p>
     <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 12px 0;">${otp}</p>
     <p>This code expires in ${minutesValid} minutes. If you didn't request this, you can ignore this email.</p>`
};
