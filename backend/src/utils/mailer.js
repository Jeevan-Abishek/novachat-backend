const env = require('../config/env');
const logger = require('./logger');

/**
 * Sends email via Resend's HTTPS REST API (not SMTP).
 *
 * Why: Render (like many hosts) blocks or heavily throttles outbound SMTP
 * connections (ports 25/465/587) for spam prevention, which is what caused
 * the "Connection timeout" errors when this used Gmail/Resend over SMTP.
 * The HTTP API goes out over plain HTTPS (port 443), which is never
 * blocked, and needs no extra dependency since Node 20 has global fetch.
 *
 * Setup: sign up at https://resend.com (free tier), grab an API key from
 * the dashboard, and set RESEND_API_KEY. For testing without a verified
 * domain, Resend lets you send from 'onboarding@resend.dev' to your own
 * account email only; verify a domain in Resend to send to real users.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = env.email?.resendApiKey;

  if (!apiKey) {
    logger.warn(`RESEND_API_KEY not set — email NOT sent. To: ${to} | Subject: ${subject}`);
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.email.fromAddress,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Resend API error (${res.status})`);
  }
}

function otpEmailHtml(code, heading = 'Your NovaChat verification code') {
  return `
    <div style="font-family:Inter,Arial,sans-serif; background:#070B14; padding:32px; color:#F5F7FF;">
      <div style="max-width:420px; margin:0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:32px; text-align:center;">
        <div style="font-weight:800; font-size:18px; margin-bottom:20px;">NovaChat</div>
        <p style="font-size:14px; color:rgba(245,247,255,0.7); margin-bottom:18px;">${heading}</p>
        <div style="font-size:32px; font-weight:800; letter-spacing:8px; color:#5B8CFF; margin-bottom:18px;">${code}</div>
        <p style="font-size:12.5px; color:rgba(245,247,255,0.45);">This code expires shortly. If you didn't request this, you can ignore this email.</p>
      </div>
    </div>`;
}

async function sendVerificationEmail(to, code) {
  try {
    await sendEmail({
      to,
      subject: 'Verify your NovaChat email',
      html: otpEmailHtml(code, 'Confirm your email address'),
      text: `Your NovaChat email verification code is ${code}`,
    });
  } catch (err) {
    logger.error(`Failed to send verification email to ${to}: ${err.message}`);
    throw err;
  }
}

async function sendOtpEmail(to, code) {
  try {
    await sendEmail({
      to,
      subject: 'Your NovaChat sign-in code',
      html: otpEmailHtml(code, 'Your one-time sign-in code'),
      text: `Your NovaChat sign-in code is ${code}`,
    });
  } catch (err) {
    logger.error(`Failed to send OTP email to ${to}: ${err.message}`);
    throw err;
  }
}

async function sendPasswordResetEmail(to, resetToken) {
  const resetUrl = `${env.clientUrl}/auth.html?resetToken=${resetToken}`;
  try {
    await sendEmail({
      to,
      subject: 'Reset your NovaChat password',
      html: `
        <div style="font-family:Inter,Arial,sans-serif; background:#070B14; padding:32px; color:#F5F7FF;">
          <div style="max-width:420px; margin:0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:32px; text-align:center;">
            <div style="font-weight:800; font-size:18px; margin-bottom:20px;">NovaChat</div>
            <p style="font-size:14px; color:rgba(245,247,255,0.7); margin-bottom:22px;">Click below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block; background:linear-gradient(135deg,#5B8CFF,#8A5CFF); color:white; text-decoration:none; font-weight:700; padding:12px 24px; border-radius:14px;">Reset password</a>
          </div>
        </div>`,
      text: `Reset your NovaChat password: ${resetUrl}`,
    });
  } catch (err) {
    logger.error(`Failed to send password reset email to ${to}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendEmail, sendVerificationEmail, sendOtpEmail, sendPasswordResetEmail };
