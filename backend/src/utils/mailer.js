const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger');

/**
 * Single mailer that works with either provider, since both speak SMTP:
 *
 *  - Gmail:  EMAIL_PROVIDER=gmail,  EMAIL_USER=you@gmail.com, EMAIL_PASS=<16-char App Password>
 *            (Google Account -> Security -> 2-Step Verification -> App Passwords)
 *  - Resend: EMAIL_PROVIDER=resend, RESEND_API_KEY=re_xxx
 *            (Resend's SMTP relay accepts the API key as the SMTP password)
 *
 * Falls back to logging (dev-only) if no provider is configured, so local
 * development doesn't require real credentials.
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.email.provider === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.email.gmailUser, pass: env.email.gmailPass },
    });
  } else if (env.email.provider === 'resend') {
    transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: env.email.resendApiKey },
    });
  } else {
    logger.warn('No EMAIL_PROVIDER configured — emails will be logged instead of sent.');
    transporter = null;
  }

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();

  if (!t) {
    // Dev fallback only — production deployments should always have a
    // provider configured so this branch is never hit for real users.
    logger.warn(`[email disabled] Would send to ${to}: ${subject}`);
    logger.warn(text || html);
    return;
  }

  await t.sendMail({
    from: env.email.fromAddress,
    to,
    subject,
    text,
    html,
  });
}

function otpEmailTemplate(code, { title, intro }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif; background:#070B14; padding:40px 0;">
      <div style="max-width:420px; margin:0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
        border-radius:20px; padding:32px; color:#F5F7FF;">
        <h2 style="margin:0 0 8px; font-size:20px;">${title}</h2>
        <p style="color:rgba(245,247,255,0.65); font-size:14px; margin:0 0 24px;">${intro}</p>
        <div style="font-size:32px; font-weight:800; letter-spacing:8px; text-align:center;
          background:rgba(91,140,255,0.12); border:1px solid rgba(91,140,255,0.3); border-radius:14px; padding:18px 0; margin-bottom:20px;">
          ${code}
        </div>
        <p style="color:rgba(245,247,255,0.4); font-size:12.5px; margin:0;">This code expires shortly. If you didn't request it, you can safely ignore this email.</p>
      </div>
    </div>`;
}

async function sendVerificationEmail(to, code) {
  await sendEmail({
    to,
    subject: 'Verify your NovaChat email',
    html: otpEmailTemplate(code, {
      title: 'Verify your email',
      intro: 'Enter this code in NovaChat to verify your email address.',
    }),
    text: `Your NovaChat verification code is: ${code}`,
  });
}

async function sendOtpEmail(to, code) {
  await sendEmail({
    to,
    subject: 'Your NovaChat sign-in code',
    html: otpEmailTemplate(code, {
      title: 'Two-factor sign-in code',
      intro: 'Enter this code to finish signing in to NovaChat.',
    }),
    text: `Your NovaChat sign-in code is: ${code}`,
  });
}

async function sendPasswordResetEmail(to, resetToken) {
  const resetUrl = `${env.clientUrl}/auth.html?resetToken=${resetToken}`;
  await sendEmail({
    to,
    subject: 'Reset your NovaChat password',
    html: `
      <div style="font-family:Inter,Arial,sans-serif; background:#070B14; padding:40px 0;">
        <div style="max-width:420px; margin:0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
          border-radius:20px; padding:32px; color:#F5F7FF;">
          <h2 style="margin:0 0 8px; font-size:20px;">Reset your password</h2>
          <p style="color:rgba(245,247,255,0.65); font-size:14px; margin:0 0 24px;">Click below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block; background:linear-gradient(135deg,#5B8CFF,#8A5CFF); color:white;
            text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:600;">Reset password</a>
        </div>
      </div>`,
    text: `Reset your NovaChat password: ${resetUrl}`,
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendOtpEmail, sendPasswordResetEmail };
