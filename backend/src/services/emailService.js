import nodemailer from 'nodemailer';

/**
 * Institutional Email Notification Service for ActivityTracker RCPIT
 * Handles transactional approval emails via Nodemailer and Gmail / SMTP configuration.
 */

const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  // Use service: 'gmail' for Gmail/Google Workspace or host config
  if (process.env.EMAIL_SERVICE === 'gmail' || user.endsWith('@gmail.com') || !process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
};

/**
 * Startup SMTP Connection Verification
 * Tests transporter connection without exposing credentials.
 * @returns {Promise<Boolean>}
 */
export const verifyEmailConnection = async () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    console.log(`[Email Service] EMAIL SERVICE NOT CONFIGURED (EMAIL_USER / EMAIL_PASSWORD missing in backend/.env)`);
    return false;
  }

  console.log(`[Email Service] SMTP configuration detected for account: ${user}`);
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    await transporter.verify();
    console.log(`[Email Service] SMTP connection verified successfully.`);
    return true;
  } catch (err) {
    let safeMsg = err.message;
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      safeMsg = 'Authentication failed (Invalid EMAIL_USER or Google App Password).';
    }
    console.error(`[Email Service] SMTP connection failed: ${safeMsg}`);
    return false;
  }
};

/**
 * Sends Official Account Provisioned Notification Email to Faculty
 * @param {Object} options
 * @param {String} options.recipientEmail
 * @param {String} options.facultyName
 * @param {String} options.employeeId
 * @param {String} options.initialPassword
 * @param {String} options.departmentName
 * @returns {Promise<{ success: Boolean, messageId?: String, error?: String }>}
 */
export const sendFacultyAccountCreatedEmail = async ({
  recipientEmail,
  facultyName,
  employeeId,
  initialPassword,
  departmentName
}) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`[Email Service] EMAIL SERVICE NOT CONFIGURED. Skipping account provision email to ${recipientEmail}.`);
      return { success: false, error: 'EMAIL_SERVICE_NOT_CONFIGURED' };
    }

    const fromAddress = process.env.EMAIL_FROM
      ? `"${process.env.EMAIL_FROM.replace(/"/g, '')}" <${process.env.EMAIL_USER}>`
      : `"ActivityTracker RCPIT" <${process.env.EMAIL_USER}>`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #091e42; padding: 15px 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">R. C. Patel Institute of Technology</h2>
          <p style="color: #3695fa; margin: 5px 0 0 0; font-size: 13px;">ActivityTracker RCPIT — Official Institutional Portal</p>
        </div>

        <div style="padding: 25px 20px; color: #172b4d;">
          <h3 style="color: #0c75eb; margin-top: 0;">Faculty Account Provisioned!</h3>
          <p>Dear <strong>${facultyName}</strong>,</p>
          <p>Welcome to ActivityTracker RCPIT!</p>
          <p>Your official faculty account has been provisioned by RCPIT System Administration for the department of <strong>${departmentName}</strong>.</p>
          
          <div style="background-color: #f4f5f7; border-left: 4px solid #0c75eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #5e6c84; font-weight: bold; text-transform: uppercase;">Official Employee / Faculty ID</p>
            <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: bold; color: #091e42; font-family: monospace;">${employeeId}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
            <tr>
              <td style="padding: 8px 0; color: #5e6c84; font-weight: bold;">Official Email:</td>
              <td style="padding: 8px 0; font-weight: bold;">${recipientEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #5e6c84; font-weight: bold;">Department:</td>
              <td style="padding: 8px 0; font-weight: bold;">${departmentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #5e6c84; font-weight: bold;">Initial Password:</td>
              <td style="padding: 8px 0; font-family: monospace;">${initialPassword}</td>
            </tr>
          </table>

          <p style="margin-top: 25px; font-size: 13px;">You can now log in using either your Official Employee ID (<strong>${employeeId}</strong>) or Institutional Email and password to manage departmental activities.</p>
        </div>

        <div style="background-color: #fafbfc; padding: 12px 20px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #ebecf0; font-size: 11px; color: #7a869a;">
          <p style="margin: 0;">Regards,</p>
          <p style="margin: 3px 0 0 0; font-weight: bold;">ActivityTracker RCPIT</p>
          <p style="margin: 2px 0 0 0;">R. C. Patel Institute of Technology, Shirpur</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: 'ActivityTracker RCPIT - Faculty Account Provisioned',
      html: htmlContent
    });

    console.log(`[Email Service] Account provisioned email sent to ${recipientEmail} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service] Account provisioned email failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};

export const sendFacultyApprovalEmail = sendFacultyAccountCreatedEmail;

