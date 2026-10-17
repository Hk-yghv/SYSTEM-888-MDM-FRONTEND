import express from 'express';
import SavedUrl from '../models/SavedUrl.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.savedUrls) {
    MEM_DB.savedUrls = [];
}

const norm = (str) => (str || '').toString().trim().toLowerCase();

/**
 * GET /api/saved-urls/public
 * Fast endpoint to get public URLs with pagination / chunking
 */
router.get('/public', async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', category = '', brand = '' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (pageNum - 1) * limitNum;

        let allPublic = [];
        if (isMongoConnected) {
            const filter = { visibility: 'Public' };
            if (brand) {
                filter.$or = [{ brand }, { brand: '' }, { brand: { $exists: false } }];
            }
            if (category && category !== 'All') {
                filter.category = category;
            }
            if (search && search.trim()) {
                const s = search.trim();
                const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                filter.$or = [
                    { title: regex },
                    { url: regex },
                    { description: regex },
                    { category: regex }
                ];
            }
            allPublic = await queryAllDBs(SavedUrl, (M) => M.find(filter).sort({ createdAt: -1 }));
        } else {
            allPublic = (MEM_DB.savedUrls || []).filter(item => {
                if (item.visibility !== 'Public') return false;
                if (brand && item.brand && item.brand !== brand) return false;
                if (category && category !== 'All' && item.category !== category) return false;
                if (search && search.trim()) {
                    const s = search.trim().toLowerCase();
                    const match = (item.title && item.title.toLowerCase().includes(s)) ||
                                  (item.url && item.url.toLowerCase().includes(s)) ||
                                  (item.description && item.description.toLowerCase().includes(s)) ||
                                  (item.category && item.category.toLowerCase().includes(s));
                    if (!match) return false;
                }
                return true;
            });
            allPublic.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        const total = allPublic.length;
        const paginated = allPublic.slice(skip, skip + limitNum);

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
            visibility = '',
            username = '',
            userBrand = '',
            userRole = '',
            isImmutable = 'false'
        } = req.query;

        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

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
            ? [...allRecords]
            : allRecords.filter(item => norm(item.createdBy) === currentUsernameNorm);

        // Brand filter for non-admin
        if (userBrand && !isMasterAdmin) {
            filtered = filtered.filter(item => !item.brand || item.brand === userBrand);
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
                    (item.url && item.url.toLowerCase().includes(s)) ||
                    (item.description && item.description.toLowerCase().includes(s)) ||
                    (item.category && item.category.toLowerCase().includes(s)) ||
                    (item.createdBy && item.createdBy.toLowerCase().includes(s))
                );
            });
        }

        const total = filtered.length;
        const paginated = filtered.slice(skip, skip + limitNum);

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
            createdBy = 'Administrator'
        } = req.body;

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

        let finalSubBrand = (subBrand || '').trim();
        if (!finalSubBrand && brand) {
            const list = MEM_DB.controlSystem?.brand_subbrands?.[brand];
            if (Array.isArray(list) && list.length > 0) {
                finalSubBrand = list[0];
            }
        }

        const docData = {
            title: title.trim(),
            url: cleanUrl,
            category: (category || 'General').trim(),
            visibility: visibility === 'Private' ? 'Private' : 'Public',
            description: (description || '').trim(),
            tags: Array.isArray(tags) ? tags : [],
            brand: brand || '',
            subBrand: finalSubBrand,
            createdBy: createdBy || 'Administrator',
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
            username: createdBy
        });

        res.status(201).json({ success: true, data: savedDoc });
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
            updatedBy,
            username,
            isImmutable,
            userRole
        } = req.body;

        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === true ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

        // Fetch the existing record to check ownership
        let existingDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            existingDoc = await Model.findById(id);
        } else {
            existingDoc = (MEM_DB.savedUrls || []).find(item => item._id === id || item.id === id);
        }

        if (!existingDoc) {
            return res.status(404).json({ error: 'Saved URL not found' });
        }

        // Permission check: only creator or master admin may edit
        if (!isMasterAdmin && norm(existingDoc.createdBy) !== norm(username || updatedBy || '')) {
            return res.status(403).json({ error: 'Permission denied. Only the creator or an Administrator can edit this URL.' });
        }

        let cleanUrl = url ? url.trim() : undefined;
        if (cleanUrl && !/^https?:\/\//i.test(cleanUrl) && !/^mailto:/i.test(cleanUrl) && !/^tel:/i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        const updateFields = {
            ...(title ? { title: title.trim() } : {}),
            ...(cleanUrl ? { url: cleanUrl } : {}),
            ...(category !== undefined ? { category: category.trim() } : {}),
            ...(visibility !== undefined ? { visibility: visibility === 'Private' ? 'Private' : 'Public' } : {}),
            ...(description !== undefined ? { description: description.trim() } : {}),
            ...(Array.isArray(tags) ? { tags } : {}),
            ...(brand !== undefined ? { brand } : {}),
            ...(req.body.subBrand !== undefined ? { subBrand: req.body.subBrand } : {}),
            updatedAt: new Date()
        };

        let updatedDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(SavedUrl);
            updatedDoc = await Model.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
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
            username: updatedBy || username || 'Administrator'
        });

        res.json({ success: true, data: updatedDoc });
    } catch (err) {
        console.error('Update saved URL error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/saved-urls/:id
 * Delete a Saved URL — only the creator or Master Admin can delete
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username = '',
            isImmutable = 'false',
            userRole = ''
        } = req.query;

        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

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
        if (!isMasterAdmin && norm(existingDoc.createdBy) !== norm(username)) {
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
            username
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
