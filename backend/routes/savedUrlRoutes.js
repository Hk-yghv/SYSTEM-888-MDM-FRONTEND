import express from 'express';
import bcrypt from 'bcryptjs';
import SavedUrl from '../models/SavedUrl.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.savedUrls) {
    MEM_DB.savedUrls = [];
}

const norm = (str) => (str || '').toString().trim().toLowerCase();
const VALID_VISIBILITIES = new Set(['Public', 'Private', 'Personal']);
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 128;

const serializeSavedUrl = (record) => {
    const data = typeof record?.toObject === 'function' ? record.toObject() : { ...record };
    const passwordProtected = Boolean(data.passwordProtected || data.passwordHash);
    delete data.passwordHash;
    if (passwordProtected) data.url = '';
    data.passwordProtected = passwordProtected;
    return data;
};

const validateVisibility = (visibility) => VALID_VISIBILITIES.has(visibility);
const isEnabled = (value) => value === true || value === 'true';

const hashPassword = async (password) => {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        throw new Error(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
    }
    return bcrypt.hash(password, 10);
};

const getRequester = async (req) => {
    const username = req.user?.username || '';
    let account = null;
    if (username && isMongoConnected) {
        const results = await queryAllDBs(User, M => M.findOne({ username }).select('username role isImmutable brand subBrands'));
        account = Array.isArray(results) ? results[0] : results;
    }
    if (!account && username) {
        account = (MEM_DB.users || []).find(user => norm(user.username) === norm(username)) || null;
    }
    const role = account?.role || req.user?.role || '';
    const isMasterAdmin = Boolean(
        account?.isImmutable ||
        role === 'Administrator' ||
        role === 'Admin' ||
        norm(username) === '@hakyonghouv' ||
        norm(username) === 'hakyonghouv'
    );
    return {
        username: account?.username || username,
        brand: account?.brand || '',
        subBrands: Array.isArray(account?.subBrands) ? account.subBrands : [],
        isMasterAdmin
    };
};

// Resolve allowed sub-brands for a user (same logic as contractRoutes)
const resolveUserSubBrands = async (req, isMasterAdmin, username) => {
    if (isMasterAdmin) return null;
    if (Array.isArray(req.user?.subBrands) && req.user.subBrands.length > 0) return req.user.subBrands;
    if (username && isMongoConnected) {
        try {
            const results = await queryAllDBs(User, M => M.findOne({ username }).select('subBrands'));
            const dbUser = Array.isArray(results) ? results[0] : results;
            if (dbUser && Array.isArray(dbUser.subBrands) && dbUser.subBrands.length > 0) return dbUser.subBrands;
        } catch { /* ignore */ }
    }
    if (username) {
        const memUser = (MEM_DB.users || []).find(u => u.username === username);
        if (memUser && Array.isArray(memUser.subBrands) && memUser.subBrands.length > 0) return memUser.subBrands;
    }
    return null;
};

/**
 * GET /api/saved-urls/public
 * Fast endpoint to get public URLs with pagination / chunking
 */
