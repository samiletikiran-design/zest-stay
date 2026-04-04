import express from "express";
import path from "path";
import "dotenv/config";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", error);
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp();
  console.log("Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT not found. Custom token generation will fail.");
}

// Simple in-memory store for OTPs (In production, use Redis or Firestore)
const emailOtps = new Map<string, { otp: string; expires: number }>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  console.log(`Starting server on port ${PORT}...`);

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // Endpoint to send Email OTP
  app.post("/api/send-email-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    emailOtps.set(email, { otp, expires });

    try {
      // Use Ethereal for testing if no real SMTP config is provided
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || testAccount.user,
          pass: process.env.SMTP_PASS || testAccount.pass,
        },
      });

      const mailOptions = {
        from: `"Zest Stay" <${process.env.SMTP_USER || testAccount.user}>`,
        to: email,
        subject: "Your OTP for Zest Stay",
        text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
        html: `<b>Your OTP is ${otp}</b>. It will expire in 10 minutes.`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Message sent: %s", info.messageId);
      if (!process.env.SMTP_HOST) {
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      }

      res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Endpoint to verify Email OTP
  app.post("/api/verify-email-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const stored = emailOtps.get(email);
    if (!stored) return res.status(400).json({ error: "No OTP found for this email" });

    if (Date.now() > stored.expires) {
      emailOtps.delete(email);
      return res.status(400).json({ error: "OTP has expired" });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    emailOtps.delete(email);

    try {
      // Generate custom token for the user
      let uid: string;
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // For signup, we might want to create a temporary UID or handle it differently
          // But for now, we'll just create a new user if not found
          const userRecord = await admin.auth().createUser({ email });
          uid = userRecord.uid;
        } else {
          throw error;
        }
      }

      const customToken = await admin.auth().createCustomToken(uid);
      res.json({ success: true, token: customToken, message: "OTP verified successfully" });
    } catch (error) {
      console.error("Error generating custom token:", error);
      res.status(500).json({ error: "Failed to generate custom token" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite middleware for development...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from ${distPath} (production)`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
