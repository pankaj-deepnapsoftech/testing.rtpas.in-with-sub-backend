const nodemailer = require("nodemailer");
require("dotenv").config({ path: `.env.development` });

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.EMAIL_PASSWORD,
  },
});

exports.sendEmail = async (sub, msg, recipientEmail) => {
  const mailOptions = {
    from: process.env.EMAIL_ID,
    to: recipientEmail,
    subject: sub,
    html: `
        <html>
          <body>
            ${msg}
          </body> 
        </html>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
  }
};
