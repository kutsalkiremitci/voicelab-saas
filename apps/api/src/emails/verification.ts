export function verificationEmail(verifyLink: string): { subject: string; html: string; text: string } {
  const subject = "Verify your VoiceLab email";
  const text = `Welcome to VoiceLab.

Confirm your email to activate your account and receive 1,000 free credits:

${verifyLink}

This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.

— The VoiceLab team`;

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #111;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">Welcome to VoiceLab</h1>
    <p style="font-size: 15px; line-height: 1.6;">Confirm your email to activate your account and receive 1,000 free credits.</p>
    <p style="margin: 28px 0;">
      <a href="${verifyLink}" style="background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify email</a>
    </p>
    <p style="font-size: 13px; color: #555; line-height: 1.6;">Or paste this link in your browser:<br><code style="word-break: break-all;">${verifyLink}</code></p>
    <p style="font-size: 13px; color: #777; margin-top: 32px;">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>
  </body>
</html>`;

  return { subject, html, text };
}
