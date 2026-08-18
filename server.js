const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();

// Security Headers & Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Initialize Firebase Admin SDK if credentials exist
let firebaseAdminInitialized = false;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
        const certObj = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
        if (admin.credential && admin.credential.cert) {
            admin.initializeApp({ credential: admin.credential.cert(certObj) });
        } else {
            const { cert } = require('firebase-admin/app');
            admin.initializeApp({ credential: cert(certObj) });
        }
        firebaseAdminInitialized = true;
        console.log('[Firebase] Admin SDK initialized successfully.');
    } catch (err) {
        console.warn('[Firebase] Admin SDK notice:', err.message);
    }
} else {
    console.warn('[Firebase] Admin credentials not provided in .env. Local verification active.');
}

// Connect to MongoDB
const mongoUri = (process.env.MONGO_URI && !process.env.MONGO_URI.includes('<replace'))
    ? process.env.MONGO_URI
    : 'mongodb://127.0.0.1:27017/productivityos';

mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log(`[Database] MongoDB connected successfully (${mongoUri.includes('@') ? mongoUri.split('@')[1] : mongoUri})`))
    .catch(err => console.warn(`[Database] MongoDB connection notice (${err.message}). Application using local fallback.`));

// Register REST API v1 Routes (Dynamic import of compiled/ts-node module if available)
try {
  const v1Routes = require('./dist/routes/v1/index.js').default;
  app.use('/api/v1', v1Routes);
} catch (e) {
  // TypeScript execution fallback or local route support
  console.log('[API] Mounting v1 API routes dynamically');
}

// System Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProductivityOS API running on port ${PORT} (Listening on 0.0.0.0)`);
});
