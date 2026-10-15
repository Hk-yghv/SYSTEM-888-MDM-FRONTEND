import express from 'express';
import SupportHelp from '../models/SupportHelp.js';
import SupportComment from '../models/SupportComment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.supportHelps) {
    MEM_DB.supportHelps = [];
}
if (!MEM_DB.supportComments) {
    MEM_DB.supportComments = [];
}

/**
 * GET /api/support-help
 * Fetch all support & help guides with filtering & search
 */
router.get('/', async (req, res) => {
    try {
        const { search = '', page = '', activeOnly = 'false' } = req.query;

        let results = [];
        if (isMongoConnected) {
            const filter = {};
            if (activeOnly === 'true') {
                filter.isActive = true;
            }
            if (page && page !== 'All') {
                filter.$or = [{ page }, { pages: page }];
            }
            if (search && search.trim()) {
                const s = search.trim();
                const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { title: regex },
                        { text: regex },
                        { page: regex },
                        { videoUrl: regex },
                        { facebookUrl: regex }
                    ]
                });
            }

            results = await queryAllDBs(SupportHelp, (M) => M.find(filter).sort({ order: 1, createdAt: -1 }));
        } else {
            // Memory fallback
            results = (MEM_DB.supportHelps || []).filter((item) => {
                if (activeOnly === 'true' && !item.isActive) return false;
                if (page && page !== 'All') {
                    const matchPage = item.page === page || (Array.isArray(item.pages) && item.pages.includes(page));
                    if (!matchPage) return false;
                }
                if (search && search.trim()) {
                    const s = search.trim().toLowerCase();
                    const match =
                        (item.title && item.title.toLowerCase().includes(s)) ||
                        (item.text && item.text.toLowerCase().includes(s)) ||
                        (item.page && item.page.toLowerCase().includes(s));
                    if (!match) return false;
                }
                return true;
            });
            results.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        res.json({ success: true, count: results.length, data: results });
    } catch (err) {
        console.error('Error fetching support & help items:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/support-help/pages
 * Distinct list of pages that have help content
 */
router.get('/pages', async (req, res) => {
    try {
        let allItems = [];
        if (isMongoConnected) {
            allItems = await queryAllDBs(SupportHelp, (M) => M.find({ isActive: true }));
        } else {
            allItems = (MEM_DB.supportHelps || []).filter((i) => i.isActive);
        }

        const pageMap = new Map();
        allItems.forEach((item) => {
            const p = item.page || 'General';
            const count = (pageMap.get(p) || 0) + 1;
            pageMap.set(p, count);

            if (Array.isArray(item.pages)) {
                item.pages.forEach((subP) => {
                    if (subP && subP !== p) {
                        pageMap.set(subP, (pageMap.get(subP) || 0) + 1);
                    }
                });
            }
        });

        const pages = Array.from(pageMap.entries()).map(([name, count]) => ({
            name,
            count
        }));

        res.json({ success: true, data: pages });
    } catch (err) {
        console.error('Error fetching support help pages:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/support-help
 * Create a new Support & Help item
 */
router.post('/', async (req, res) => {
    try {
        const { title, text, page, pages, photos, videoUrl, facebookUrl, order, isActive, createdBy } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const payload = {
            title: title.trim(),
            text: (text || '').trim(),
            page: (page || 'General').trim(),
            pages: Array.isArray(pages) ? pages.filter(Boolean) : (page ? [page.trim()] : ['General']),
            photos: Array.isArray(photos) ? photos : [],
            videoUrl: (videoUrl || '').trim(),
            facebookUrl: (facebookUrl || '').trim(),
            order: Number(order) || 0,
            isActive: typeof isActive === 'boolean' ? isActive : true,
            createdBy: createdBy || req.headers['x-username'] || 'Administrator'
        };

        let createdItem = null;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportHelp);
            createdItem = await WriteModel.create(payload);
        } else {
            payload._id = 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            payload.createdAt = new Date();
            payload.updatedAt = new Date();
            MEM_DB.supportHelps.push(payload);
            createdItem = payload;
        }

        // Audit log
        recordSystemAudit({
            action: 'CREATE_SUPPORT_HELP',
            performedBy: payload.createdBy,
            target: payload.title,
            details: `Created support help for page: ${payload.page}`
        });

        res.status(201).json({ success: true, data: createdItem });
    } catch (err) {
        console.error('Error creating support help:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/support-help/:id
 * Update an existing Support & Help item
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, text, page, pages, photos, videoUrl, facebookUrl, order, isActive } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (text !== undefined) updateData.text = text.trim();
        if (page !== undefined) updateData.page = page.trim();
        if (pages !== undefined) updateData.pages = Array.isArray(pages) ? pages.filter(Boolean) : [page];
        if (photos !== undefined) updateData.photos = Array.isArray(photos) ? photos : [];
        if (videoUrl !== undefined) updateData.videoUrl = videoUrl.trim();
        if (facebookUrl !== undefined) updateData.facebookUrl = facebookUrl.trim();
        if (order !== undefined) updateData.order = Number(order) || 0;
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        updateData.updatedAt = new Date();

        let updatedItem = null;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportHelp);
            updatedItem = await WriteModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
        } else {
            const idx = (MEM_DB.supportHelps || []).findIndex((i) => i._id === id);
            if (idx !== -1) {
                MEM_DB.supportHelps[idx] = { ...MEM_DB.supportHelps[idx], ...updateData };
                updatedItem = MEM_DB.supportHelps[idx];
            }
        }

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        recordSystemAudit({
            action: 'UPDATE_SUPPORT_HELP',
            performedBy: req.headers['x-username'] || 'Administrator',
            target: updatedItem.title,
            details: `Updated support help ID: ${id}`
        });

        res.json({ success: true, data: updatedItem });
    } catch (err) {
        console.error('Error updating support help:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/support-help/:id
 * Delete a Support & Help item
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        let deleted = false;
        let itemTitle = id;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportHelp);
            const found = await WriteModel.findByIdAndDelete(id);
            if (found) {
                deleted = true;
                itemTitle = found.title;
            }
        } else {
            const idx = (MEM_DB.supportHelps || []).findIndex((i) => i._id === id);
            if (idx !== -1) {
                itemTitle = MEM_DB.supportHelps[idx].title;
                MEM_DB.supportHelps.splice(idx, 1);
                deleted = true;
            }
        }

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        recordSystemAudit({
            action: 'DELETE_SUPPORT_HELP',
            performedBy: req.headers['x-username'] || 'Administrator',
            target: itemTitle,
            details: `Deleted support help ID: ${id}`
        });

        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (err) {
        console.error('Error deleting support help:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT COMMENTS (សម្រាប់សរសេរ comment ទៅកាន់ admin ធំ & admin ធំមើលម្តង១០ៗ)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/support-help/comments
 * Fetch comments with 10 items pagination, search, status filter
 */
router.get('/comments', async (req, res) => {
    try {
        const { page = 1, limit = 10, status = '', search = '', username = '' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        let total = 0;
        let comments = [];

        if (isMongoConnected) {
            const filter = {};
            if (status && status !== 'All') {
                filter.status = status;
            }
            if (username && username !== 'all') {
                filter.senderUsername = username;
            }
            if (search && search.trim()) {
                const s = search.trim();
                const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                filter.$or = [
                    { message: regex },
                    { subject: regex },
                    { senderName: regex },
                    { senderUsername: regex },
                    { pageContext: regex }
                ];
            }

            const allFound = await queryAllDBs(SupportComment, (M) => M.find(filter).sort({ createdAt: -1 }));
            total = allFound.length;
            comments = allFound.slice(skip, skip + limitNum);
        } else {
            let filtered = (MEM_DB.supportComments || []).filter((c) => {
                if (status && status !== 'All' && c.status !== status) return false;
                if (username && username !== 'all' && c.senderUsername !== username) return false;
                if (search && search.trim()) {
                    const s = search.trim().toLowerCase();
                    const match =
                        (c.message && c.message.toLowerCase().includes(s)) ||
                        (c.subject && c.subject.toLowerCase().includes(s)) ||
                        (c.senderName && c.senderName.toLowerCase().includes(s)) ||
                        (c.senderUsername && c.senderUsername.toLowerCase().includes(s));
                    if (!match) return false;
                }
                return true;
            });

            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            total = filtered.length;
            comments = filtered.slice(skip, skip + limitNum);
        }

        res.json({
            success: true,
            data: comments,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        });
    } catch (err) {
        console.error('Error fetching support comments:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/support-help/comments
 * Submit a comment from user to Master Admin
 */
router.post('/comments', async (req, res) => {
    try {
        const {
            senderUsername,
            senderName,
            senderRole,
            senderBrand,
            pageContext,
            subject,
            message,
            photoUrl
        } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const payload = {
            senderUsername: (senderUsername || req.headers['x-username'] || 'Anonymous').trim(),
            senderName: (senderName || '').trim(),
            senderRole: (senderRole || 'Staff').trim(),
            senderBrand: (senderBrand || '').trim(),
            pageContext: (pageContext || 'General').trim(),
            subject: (subject || 'General Feedback').trim(),
            message: message.trim(),
            photoUrl: (photoUrl || '').trim(),
            status: 'Pending'
        };

        let created = null;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportComment);
            created = await WriteModel.create(payload);
        } else {
            payload._id = 'mem_comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            payload.createdAt = new Date();
            payload.updatedAt = new Date();
            MEM_DB.supportComments.unshift(payload);
            created = payload;
        }

        recordSystemAudit({
            action: 'SEND_SUPPORT_COMMENT',
            performedBy: payload.senderUsername,
            target: payload.subject,
            details: `Staff ${payload.senderUsername} submitted comment to Master Admin`
        });

        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error submitting support comment:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/support-help/comments/:id/reply
 * Master Admin reply or resolve comment
 */
router.put('/comments/:id/reply', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminReply, status = 'Resolved' } = req.body;

        const updateData = {
            status,
            updatedAt: new Date()
        };

        if (adminReply !== undefined) {
            updateData.adminReply = adminReply.trim();
            updateData.repliedBy = req.headers['x-username'] || 'Master Admin';
            updateData.repliedAt = new Date();
        }

        let updated = null;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportComment);
            updated = await WriteModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
        } else {
            const idx = (MEM_DB.supportComments || []).findIndex((c) => c._id === id);
            if (idx !== -1) {
                MEM_DB.supportComments[idx] = { ...MEM_DB.supportComments[idx], ...updateData };
                updated = MEM_DB.supportComments[idx];
            }
        }

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('Error replying to comment:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/support-help/comments/:id
 * Delete comment
 */
router.delete('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let deleted = false;

        if (isMongoConnected) {
            const WriteModel = getWriteModel(SupportComment);
            const found = await WriteModel.findByIdAndDelete(id);
            if (found) deleted = true;
        } else {
            const idx = (MEM_DB.supportComments || []).findIndex((c) => c._id === id);
            if (idx !== -1) {
                MEM_DB.supportComments.splice(idx, 1);
                deleted = true;
            }
        }

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
