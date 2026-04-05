import express from "express";
import path from "path";
import "dotenv/config";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// Initialize Firebase Admin
const initializeFirebaseAdmin = () => {
  // Check if any apps are already initialized
  if (admin.apps && admin.apps.length > 0) return;

  console.log("[DEBUG] Initializing Firebase Admin...");
  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    const googleCredsVar = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (serviceAccountVar) {
      console.log("[DEBUG] Found FIREBASE_SERVICE_ACCOUNT env var.");
      try {
        const serviceAccount = JSON.parse(serviceAccountVar);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized with service account.");
      } catch (parseErr) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseErr);
        // Try default initialization as fallback
        admin.initializeApp();
        console.log("Firebase Admin initialized with default credentials (fallback).");
      }
    } else if (googleCredsVar) {
      console.log("[DEBUG] Found GOOGLE_APPLICATION_CREDENTIALS env var.");
      admin.initializeApp();
      console.log("Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
    } else {
      console.log("[DEBUG] No explicit Firebase credentials found. Trying default initialization...");
      admin.initializeApp();
      console.log("Firebase Admin initialized with default credentials.");
    }
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
  }
};

// Call initialization immediately
initializeFirebaseAdmin();

// Simple in-memory store for OTPs (In production, use Redis or Firestore)
const emailOtps = new Map<string, { otp: string; expires: number }>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  console.log(`Starting server on port ${PORT}...`);

  // Ensure Admin is initialized before routes
  initializeFirebaseAdmin();

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // Create transporter once
  let transporter: nodemailer.Transporter | null = null;
  const getTransporter = async () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      transporter = nodemailer.createTransport({
        host: host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: user,
          pass: pass,
        },
      });
      console.log(`[DEBUG] Transporter initialized with SMTP: ${host}`);
      try {
        await transporter.verify();
        console.log("[DEBUG] SMTP connection verified successfully.");
      } catch (verifyErr) {
        console.error("[DEBUG] SMTP verification failed:", verifyErr);
      }
    } else {
      console.log("[DEBUG] No real SMTP config found. Falling back to Ethereal.");
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log(`[DEBUG] Transporter initialized with Ethereal test account: ${testAccount.user}`);
        try {
          await transporter.verify();
          console.log("[DEBUG] Ethereal connection verified successfully.");
        } catch (verifyErr) {
          console.error("[DEBUG] Ethereal verification failed:", verifyErr);
        }
        console.log(`[DEBUG] Ethereal Pass: ${testAccount.pass}`);
      } catch (etherealErr) {
        console.error("[DEBUG] Failed to create Ethereal account:", etherealErr);
        // Last resort: mock transporter that just logs
        transporter = {
          sendMail: async (options: any) => {
            console.log("MOCK EMAIL SENT:", options);
            return { messageId: "mock-id" };
          }
        } as any;
      }
    }
    return transporter;
  };

  // Endpoint to send Email OTP
  app.post("/api/send-email-otp", async (req, res) => {
    const { email: rawEmail } = req.body;
    if (!rawEmail) return res.status(400).json({ error: "Email is required" });

    const email = rawEmail.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    emailOtps.set(email, { otp, expires });
    console.log(`[DEBUG] OTP for ${email}: ${otp}`);

    try {
      const currentTransporter = await getTransporter();
      
      const mailOptions = {
        from: `"Zest Stay" <${process.env.SMTP_USER || "noreply@zeststay.com"}>`,
        to: email,
        subject: "Your OTP for Zest Stay",
        text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
        html: `<b>Your OTP is ${otp}</b>. It will expire in 10 minutes.`,
      };

      console.log(`[DEBUG] Attempting to send email to ${email}...`);
      let info;
      try {
        info = await currentTransporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);
      } catch (sendErr) {
        console.error("Error sending email via transporter:", sendErr);
        // Fallback: If in test mode, we can still proceed
        const isTestMode = !process.env.SMTP_HOST || process.env.SMTP_HOST.includes('ethereal');
        if (isTestMode) {
          console.log(`[DEBUG] SEND FAILED but in Test Mode. OTP for ${email}: ${otp}`);
          return res.json({ 
            success: true, 
            message: "OTP generated (Check server logs for details)"
          });
        }
        throw sendErr;
      }
      
      const isTestMode = !process.env.SMTP_HOST || process.env.SMTP_HOST.includes('ethereal');
      if (isTestMode) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("Preview URL: %s", previewUrl);
      }

      res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send OTP. Check server logs for details." });
    }
  });

  // Endpoint to verify Email OTP
  app.post("/api/verify-email-otp", async (req, res) => {
    const { email: rawEmail, otp } = req.body;
    if (!rawEmail || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const email = rawEmail.trim().toLowerCase();
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
      // Check if Firebase Admin is initialized
      if (!admin.apps || admin.apps.length === 0) {
        throw new Error("Firebase Admin not initialized. Check server logs.");
      }

      // Generate custom token for the user
      let uid: string;
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
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
      res.status(500).json({ error: "Failed to generate custom token. " + (error instanceof Error ? error.message : "") });
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
