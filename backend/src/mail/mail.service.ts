import { Injectable, Logger } from '@nestjs/common';

/**
 * MailService — DEV-MODE ONLY "console transport".
 *
 * There is no real SMTP server configured in this environment, so every
 * "send" here just logs a clearly-formatted message to the console and
 * resolves. No email is actually delivered anywhere.
 *
 * All outbound mail funnels through the single private `send()` method
 * below — that is intentional. When real SMTP credentials exist, swapping
 * in a production transport (e.g. `nodemailer`, installed as a new
 * dependency, configured from env vars such as SMTP_HOST/SMTP_PORT/
 * SMTP_USER/SMTP_PASS/SMTP_FROM) only requires rewriting the body of
 * `send()` — every call site above it (sendEmployeeInvite,
 * sendAdmissionApproved, etc.) stays untouched.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendEmployeeInvite(email: string, firstName: string, temporaryContext?: string): Promise<void> {
    const subject = 'Welcome to the team';
    const body = [
      `Hi ${firstName},`,
      '',
      'Your employee account has been created.',
      temporaryContext
        ? temporaryContext
        : 'An administrator has set up your login credentials. Please contact HR if you need your password reset.',
      '',
      'Welcome aboard!',
    ].join('\n');
    return this.send(email, subject, body);
  }

  async sendAdmissionApproved(email: string, applicantName: string, studentCode: string): Promise<void> {
    const subject = 'Your admission has been approved';
    const body = [
      `Dear ${applicantName},`,
      '',
      `Congratulations! Your admission application has been approved.`,
      `Your student code is: ${studentCode}`,
      '',
      'Please contact the school office for further enrollment steps.',
    ].join('\n');
    return this.send(email, subject, body);
  }

  async sendAdmissionRejected(email: string, applicantName: string, reviewNote?: string): Promise<void> {
    const subject = 'Update on your admission application';
    const body = [
      `Dear ${applicantName},`,
      '',
      'We regret to inform you that your admission application was not approved at this time.',
      reviewNote ? `Reviewer note: ${reviewNote}` : '',
      '',
      'Please contact the school office if you have any questions.',
    ]
      .filter(Boolean)
      .join('\n');
    return this.send(email, subject, body);
  }

  async sendTeacherApplicationApproved(email: string, fullName: string): Promise<void> {
    const subject = 'Your teacher application has been approved';
    const body = [
      `Dear ${fullName},`,
      '',
      'Congratulations! Your teacher application has been approved and a login account has been created for you.',
      'Please contact the administrator for your one-time login credentials.',
    ].join('\n');
    return this.send(email, subject, body);
  }

  async sendTeacherApplicationRejected(email: string, fullName: string, reviewNote?: string): Promise<void> {
    const subject = 'Update on your teacher application';
    const body = [
      `Dear ${fullName},`,
      '',
      'We regret to inform you that your teacher application was not approved at this time.',
      reviewNote ? `Reviewer note: ${reviewNote}` : '',
      '',
      'Please contact the school office if you have any questions.',
    ]
      .filter(Boolean)
      .join('\n');
    return this.send(email, subject, body);
  }

  /**
   * The ONE place that does the actual "transport" work. Dev-mode console
   * transport for now — logs and resolves. A production swap (real SMTP via
   * nodemailer + env-var config) only touches this method.
   */
  private async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[MAIL:dev-transport] To: ${to}\nSubject: ${subject}\nBody:\n${body}`);
    return Promise.resolve();
  }
}
