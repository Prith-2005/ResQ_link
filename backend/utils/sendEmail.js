const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "qwhello12@gmail.com",
      pass: "vkbbdoxeqmwiewnq"
    }
  });

  await transporter.sendMail({
    from: "ResQLink <qwhello12@gmail.com>",
    to,
    subject,
    text
  });
};

module.exports = sendEmail;