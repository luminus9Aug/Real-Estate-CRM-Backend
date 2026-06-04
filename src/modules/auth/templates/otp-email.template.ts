export interface OtpEmailTemplateParams {
  name: string;
  otp: string;
  expiresInMinutes: number;
  appName: string;
  supportEmail: string;
}

export function getOtpEmailTemplate(params: OtpEmailTemplateParams): string {
  const { name, otp, expiresInMinutes, appName, supportEmail } = params;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #04060b;
          color: #f1f5f9;
        }
        .container {
          max-width: 580px;
          margin: 40px auto;
          background: #090e18;
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(37, 99, 235, 0.05);
        }
        .header {
          background: linear-gradient(135deg, #1e293b, #0f172a);
          padding: 30px;
          text-align: center;
          border-bottom: 1px solid rgba(59, 130, 246, 0.1);
        }
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #ffffff;
          font-size: 18px;
          text-decoration: none;
        }
        .logo-icon {
          width: 32px;
          height: 32px;
          background-color: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          display: inline-block;
          line-height: 32px;
          text-align: center;
          color: #3b82f6;
          font-weight: 900;
        }
        .logo-text {
          font-weight: 800;
        }
        .logo-sub {
          color: #64748b;
        }
        .content {
          padding: 40px 30px;
        }
        h1 {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }
        p {
          font-size: 14px;
          line-height: 1.6;
          color: #94a3b8;
          margin-top: 0;
          margin-bottom: 24px;
        }
        .otp-container {
          background-color: rgba(37, 99, 235, 0.05);
          border: 1px dashed rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #3b82f6;
          margin: 0;
          text-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
        }
        .expiry-text {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #f43f5e;
          margin-top: 8px;
          margin-bottom: 0;
        }
        .footer {
          padding: 30px;
          background: #060a12;
          border-top: 1px solid rgba(59, 130, 246, 0.05);
          text-align: center;
        }
        .footer p {
          font-size: 11px;
          color: #475569;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: bold;
        }
        .footer-links {
          margin-top: 12px;
        }
        .footer-link {
          color: #475569;
          text-decoration: none;
          font-size: 11px;
          font-weight: bold;
          margin: 0 10px;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: #3b82f6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">P</span>
            <span class="logo-text">${appName.replace(' OS', '')}<span class="logo-sub">OS</span></span>
          </div>
        </div>
        <div class="content">
          <h1>Hello, ${name}</h1>
          <p>We received a request to reset the password for your account on <strong>${appName}</strong>. Use the verification code below to proceed with setting up a new password:</p>
          
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
            <div class="expiry-text">Expires in ${expiresInMinutes} minutes</div>
          </div>
          
          <p>If you did not request a password reset, you can safely ignore this email. Your current password will remain secure.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 ${appName}. All rights reserved.</p>
          <div class="footer-links">
            <a href="mailto:${supportEmail}" class="footer-link">Contact Support</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
