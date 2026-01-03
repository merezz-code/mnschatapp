const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Configuration Mailtrap
const transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  secure: false, 
  auth: {
    user: '197e4d191e8e9f',
    pass: '350d9f657975a9',
  },
});

app.post('/send-activation', async (req, res) => {
  const { toEmail, code } = req.body;
  try {
    await transporter.sendMail({
      from: '"MNS ChatApp" <no-reply@mnschatapp.com>',
      to: toEmail,
      subject: 'Code d’activation MNS ChatApp',
      html: `<h2>Votre code d’activation :</h2><p><b>${code}</b></p>`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log('Server started on port 3000'));
