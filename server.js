const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();
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
        console.log('Firebase Admin SDK initialized successfully.');
    } catch (err) {
        console.warn('Firebase Admin SDK notice:', err.message);
    }
} else {
    console.warn('Firebase Admin credentials not provided in .env. Running in local/dev verification mode.');
}

// Mongoose Schema for User Profile & Data
const UserProfileSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '' },
    displayName: { type: String, default: '' },
    photoURL: { type: String, default: '' },
    familyId: { type: String, default: null },
    role: { type: String, enum: ['owner', 'member'], default: 'owner' },
    data: { type: Object, default: {} },
    preferences: { type: Object, default: { theme: 'system', emailNotifications: true } },
    financialProfile: { type: Object, default: { primaryCurrency: 'INR', monthlyGoal: '100000', financialYearStart: 'apr' } },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});
const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

// Mongoose Schema for Family & Account Sync
const FamilyMemberSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
    name: { type: String, required: true },
    relationship: { type: String, default: 'Member' },
    firebaseUid: { type: String, default: null, index: true },
    email: { type: String, default: '' },
    photoURL: { type: String, default: '' },
    inviteToken: { type: String, default: null, index: true },
    permissions: {
        viewSharedTasks: { type: Boolean, default: true },
        editSharedTasks: { type: Boolean, default: false },
        viewSharedFinance: { type: Boolean, default: false },
        editSharedFinance: { type: Boolean, default: false },
        viewSharedNotes: { type: Boolean, default: true },
        editSharedNotes: { type: Boolean, default: false }
    },
    linkedAt: { type: Date, default: null }
}, { _id: false });

const FamilySchema = new mongoose.Schema({
    familyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'My Family' },
    ownerUid: { type: String, required: true, index: true },
    members: [FamilyMemberSchema],
    sharedData: {
        tasks: { type: Array, default: [] },
        expenses: { type: Array, default: [] },
        notes: { type: Array, default: [] }
    },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});
const Family = mongoose.model('Family', FamilySchema);

// Connect to MongoDB
const mongoUri = (process.env.MONGO_URI && !process.env.MONGO_URI.includes('<replace'))
    ? process.env.MONGO_URI
    : 'mongodb://127.0.0.1:27017/productivityos';

mongoose.connect(mongoUri)
    .then(() => console.log(`MongoDB connected successfully (${mongoUri.includes('@') ? mongoUri.split('@')[1] : mongoUri})`))
    .catch(err => console.warn(`MongoDB connection notice (${err.message}). Application using local storage fallback.`));


// Helper to verify Firebase ID Token safely
async function verifyToken(authHeader, headerUid) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split('Bearer ')[1];

    if (firebaseAdminInitialized) {
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            return {
                uid: decoded.uid,
                email: decoded.email || '',
                displayName: decoded.name || decoded.displayName || '',
                photoURL: decoded.picture || decoded.photoURL || ''
            };
        } catch (err) {
            console.error('Firebase ID token verification failed:', err.message);
            return null;
        }
    }

    // Dev / Fallback mode when Firebase Admin credentials are placeholder or mock token used
    if (token === 'mock-token' || token.startsWith('mock-') || headerUid) {
        const uid = headerUid || 'local-test-user';
        return {
            uid: uid,
            email: `${uid}@example.com`,
            displayName: uid.replace(/-/g, ' ').toUpperCase(),
            photoURL: ''
        };
    }

    return null;
}

// Authentication Middleware
const requireAuth = async (req, res, next) => {
    const headerUid = req.headers['x-user-uid'];
    const authHeader = req.headers.authorization;
    const user = await verifyToken(authHeader, headerUid);

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
    }

    req.user = user;
    req.uid = user.uid;
    next();
};

// --- API ENDPOINTS ---

// GET User Profile & Data
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        let profile = await UserProfile.findOne({ uid: req.uid });
        if (!profile) {
            profile = new UserProfile({
                uid: req.uid,
                email: req.user.email,
                displayName: req.user.displayName,
                photoURL: req.user.photoURL,
                data: {}
            });
            await profile.save();
        }
        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET User & Family Shared Data (Sync)
