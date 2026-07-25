const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mongoose Schema for User Data
const UserDataSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    data: { type: Object, default: {} },
    lastUpdated: { type: Date, default: Date.now }
});
const UserData = mongoose.model('UserData', UserDataSchema);

// Connect to MongoDB
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('<replace')) {
    mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => console.log('MongoDB connected successfully'))
      .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('WARNING: MONGO_URI is not set in .env properly. MongoDB is NOT connected.');
}

// Authentication Middleware (Basic placeholder)
// For a production app, verify the Firebase JWT token here
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        // Note: For this MVP, we trust the UID passed via header for simplicity in setup.
        // You would use admin.auth().verifyIdToken(token) here if you set up the admin SDK.
        req.uid = req.headers['x-user-uid'];
        if (!req.uid) {
            return res.status(401).json({ error: 'Unauthorized: No UID provided' });
        }
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// GET user data
app.get('/api/sync', authenticate, async (req, res) => {
    try {
        const user = await UserData.findOne({ uid: req.uid });
        res.json({ success: true, data: user ? user.data : {} });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST sync user data
app.post('/api/sync', authenticate, async (req, res) => {
    try {
        const data = req.body;
        await UserData.findOneAndUpdate(
            { uid: req.uid },
            { data, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`ProductivityOS API running on port ${PORT}`);
});
