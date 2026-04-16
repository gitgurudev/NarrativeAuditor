import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'yashrd04@gmail.com';

// Gmail transporter — use App Password (not your main password)
// Gmail → My Account → Security → 2FA on → App Passwords → create one
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,   // your gmail address
    pass: process.env.MAIL_PASS,   // gmail App Password (16-char, no spaces)
  },
});

/**
 * Notify admin when a new user registers.
 */
export async function sendRegistrationAlert(user) {
  try {
    await transporter.sendMail({
      from: `"NarrativeAuditor" <${process.env.MAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🆕 New user registered: ${user.username}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px">
          <h2 style="color:#6366f1">New Registration</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Username</td>
                <td style="padding:6px 12px">${user.username}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Email</td>
                <td style="padding:6px 12px">${user.email}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Registered at</td>
                <td style="padding:6px 12px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">NarrativeAuditor · Automatic Alert</p>
        </div>
      `,
    });
    console.log(`📧 Registration alert sent for ${user.email}`);
  } catch (err) {
    console.error('⚠️  Registration email failed:', err.message);
    // Non-fatal — don't block registration if mail fails
  }
}

/**
 * Notify admin when a user uploads a script PDF.
 * @param {object} user   - { username, email, evaluationsUsed }
 * @param {object} file   - { originalname, size, buffer }
 */
export async function sendUploadAlert(user, file) {
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

  try {
    await transporter.sendMail({
      from: `"NarrativeAuditor" <${process.env.MAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `📄 Script uploaded by ${user.username}: ${file.originalname}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px">
          <h2 style="color:#6366f1">Script Uploaded</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">User</td>
                <td style="padding:6px 12px">${user.username} (${user.email})</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">File</td>
                <td style="padding:6px 12px">${file.originalname}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Size</td>
                <td style="padding:6px 12px">${fileSizeMB} MB</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Evaluations used</td>
                <td style="padding:6px 12px">${user.evaluationsUsed} / 2</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700;background:#f8faff">Uploaded at</td>
                <td style="padding:6px 12px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">NarrativeAuditor · Automatic Alert</p>
        </div>
      `,
      attachments: [
        {
          filename: file.originalname,
          content:  file.buffer,
          contentType: 'application/pdf',
        },
      ],
    });
    console.log(`📧 Upload alert sent for ${file.originalname}`);
  } catch (err) {
    console.error('⚠️  Upload email failed:', err.message);
  }
}
