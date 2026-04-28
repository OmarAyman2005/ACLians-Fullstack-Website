// server/src/utils/sendEmail.js
import nodemailer from "nodemailer";

/**
 * Read config from EMAIL_* (preferred) or fallback to SMTP_*.
 * Works with Gmail App Passwords.
 */
function readMailConfig() {
  const get = (a, b) => process.env[a] ?? process.env[b];

  const host   = get("EMAIL_HOST", "SMTP_HOST") || "smtp.gmail.com";
  const port   = Number(get("EMAIL_PORT", "SMTP_PORT") || 587);
  const secure = (get("EMAIL_SECURE", "SMTP_SECURE") || "").toString() === "true" || port === 465;
  const user   = get("EMAIL_USER", "SMTP_USER");
  const pass   = get("EMAIL_PASS", "SMTP_PASS");
  const from   = get("EMAIL_FROM", "MAIL_FROM") || user;

  return { host, port, secure, auth: { user, pass }, from };
}

const cfg = readMailConfig();

// Create the transporter for Gmail (or any SMTP host)
export const transporter = nodemailer.createTransport({
  host: cfg.host,
  port: cfg.port,
  secure: cfg.secure,                 // true for 465, false for 587 (STARTTLS)
  auth: cfg.auth,
});

/** Optional: verify SMTP on boot (called from server.js) */
export async function verifySmtp() {
  try {
    await transporter.verify();
    console.log("[mail] SMTP OK:", cfg.host, cfg.port, cfg.secure ? "secure" : "starttls");
  } catch (err) {
    console.error("[mail] SMTP verify failed:", err.message);
  }
}

/** Send an email */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const info = await transporter.sendMail({
    from: cfg.from,          // Gmail requires the actual Gmail address in From
    to,
    subject,
    html,
    text,
    replyTo,
  });

  console.log(`[mail] sent to ${to} id=${info.messageId}`);
  return info;
}