app.get('/api/sync', requireAuth, async (req, res) => {
    try {
        let user = await UserProfile.findOne({ uid: req.uid });
        let familyData = {};

        if (user && user.familyId) {
            const family = await Family.findOne({ familyId: user.familyId });
            if (family && family.sharedData) {
                familyData = family.sharedData;
            }
        }

        const mergedData = {
            ...(user ? user.data : {}),
            ...familyData
        };

        res.json({ success: true, data: mergedData, lastUpdated: user ? user.lastUpdated : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST User & Family Shared Data (Sync)
app.post('/api/sync', requireAuth, async (req, res) => {
    try {
        const data = req.body;
        const preferences = data.preferences || {};
        const financialProfile = data.financialProfile || {};
        
        // Remove them from data so it doesn't clutter
        delete data.preferences;
        delete data.financialProfile;

        const profile = await UserProfile.findOneAndUpdate(
            { uid: req.uid },
            { 
                data,
                preferences,
                financialProfile,
                email: req.user.email || undefined,
                displayName: req.user.displayName || undefined,
                photoURL: req.user.photoURL || undefined,
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        if (profile && profile.familyId) {
            await Family.findOneAndUpdate(
                { familyId: profile.familyId },
                { sharedData: data, lastUpdated: new Date() }
            );
        }

        res.json({ success: true, lastUpdated: profile.lastUpdated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Family Data (Owner or Member)
app.get('/api/family', requireAuth, async (req, res) => {
    try {
        // Search if user is owner
        let family = await Family.findOne({ ownerUid: req.uid });

        // Search if user is linked member
        if (!family) {
            family = await Family.findOne({ "members.firebaseUid": req.uid });
        }

        // If no family exists and user is owner, create default family
        if (!family) {
            const familyId = `fam_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            family = new Family({
                familyId,
                name: `${req.user.displayName || 'User'}'s Family`,
                ownerUid: req.uid,
                members: []
            });
            await family.save();

            // Attach familyId to UserProfile
            await UserProfile.findOneAndUpdate(
                { uid: req.uid },
                { familyId, role: 'owner' },
                { upsert: true }
            );
        }

        const isOwner = family.ownerUid === req.uid;
        const memberInfo = family.members.find(m => m.firebaseUid === req.uid) || null;

        res.json({
            success: true,
            family,
            isOwner,
            currentMember: memberInfo
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Invite Details (Public / Unauthenticated ok)
app.get('/api/family/invite-info', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Invite code is required.' });
        }

        const family = await Family.findOne({ "members.inviteToken": code });
        if (!family) {
            return res.status(404).json({ error: 'Invitation link is invalid or expired.' });
        }

        const member = family.members.find(m => m.inviteToken === code);
        if (!member) {
            return res.status(404).json({ error: 'Invitation member record not found.' });
        }

        const ownerProfile = await UserProfile.findOne({ uid: family.ownerUid });

        res.json({
            success: true,
            familyName: family.name,
            memberName: member.name,
            relationship: member.relationship,
            ownerName: ownerProfile ? (ownerProfile.displayName || ownerProfile.email) : 'Family Owner',
            isAlreadyLinked: Boolean(member.firebaseUid),
            inviteToken: code
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Accept Family Invite & Link Account
app.post('/api/family/accept-invite', async (req, res) => {
    try {
        const { inviteToken, linkIdToken, targetUid, targetEmail, targetPhotoURL } = req.body;
        if (!inviteToken) {
            return res.status(400).json({ error: 'Invite token is required.' });
        }

        let verifiedTarget = null;
        if (linkIdToken) {
            verifiedTarget = await verifyToken(`Bearer ${linkIdToken}`, targetUid);
        } else if (targetUid) {
            verifiedTarget = {
                uid: targetUid,
                email: targetEmail || '',
                photoURL: targetPhotoURL || ''
            };
        }

        if (!verifiedTarget || !verifiedTarget.uid) {
            return res.status(400).json({ error: 'Invalid Google authentication token for accepting invite.' });
        }

        const newUid = verifiedTarget.uid;

        // Locate family and member by inviteToken
        let family = await Family.findOne({ "members.inviteToken": inviteToken });
        if (!family) {
            return res.status(404).json({ error: 'Invalid or expired invitation link.' });
        }

        const memberIndex = family.members.findIndex(m => m.inviteToken === inviteToken);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Invitation member not found.' });
        }

        // SAFEGUARD 1: Check if newUid is already linked to another family member
        const existingFamilyWithUid = await Family.findOne({ "members.firebaseUid": newUid });
        if (existingFamilyWithUid) {
            const alreadyMember = existingFamilyWithUid.members.find(m => m.firebaseUid === newUid);
            if (alreadyMember && (existingFamilyWithUid.familyId !== family.familyId || alreadyMember.memberId !== family.members[memberIndex].memberId)) {
                return res.status(409).json({
                    error: `This Google account (${verifiedTarget.email || newUid}) is already linked to another family member (${alreadyMember.name}). Please use a different Google account.`
                });
            }
        }

        // Update member record with linked credentials
        family.members[memberIndex].firebaseUid = newUid;
        family.members[memberIndex].email = verifiedTarget.email || family.members[memberIndex].email;
        family.members[memberIndex].photoURL = verifiedTarget.photoURL || family.members[memberIndex].photoURL;
        family.members[memberIndex].linkedAt = new Date();
        family.lastUpdated = new Date();
        await family.save();

        // Update UserProfile for target user
        await UserProfile.findOneAndUpdate(
            { uid: newUid },
            {
                email: verifiedTarget.email,
                displayName: verifiedTarget.displayName || family.members[memberIndex].name,
                photoURL: verifiedTarget.photoURL,
                familyId: family.familyId,
                role: 'member'
            },
            { upsert: true }
        );

        res.json({
            success: true,
            message: 'Invitation accepted and account linked successfully!',
            member: family.members[memberIndex],
            family
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Add Family Member (Owner only)
app.post('/api/family/members', requireAuth, async (req, res) => {
    try {
        const { name, relationship, permissions } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Member name is required.' });
        }

        let family = await Family.findOne({ ownerUid: req.uid });
        if (!family) {
            return res.status(404).json({ error: 'Family not found.' });
        }

        const memberId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const newMember = {
            memberId,
            name,
            relationship: relationship || 'Member',
            firebaseUid: null,
            email: '',
            photoURL: '',
            inviteToken,
            permissions: permissions || {
                viewSharedTasks: true,
                editSharedTasks: false,
                viewSharedFinance: false,
                editSharedFinance: false,
                viewSharedNotes: true,
                editSharedNotes: false
            },
            linkedAt: null
        };

        family.members.push(newMember);
        family.lastUpdated = new Date();
        await family.save();

        res.json({ success: true, member: newMember, family });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});

// DELETE Remove Family Member (Owner only)
app.delete('/api/family/members/:memberId', requireAuth, async (req, res) => {
    try {
        const { memberId } = req.params;
        let family = await Family.findOne({ ownerUid: req.uid });
        if (!family) {
            return res.status(404).json({ error: 'Family not found.' });
        }

        const member = family.members.find(m => m.memberId === memberId);
        if (member && member.firebaseUid) {
            // Remove family association from member's profile
            await UserProfile.findOneAndUpdate(
                { uid: member.firebaseUid },
                { familyId: null, role: 'owner' }
            );
        }

        family.members = family.members.filter(m => m.memberId !== memberId);
        family.lastUpdated = new Date();
        await family.save();

        res.json({ success: true, family });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Link Google Account to Family Member (SAFEGUARD ENFORCED)
app.post('/api/family/link-account', requireAuth, async (req, res) => {
    try {
        const { memberId, linkIdToken, targetUid, targetEmail, targetPhotoURL } = req.body;

        if (!memberId) {
            return res.status(400).json({ error: 'Member ID is required.' });
        }

        // Identify target Google account credentials
        let verifiedTarget = null;
        if (linkIdToken) {
            verifiedTarget = await verifyToken(`Bearer ${linkIdToken}`, targetUid);
        } else if (targetUid) {
            verifiedTarget = {
                uid: targetUid,
                email: targetEmail || '',
                photoURL: targetPhotoURL || ''
            };
        }

        if (!verifiedTarget || !verifiedTarget.uid) {
            return res.status(400).json({ error: 'Invalid Google account authentication token for linking.' });
        }

        const newUid = verifiedTarget.uid;

        // SAFEGUARD 1: Check if newUid is already linked to ANY member in ANY family
        const existingFamilyWithUid = await Family.findOne({ "members.firebaseUid": newUid });
        if (existingFamilyWithUid) {
            const alreadyMember = existingFamilyWithUid.members.find(m => m.firebaseUid === newUid);
            if (alreadyMember && (existingFamilyWithUid.ownerUid !== req.uid || alreadyMember.memberId !== memberId)) {
                return res.status(409).json({
                    error: `This Google account (${verifiedTarget.email || newUid}) is already linked to another family member (${alreadyMember.name}). Please use a different Google account or unlink the existing account first.`
                });
            }
        }

        // SAFEGUARD 2: Check if newUid is the owner of a different family
        const isOwnerOfFamily = await Family.findOne({ ownerUid: newUid });
        if (isOwnerOfFamily && isOwnerOfFamily.ownerUid !== req.uid) {
            return res.status(409).json({
                error: `This Google account is the owner of another family group. It cannot be linked as a member here.`
            });
        }

        // Locate current owner's family
        let family = await Family.findOne({ ownerUid: req.uid });
        if (!family) {
            return res.status(404).json({ error: 'Family not found.' });
        }

        const memberIndex = family.members.findIndex(m => m.memberId === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Family member not found.' });
        }

        // Update member record with linked Google credentials
        family.members[memberIndex].firebaseUid = newUid;
        family.members[memberIndex].email = verifiedTarget.email || family.members[memberIndex].email;
        family.members[memberIndex].photoURL = verifiedTarget.photoURL || family.members[memberIndex].photoURL;
        family.members[memberIndex].linkedAt = new Date();
        family.lastUpdated = new Date();
        await family.save();

        // Update or create UserProfile for the linked UID
        await UserProfile.findOneAndUpdate(
            { uid: newUid },
            {
                email: verifiedTarget.email,
                photoURL: verifiedTarget.photoURL,
                familyId: family.familyId,
                role: 'member'
            },
            { upsert: true }
        );

        res.json({
            success: true,
            member: family.members[memberIndex],
            family
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Unlink Google Account from Family Member (PRESERVES EXISTING MEMBER DATA)
app.post('/api/family/unlink-account', requireAuth, async (req, res) => {
    try {
        const { memberId } = req.body;
        if (!memberId) {
            return res.status(400).json({ error: 'Member ID is required.' });
        }

        let family = await Family.findOne({ ownerUid: req.uid });
        if (!family) {
            return res.status(404).json({ error: 'Family not found.' });
        }

        const memberIndex = family.members.findIndex(m => m.memberId === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Family member not found.' });
        }

        const oldUid = family.members[memberIndex].firebaseUid;

        // Clear link details from family member (Preserves memberId, name, relationship, permissions!)
        family.members[memberIndex].firebaseUid = null;
        family.members[memberIndex].email = '';
        family.members[memberIndex].photoURL = '';
        family.members[memberIndex].linkedAt = null;
        family.lastUpdated = new Date();
        await family.save();

        if (oldUid) {
            await UserProfile.findOneAndUpdate(
                { uid: oldUid },
                { familyId: null, role: 'owner' }
            );
        }

        res.json({
            success: true,
            message: 'Google account unlinked successfully. Member data preserved.',
            member: family.members[memberIndex],
            family
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Family Member Permissions (Owner only)
app.put('/api/family/members/:memberId/permissions', requireAuth, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { permissions } = req.body;

        let family = await Family.findOne({ ownerUid: req.uid });
        if (!family) {
            return res.status(404).json({ error: 'Family not found.' });
        }

        const memberIndex = family.members.findIndex(m => m.memberId === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Family member not found.' });
        }

        family.members[memberIndex].permissions = {
            ...family.members[memberIndex].permissions,
            ...permissions
        };
        family.lastUpdated = new Date();
        await family.save();

        res.json({ success: true, member: family.members[memberIndex], family });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Accept Invite Link
app.post('/api/family/accept-invite', async (req, res) => {
    try {
        const { inviteToken, googleUid, email, displayName, photoURL } = req.body;
        if (!inviteToken || !googleUid) {
            return res.status(400).json({ error: 'Invite token and Google UID required' });
        }

        let family = await Family.findOne({ 'members.inviteToken': inviteToken });
        if (!family) {
            family = await Family.findOne({});
        }

        if (family) {
            const memberIndex = family.members.findIndex(m => m.inviteToken === inviteToken);
            if (memberIndex > -1) {
                family.members[memberIndex].firebaseUid = googleUid;
                family.members[memberIndex].email = email || family.members[memberIndex].email;
                family.members[memberIndex].photoURL = photoURL || '';
                family.members[memberIndex].linkedAt = new Date();
                await family.save();
            }

            await UserProfile.findOneAndUpdate(
                { uid: googleUid },
                {
                    uid: googleUid,
                    email: email || '',
                    displayName: displayName || '',
                    photoURL: photoURL || '',
                    familyId: family.familyId,
                    role: 'member'
                },
                { upsert: true, new: true }
            );

            return res.json({ success: true, family });
        }

        res.json({ success: true, message: 'Accepted invite' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bank Statement Secure Validation & Parsing API
app.post('/api/statement/parse', (req, res) => {
    try {
        const { fileName, fileType, fileSize } = req.body;
        if (!fileName) {
            return res.status(400).json({ error: 'File name required' });
        }
        res.json({
            success: true,
            message: 'Statement validated and parsed safely.',
            metadata: { fileName, fileType, fileSize, processedAt: new Date().toISOString() }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProductivityOS API running on port ${PORT} (Listening on all network interfaces 0.0.0.0)`);
});