router.get('/public', async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', category = '' } = req.query;
        const requester = await getRequester(req);
        const { username, brand, isMasterAdmin } = requester;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (pageNum - 1) * limitNum;

        const allowedSubBrands = requester.subBrands.length ? requester.subBrands : await resolveUserSubBrands(req, isMasterAdmin, username);

        let sharedUrls = [];
        if (isMongoConnected) {
            const filter = { visibility: { $in: ['Public', 'Private'] } };
            if (category && category !== 'All') {
                filter.category = category;
            }
            if (search && search.trim()) {
                const s = search.trim();
                const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                filter.$and = [{ $or: [
                    { title: regex },
                    { description: regex },
                    { category: regex },
                    { url: regex, passwordProtected: { $ne: true } }
                ] }];
            }
            sharedUrls = await queryAllDBs(SavedUrl, (M) => M.find(filter).sort({ createdAt: -1 }));
        } else {
            sharedUrls = (MEM_DB.savedUrls || []).filter(item => {
                if (!['Public', 'Private'].includes(item.visibility)) return false;
                if (category && category !== 'All' && item.category !== category) return false;
                if (search && search.trim()) {
                    const s = search.trim().toLowerCase();
                    const match = (item.title && item.title.toLowerCase().includes(s)) ||
                                  (!item.passwordProtected && item.url && item.url.toLowerCase().includes(s)) ||
                                  (item.description && item.description.toLowerCase().includes(s)) ||
                                  (item.category && item.category.toLowerCase().includes(s));
                    if (!match) return false;
                }
                return true;
            });
            sharedUrls.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        const currentUsername = norm(username);
        const visibleSharedUrls = sharedUrls.filter(item => {
            if (isMasterAdmin || item.visibility === 'Public') return true;
            if (norm(item.createdBy) === currentUsername) return true;
            if (!brand || norm(item.brand) !== norm(brand)) return false;
            if (item.brandWide) return true;
            return Boolean(item.subBrand && allowedSubBrands?.some(subBrand => norm(subBrand) === norm(item.subBrand)));
        });
        const total = visibleSharedUrls.length;
        const paginated = visibleSharedUrls.slice(skip, skip + limitNum).map(serializeSavedUrl);

        res.json({
            success: true,
            data: paginated,
            total,
            page: pageNum,
            limit: limitNum,
            hasMore: skip + limitNum < total
        });
    } catch (err) {
        console.error('Fetch public saved URLs error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/saved-urls
 * Get all URLs with filtering (Public + Private according to permissions)
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            category = '',
            visibility = ''
        } = req.query;
        const requester = await getRequester(req);
        const { username, isMasterAdmin } = requester;

        const allowedSubBrands = await resolveUserSubBrands(req, isMasterAdmin, username);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        let allRecords = [];
        if (isMongoConnected) {
            allRecords = await queryAllDBs(SavedUrl, (M) => M.find({}).sort({ createdAt: -1 }));
        } else {
            allRecords = [...(MEM_DB.savedUrls || [])];
            allRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        const currentUsernameNorm = norm(username);

        // ── TABLE FILTER LOGIC ──────────────────────────────────────────────────
        // Master Admin sees every record.
        // Regular users see ONLY the records they personally created
        //   (both Public and Private that belong to them).
        // Public URLs created by other users are visible only in the Top Showcase
        // endpoint (/public), NOT in this table.
        let filtered = isMasterAdmin
            ? allRecords.filter(item => item.visibility !== 'Personal' || norm(item.createdBy) === currentUsernameNorm)
            : allRecords.filter(item => norm(item.createdBy) === currentUsernameNorm);

        // Brand filter for non-admin
        if (requester.brand && !isMasterAdmin) {
            filtered = filtered.filter(item => !item.brand || item.brand === requester.brand);
        }

        // SubBrand isolation — only show records from assigned sub-brands
        if (allowedSubBrands && allowedSubBrands.length > 0) {
            filtered = filtered.filter(item => !item.subBrand || allowedSubBrands.includes(item.subBrand));
        }

        // Visibility filter dropdown
        if (visibility && visibility !== 'All') {
            filtered = filtered.filter(item => item.visibility === visibility);
        }

        // Category filter
        if (category && category !== 'All') {
            filtered = filtered.filter(item => (item.category || '').toLowerCase() === category.toLowerCase());
        }

        // Search term filter
        if (search && search.trim()) {
            const s = search.trim().toLowerCase();
            filtered = filtered.filter(item => {
                return (
                    (item.title && item.title.toLowerCase().includes(s)) ||
                    (!item.passwordProtected && item.url && item.url.toLowerCase().includes(s)) ||
                    (item.description && item.description.toLowerCase().includes(s)) ||
                    (item.category && item.category.toLowerCase().includes(s)) ||
                    (item.createdBy && item.createdBy.toLowerCase().includes(s))
                );
            });
        }

        const total = filtered.length;
        const paginated = filtered.slice(skip, skip + limitNum).map(serializeSavedUrl);

        // Compute stats relative to the user's own records only (non-admin)
        const ownRecords = isMasterAdmin
            ? allRecords
            : allRecords.filter(item => norm(item.createdBy) === currentUsernameNorm);

        const categoriesCount = {};
        ownRecords.forEach(r => {
            const cat = r.category || 'General';
            categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
        });

        const publicCount  = ownRecords.filter(r => r.visibility === 'Public').length;
        const privateCount = ownRecords.filter(r => r.visibility === 'Private').length;
        const personalCount = ownRecords.filter(r => r.visibility === 'Personal').length;

        res.json({
            success: true,
            data: paginated,
            total,
            page: pageNum,
            limit: limitNum,
            stats: {
                totalAll: ownRecords.length,
                publicCount,
                privateCount,
                personalCount,
                categoriesCount
            }
        });
    } catch (err) {
        console.error('Fetch saved URLs error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/saved-urls
 * Create new Saved URL
 */
router.post('/', async (req, res) => {
    try {
        const {
            title,
            url,
            category = 'General',
            visibility = 'Public',
            description = '',
            tags = [],
            brand = '',
            subBrand = '',
            brandWide = false,
            passwordProtected = false,
            password = '',
        } = req.body;
        const requester = await getRequester(req);
        if (!requester.username) return res.status(401).json({ error: 'Authenticated user is required.' });

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!url || !url.trim()) {
            return res.status(400).json({ error: 'URL link is required' });
        }

        // Format URL if missing protocol
        let cleanUrl = url.trim();
        if (!/^https?:\/\//i.test(cleanUrl) && !/^mailto:/i.test(cleanUrl) && !/^tel:/i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        if (!validateVisibility(visibility)) {
            return res.status(400).json({ error: 'Visibility must be Public, Private, or Personal.' });
        }
        const isBrandWide = visibility === 'Private' && isEnabled(brandWide);
        const isPasswordProtected = isEnabled(passwordProtected);

        const requestedSubBrand = (subBrand || '').trim();
        if (!requester.isMasterAdmin && requestedSubBrand &&
            !requester.subBrands.some(allowed => norm(allowed) === norm(requestedSubBrand))) {
            return res.status(403).json({ error: 'You cannot assign this URL to an unassigned Sub Brand.' });
        }
        if (visibility === 'Private' && !isBrandWide && !requestedSubBrand && requester.subBrands.length !== 1 && !requester.isMasterAdmin) {
            return res.status(400).json({ error: 'Select one of your assigned Sub Brands or enable sharing across the Brand.' });
        }
        if (visibility === 'Private' && !isBrandWide && !requestedSubBrand && requester.isMasterAdmin) {
            return res.status(400).json({ error: 'Select a Sub Brand or enable sharing across the Brand.' });
        }

        const finalBrand = requester.isMasterAdmin ? (brand || requester.brand) : requester.brand;
        let finalSubBrand = (subBrand || '').trim();
        if (!requester.isMasterAdmin && !finalSubBrand && requester.subBrands.length === 1) {
            finalSubBrand = requester.subBrands[0];
        }
        if (!finalSubBrand && brand) {
            const list = MEM_DB.controlSystem?.brand_subbrands?.[brand];
            if (Array.isArray(list) && list.length > 0) {
                finalSubBrand = list[0];
            }
        }

        let passwordHash = '';
        if (isPasswordProtected) {
            try {
                passwordHash = await hashPassword(password);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }
        }

        const docData = {
            title: title.trim(),
            url: cleanUrl,
            category: (category || 'General').trim(),
            visibility,
            description: (description || '').trim(),
            tags: Array.isArray(tags) ? tags : [],
            brand: finalBrand || '',
            subBrand: finalSubBrand,
            brandWide: isBrandWide,
            passwordProtected: isPasswordProtected,
            passwordHash,
            createdBy: requester.username,
            clicks: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        let savedDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            savedDoc = await Model.create(docData);
        } else {
            savedDoc = {
                _id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                ...docData
            };
            MEM_DB.savedUrls.unshift(savedDoc);
        }

        recordSystemAudit({
            action: 'CREATE_SAVED_URL',
            details: `Saved URL created: "${title}" (${visibility})`,
            username: requester.username
        });

        res.status(201).json({ success: true, data: serializeSavedUrl(savedDoc) });
    } catch (err) {
        console.error('Create saved URL error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/saved-urls/:id
 * Update existing Saved URL — only the creator or Master Admin can edit
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            url,
            category,
            visibility,
            description,
            tags,
            brand,
            subBrand,
            brandWide,
            passwordProtected,
            password,
            updatedBy
        } = req.body;
        const requester = await getRequester(req);
        if (!requester.username) return res.status(401).json({ error: 'Authenticated user is required.' });

        // Fetch the existing record to check ownership
        let existingDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            existingDoc = await Model.findById(id).select('+passwordHash');
        } else {
            existingDoc = (MEM_DB.savedUrls || []).find(item => item._id === id || item.id === id);
        }

        if (!existingDoc) {
            return res.status(404).json({ error: 'Saved URL not found' });
        }

        // Permission check: only creator or master admin may edit
        if (!requester.isMasterAdmin && norm(existingDoc.createdBy) !== norm(requester.username)) {
            return res.status(403).json({ error: 'Permission denied. Only the creator or an Administrator can edit this URL.' });
        }

        if (visibility !== undefined && !validateVisibility(visibility)) {
            return res.status(400).json({ error: 'Visibility must be Public, Private, or Personal.' });
        }
        const nextVisibility = visibility !== undefined ? visibility : existingDoc.visibility;
        let requestedSubBrand = subBrand === undefined ? existingDoc.subBrand : String(subBrand || '').trim();
        if (!requester.isMasterAdmin && subBrand !== undefined && requestedSubBrand &&
            !requester.subBrands.some(allowed => norm(allowed) === norm(requestedSubBrand))) {
            return res.status(403).json({ error: 'You cannot assign this URL to an unassigned Sub Brand.' });
        }
        if (!requester.isMasterAdmin && !requestedSubBrand && requester.subBrands.length === 1) {
            requestedSubBrand = requester.subBrands[0];
        }

        let cleanUrl = url ? url.trim() : undefined;
        if (cleanUrl && !/^https?:\/\//i.test(cleanUrl) && !/^mailto:/i.test(cleanUrl) && !/^tel:/i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        const currentPasswordProtected = Boolean(existingDoc.passwordProtected || existingDoc.passwordHash);
        const nextPasswordProtected = passwordProtected === undefined
            ? currentPasswordProtected
            : passwordProtected === true || passwordProtected === 'true';
        let nextPasswordHash = existingDoc.passwordHash || '';
        if (!nextPasswordProtected) {
            nextPasswordHash = '';
        } else if (password) {
            try {
                nextPasswordHash = await hashPassword(password);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }
        } else if (!currentPasswordProtected) {
            return res.status(400).json({ error: 'A password is required when password protection is enabled.' });
        }
        const nextBrandWide = nextVisibility === 'Private'
            ? (brandWide === undefined ? Boolean(existingDoc.brandWide) : isEnabled(brandWide))
            : false;
        if (nextVisibility === 'Private' && !nextBrandWide && !requestedSubBrand) {
            return res.status(400).json({ error: 'Select one of your assigned Sub Brands or enable sharing across the Brand.' });
        }

        const updateFields = {
            ...(title ? { title: title.trim() } : {}),
            ...(cleanUrl ? { url: cleanUrl } : {}),
            ...(category !== undefined ? { category: category.trim() } : {}),
            ...(visibility !== undefined ? { visibility } : {}),
            ...(description !== undefined ? { description: description.trim() } : {}),
            ...(Array.isArray(tags) ? { tags } : {}),
            brand: requester.isMasterAdmin ? (brand !== undefined ? brand : existingDoc.brand) : requester.brand,
            subBrand: requestedSubBrand,
            brandWide: nextBrandWide,
            passwordProtected: nextPasswordProtected,
            passwordHash: nextPasswordHash,
            updatedAt: new Date()
        };

        let updatedDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            updatedDoc = await Model.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).select('+passwordHash');
        } else {
            const idx = (MEM_DB.savedUrls || []).findIndex(item => item._id === id || item.id === id);
            if (idx !== -1) {
                MEM_DB.savedUrls[idx] = { ...MEM_DB.savedUrls[idx], ...updateFields };
                updatedDoc = MEM_DB.savedUrls[idx];
            }
        }

        if (!updatedDoc) {
            return res.status(404).json({ error: 'Saved URL not found' });
        }

        recordSystemAudit({
            action: 'UPDATE_SAVED_URL',
            details: `Saved URL updated: "${updatedDoc.title}"`,
            username: requester.username || updatedBy || 'Administrator'
        });

        res.json({ success: true, data: serializeSavedUrl(updatedDoc) });
    } catch (err) {
        console.error('Update saved URL error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/saved-urls/:id/unlock
 * Reveal a password-protected URL only after verifying its password.
 */
router.post('/:id/unlock', async (req, res) => {
    try {
        const { id } = req.params;
        const requester = await getRequester(req);
        const { password } = req.body;
        if (!requester.username) return res.status(401).json({ error: 'Authenticated user is required.' });
        let item = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            item = await Model.findById(id).select('+passwordHash');
        } else {
            item = (MEM_DB.savedUrls || []).find(record => record._id === id || record.id === id);
        }

        if (!item) return res.status(404).json({ error: 'Saved URL not found.' });
        const isOwner = norm(item.createdBy) === norm(requester.username);
        const canView = item.visibility === 'Personal'
            ? isOwner
            : requester.isMasterAdmin ||
                item.visibility === 'Public' ||
                (item.visibility === 'Private' && (
                isOwner ||
                (Boolean(requester.brand) && norm(item.brand) === norm(requester.brand) &&
                    (item.brandWide || requester.subBrands.some(subBrand => norm(subBrand) === norm(item.subBrand))))
                ));
        if (!canView) return res.status(404).json({ error: 'Saved URL not found.' });
        if (!item.passwordProtected || !item.passwordHash) {
            return res.status(400).json({ error: 'This URL does not have password protection enabled.' });
        }
        if (typeof password !== 'string' || password.length > PASSWORD_MAX_LENGTH ||
            !(await bcrypt.compare(password, item.passwordHash))) {
            return res.status(403).json({ error: 'Incorrect password.' });
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, url: item.url });
    } catch (err) {
        console.error('Unlock saved URL error:', err);
        res.status(500).json({ error: 'Unable to unlock this URL right now.' });
    }
});

/**
 * DELETE /api/saved-urls/:id
 * Delete a Saved URL — only the creator or Master Admin can delete
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const requester = await getRequester(req);
        if (!requester.username) return res.status(401).json({ error: 'Authenticated user is required.' });

        // Fetch the record first to check ownership
        let existingDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            existingDoc = await Model.findById(id);
        } else {
            existingDoc = (MEM_DB.savedUrls || []).find(item => item._id === id || item.id === id);
        }

        if (!existingDoc) {
            return res.status(404).json({ error: 'Saved URL not found or already deleted' });
        }

        // Permission check: only creator or master admin may delete
        if (!requester.isMasterAdmin && norm(existingDoc.createdBy) !== norm(requester.username)) {
            return res.status(403).json({ error: 'Permission denied. Only the creator or an Administrator can delete this URL.' });
        }

        // Proceed with deletion
        let deletedDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            deletedDoc = await Model.findByIdAndDelete(id);
        } else {
            const idx = (MEM_DB.savedUrls || []).findIndex(item => item._id === id || item.id === id);
            if (idx !== -1) {
                deletedDoc = MEM_DB.savedUrls.splice(idx, 1)[0];
            }
        }

        if (!deletedDoc) {
            return res.status(404).json({ error: 'Saved URL not found or already deleted' });
        }

        recordSystemAudit({
            action: 'DELETE_SAVED_URL',
            details: `Saved URL deleted: "${deletedDoc.title}"`,
            username: requester.username
        });

        res.json({ success: true, message: 'Saved URL deleted successfully' });
    } catch (err) {
        console.error('Delete saved URL error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/saved-urls/:id/click
 * Increment click count
 */
router.patch('/:id/click', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            await Model.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
        } else {
            const item = (MEM_DB.savedUrls || []).find(it => it._id === id || it.id === id);
            if (item) item.clicks = (item.clicks || 0) + 1;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
