import express from 'express';
import QRCode from 'qrcode';
import Contract from '../models/Contract.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

const sanitizeAndDecryptContract = (c) => {
    if (!c) return c;
    const obj = c.toObject ? c.toObject() : { ...c };
    obj.urlFb = obj.urlFb || obj.url_fb || '';
    obj.mosyleUrl = obj.mosyleUrl || obj.mosyle_url || obj.mosyleURL || obj.urlMosyle || '';
    return obj;
};

// GET contracts
router.get('/', async (req, res) => {
    try {
        const { status, userBrand, userRole, page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};
        if (status) query.status = status;
        if (userBrand && userRole !== 'Administrator') query.brand = userBrand;
        if (search) {
            query.$or = [
                { customerNameEn: { $regex: search, $options: 'i' } },
                { customerNameKh: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { contractId: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const total = await Contract.countDocuments(query);
            const contracts = await Contract.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            const data = contracts.map(sanitizeAndDecryptContract);
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.contracts;
        if (status) filtered = filtered.filter(c => c.status === status);
        if (userBrand && userRole !== 'Administrator') filtered = filtered.filter(c => c.brand === userBrand);
        if (search) filtered = filtered.filter(c =>
            (c.customerNameEn || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.customerNameKh || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.contractId || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.model || '').toLowerCase().includes(search.toLowerCase())
        );
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit)).map(sanitizeAndDecryptContract);
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Customer QR payload
router.get('/customer-qr-payload/:contractId', async (req, res) => {
    try {
        let contract = isMongoConnected
            ? await Contract.findOne({ contractId: req.params.contractId })
            : MEM_DB.contracts.find(c => c.contractId === req.params.contractId);

        if (!contract) return res.status(404).json({ error: 'Customer contract not found' });

        const infoPageUrl = `${req.protocol}://${req.get('host')}/customer-info/${contract.contractId}`;
        const qrDataUrl = await QRCode.toDataURL(infoPageUrl);

        res.json({ contract, qrDataUrl, infoPageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET Mobile Customer Info HTML Page ──
router.get('/customer-info/:contractId', async (req, res) => {
    try {
        const { contractId } = req.params;
        let contract = isMongoConnected
            ? await Contract.findOne({ contractId })
            : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).send(`
                <!DOCTYPE html><html lang="km"><head><meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>មិនរកឃើញ</title>
                <style>body{margin:0;background:#0f172a;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}h2{color:#f87171}p{color:#94a3b8;font-size:14px}</style>
                </head><body><div><h2>❌ Customer Not Found</h2><p>Contract ID: ${contractId}</p></div></body></html>
            `);
        }

        const photoUrl = contract.customerPhoto || contract.googleDrivePhotoUrl || '';
        const today = new Date().toLocaleDateString('km-KH', { year: 'numeric', month: 'long', day: 'numeric' });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>👤 Customer Details — ${contract.customerNameEn || contract.contractId}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: linear-gradient(135deg, #070a14 0%, #0f172a 100%); color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; padding: 16px; padding-bottom: 40px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 18px; margin-bottom: 14px; backdrop-filter: blur(10px); }
        .header { text-align: center; padding: 12px 0 6px; }
        .badge { display: inline-block; background: #6366f1; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
        .photo { width: 96px; height: 96px; border-radius: 24px; object-fit: cover; border: 3px solid #6366f1; margin: 10px auto; display: block; background: #1e293b; box-shadow: 0 10px 25px rgba(99,102,241,0.3); }
        .photo-placeholder { width: 96px; height: 96px; border-radius: 24px; border: 3px solid #475569; margin: 10px auto; display: flex; align-items: center; justify-content: center; font-size: 40px; background: #1e293b; }
        .name-en { font-size: 20px; font-weight: 900; text-align: center; color: #f8fafc; }
        .name-kh { font-size: 15px; font-weight: 700; text-align: center; color: #a5b4fc; margin-top: 2px; }
        .section-title { font-size: 11px; font-weight: 800; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .item { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 10px 12px; border-radius: 14px; }
        .item .lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
        .item .val { font-size: 13px; font-weight: 700; color: #e2e8f0; word-break: break-word; }
        .status-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .status-pill.active { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid #10b981; }
        .status-pill.locked { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; }
        .status-pill.unlocked { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid #10b981; }
        .footer { text-align: center; font-size: 11px; color: #475569; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="badge">👤 Customer Profile Details</div>
        <div style="font-size:12px;color:#94a3b8">Contract ID: <strong style="color:#e2e8f0">${contract.contractId}</strong></div>
    </div>

    <!-- Header Avatar Card -->
    <div class="card">
        ${photoUrl
            ? `<img src="${photoUrl}" class="photo" alt="Customer Photo" onerror="this.style.display='none'">`
            : `<div class="photo-placeholder">👤</div>`
        }
        <div class="name-en">${contract.customerNameEn || '—'}</div>
        <div class="name-kh">${contract.customerNameKh || ''}</div>
        <div style="text-align:center;margin-top:8px">
            <span class="status-pill active">${contract.status || 'Activated'}</span>
        </div>
    </div>

    <!-- Personal Info -->
    <div class="card">
        <div class="section-title">📌 Personal Information / ព័ត៌មានផ្ទាល់ខ្លួន</div>
        <div class="grid-2">
            <div class="item"><div class="lbl">ID Card</div><div class="val" style="font-family:monospace">${contract.idCardNumber || '—'}</div></div>
            <div class="item"><div class="lbl">Date of Birth</div><div class="val">${contract.dob || '—'}</div></div>
            <div class="item"><div class="lbl">Gender</div><div class="val" style="text-transform:capitalize">${contract.gender || '—'}</div></div>
            <div class="item"><div class="lbl">Phone</div><div class="val" style="color:#34d399;font-family:monospace">${contract.phone || '—'}</div></div>
            <div class="item"><div class="lbl">Relative Phone</div><div class="val" style="font-family:monospace">${contract.relativePhone || '—'}</div></div>
            <div class="item"><div class="lbl">Telegram</div><div class="val">${contract.telegramName || '—'}</div></div>
        </div>
        <div class="item" style="margin-top:8px"><div class="lbl">Current Address</div><div class="val">${contract.currentAddress || '—'}</div></div>
        <div class="item" style="margin-top:8px"><div class="lbl">Birth Address</div><div class="val">${contract.birthAddress || '—'}</div></div>
    </div>

    <!-- Device Details -->
    <div class="card">
        <div class="section-title">📱 Device Information / ព័ត៌មានឧបករណ៍</div>
        <div class="grid-2">
            <div class="item"><div class="lbl">Model</div><div class="val" style="color:#c084fc">${contract.model || '—'}</div></div>
            <div class="item"><div class="lbl">Brand</div><div class="val">${contract.brand || '—'}</div></div>
            <div class="item" style="grid-column: span 2"><div class="lbl">Serial Number</div><div class="val" style="font-family:monospace;color:#38bdf8">${contract.serialNumber || '—'}</div></div>
            <div class="item"><div class="lbl">IMEI 1</div><div class="val" style="font-family:monospace;font-size:11px">${contract.imei1 || '—'}</div></div>
            <div class="item"><div class="lbl">IMEI 2</div><div class="val" style="font-family:monospace;font-size:11px">${contract.imei2 || '—'}</div></div>
            <div class="item"><div class="lbl">Color</div><div class="val">${contract.color || '—'}</div></div>
            <div class="item"><div class="lbl">Version</div><div class="val">${contract.version || '—'}</div></div>
        </div>
    </div>

    <!-- Financial Terms -->
    <div class="card">
        <div class="section-title">💰 Loan & Financial Terms / លក្ខខណ្ឌហិរញ្ញវត្ថុ</div>
        <div class="grid-2">
            <div class="item" style="grid-column: span 2"><div class="lbl">Loan Application Date / កាលបរិច្ឆេទដាក់ស្នើ</div><div class="val" style="color:#fbbf24;font-family:monospace">${contract.inputDate || '—'}</div></div>
            <div class="item"><div class="lbl">Total Loan ($)</div><div class="val" style="color:#34d399">$${contract.amount || contract.totalAmount || 0}</div></div>
            <div class="item"><div class="lbl">Customer Received ($)</div><div class="val" style="color:#38bdf8">$${contract.monthlyPayment || 0}</div></div>
            <div class="item"><div class="lbl">Interest Rate</div><div class="val">${contract.interest || '—'}</div></div>
            <div class="item"><div class="lbl">Duration</div><div class="val">${contract.duration || '—'}</div></div>
        </div>
    </div>

    <!-- Security Status -->
    <div class="card">
        <div class="section-title">🔒 Security Lock Status / ស្ថានភាពសោរ</div>
        <div class="grid-2">
            <div class="item">
                <div class="lbl">Phone Remote Lock</div>
                <div class="val">
                    <span class="status-pill ${contract.lockPhoneStatus === 'Locked' ? 'locked' : 'unlocked'}">
                        ${contract.lockPhoneStatus || 'Unlocked'}
                    </span>
                </div>
            </div>
            <div class="item">
                <div class="lbl">Wallpaper Lock</div>
                <div class="val">
                    <span class="status-pill ${contract.lockWallpaperStatus === 'Locked' ? 'locked' : 'unlocked'}">
                        ${contract.lockWallpaperStatus || 'Unlocked'}
                    </span>
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        SYSTEM MDM — Customer Profile Verification System<br>
        Verified ${today}
    </div>
</body>
</html>`);
    } catch (err) {
        res.status(500).send(`<html><body style="background:#0f172a;color:#f87171;font-family:sans-serif;padding:40px;text-align:center"><h2>Server Error</h2><p>${err.message}</p></body></html>`);
    }
});

// CREATE contract
router.post('/', async (req, res) => {
    try {
        const newContract = {
            contractId: 'CT-2026-' + Math.floor(100 + Math.random() * 900),
            status: 'Application',
            lockPhoneStatus: 'Unlocked',
            lockWallpaperStatus: 'Unlocked',
            ...req.body
        };

        let savedContract = newContract;

        if (isMongoConnected) {
            const doc = new Contract(newContract);
            await doc.save();
            savedContract = doc.toObject();
        }

        MEM_DB.contracts.unshift(savedContract);

        res.status(201).json(savedContract);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE contract
router.put('/:id', async (req, res) => {
    try {
        if (isMongoConnected) {
            const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (updated) return res.json(sanitizeAndDecryptContract(updated));
        }
        const idx = MEM_DB.contracts.findIndex(c => c._id === req.params.id || c.contractId === req.params.id);
        if (idx !== -1) {
            MEM_DB.contracts[idx] = { ...MEM_DB.contracts[idx], ...req.body };
            return res.json(sanitizeAndDecryptContract(MEM_DB.contracts[idx]));
        }
        res.status(404).json({ error: 'Contract not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE contract
router.delete('/:id', async (req, res) => {
    try {
        if (isMongoConnected) await Contract.findByIdAndDelete(req.params.id);
        MEM_DB.contracts = MEM_DB.contracts.filter(c => c._id !== req.params.id);
        res.json({ message: 'Contract deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

