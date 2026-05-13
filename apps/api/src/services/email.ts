import { createTransport, type Transporter } from "nodemailer";
import { env } from "../env";
import { logger } from "../lib/logger";
import { verificationEmail } from "../emails/verification";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export const emailService = {
  async sendVerification(to: string, verifyLink: string): Promise<void> {
    const { subject, html, text } = verificationEmail(verifyLink);
    const result = await getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    logger.info({ to, messageId: result.messageId }, "verification email sent");
  },
};
