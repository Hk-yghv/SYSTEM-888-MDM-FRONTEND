import express from 'express';
import QRCode from 'qrcode';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { generateCustomerPdf } from '../utils/customerPdfGenerator.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

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
        const { status, userBrand, userRole, username, isImmutable, page = 1, limit = 10, search = '', dateFrom = '', dateTo = '', requireSchedule = false } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || isImmutable === true);
        const needsSchedule = requireSchedule === 'true' || requireSchedule === true;

        let query = {};
        if (status === 'Comments') {
            query.$and = [{
                $or: [
                    { status: 'Comments' },
                    { status: 'Activated', notes: { $exists: true, $nin: ['', null] } }
                ]
            }];
        } else if (status) {
            query.status = status;
        }

        const brandFilter = req.query.brand || userBrand;
        if (brandFilter && (!isMasterAdmin || req.query.brand)) {
            query.brand = brandFilter;
        }

        if (dateFrom || dateTo) {
            const dueDateFilter = {};
            if (dateFrom) dueDateFilter.$gte = dateFrom;
            if (dateTo) dueDateFilter.$lte = dateTo;
            query.$and = [...(query.$and || []), { repaymentSchedule: { $elemMatch: { dueDate: dueDateFilter } } }];
        }

        if (search) {
            const searchQuery = [
                { customerNameEn: { $regex: search, $options: 'i' } },
                { customerNameKh: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { contractId: { $regex: search, $options: 'i' } },
                { contractIid: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
            query.$and = [...(query.$and || []), { $or: searchQuery }];
        }

        if (needsSchedule) {
            query.$and = [...(query.$and || []), { repaymentSchedule: { $exists: true, $ne: [] } }];
        }

        if (isMongoConnected) {
            const allContracts = await queryAllDBs(Contract, (M) => M.find(query).sort({ createdAt: -1 }));
            const total = allContracts.length;
            let actualSkip = skip;
            let actualPage = parseInt(page) || 1;
            if (actualSkip >= total && total > 0) {
                actualSkip = 0;
                actualPage = 1;
            }
            const contracts = allContracts.slice(actualSkip, actualSkip + parseInt(limit));
            const data = contracts.map(sanitizeAndDecryptContract);
            return res.json({ data, total, page: actualPage, totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.contracts;
        if (status === 'Comments') {
            filtered = filtered.filter(c => c.status === 'Comments' || (c.status === 'Activated' && c.notes));
        } else if (status) {
            filtered = filtered.filter(c => c.status === status);
        }
        if (brandFilter && (!isMasterAdmin || req.query.brand)) filtered = filtered.filter(c => c.brand === brandFilter);
        if (dateFrom || dateTo) {
            filtered = filtered.filter(c => {
                const schedule = Array.isArray(c.repaymentSchedule) ? c.repaymentSchedule : [];
                return schedule.some(row => {
                    if (!row.dueDate) return false;
                    if (dateFrom && row.dueDate < dateFrom) return false;
                    if (dateTo && row.dueDate > dateTo) return false;
                    return true;
                });
            });
        }
        if (search) filtered = filtered.filter(c =>
            (c.customerNameEn || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.customerNameKh || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.contractId || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.contractIid || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.model || '').toLowerCase().includes(search.toLowerCase())
        );
        if (needsSchedule) {
            filtered = filtered.filter(c => Array.isArray(c.repaymentSchedule) && c.repaymentSchedule.length > 0);
        }
        const total = filtered.length;
        let actualSkip = skip;
        let actualPage = parseInt(page) || 1;
        if (actualSkip >= total && total > 0) {
            actualSkip = 0;
            actualPage = 1;
        }
        const data = filtered.slice(actualSkip, actualSkip + parseInt(limit)).map(sanitizeAndDecryptContract);
        res.json({ data, total, page: actualPage, totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Customer QR payload
router.get('/customer-qr-payload/:contractId', async (req, res) => {
    try {
        let contract = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) => M.find({ contractId: req.params.contractId }));
            contract = results[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === req.params.contractId);
        }

        if (!contract) return res.status(404).json({ error: 'Customer contract not found' });

        const infoPageUrl = `${req.protocol}://${req.get('host')}/contracts/customer-info/${encodeURIComponent(contract.contractId)}`;
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
        let contract = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) => M.find({ contractId }));
            contract = results[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === contractId);
        }

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
        let paymentHistory = [];
        if (isMongoConnected) {
            paymentHistory = await queryAllDBs(Payment, (M) => M.find({ contractId }).sort({ createdAt: -1 }));
        } else {
            paymentHistory = MEM_DB.payments
                .filter(payment => payment.contractId === contractId)
                .sort((a, b) => new Date(b.createdAt || b.paidDate) - new Date(a.createdAt || a.paidDate));
        }
        const totalPaid = paymentHistory.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
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

    <!-- Payment History -->
    <div class="card">
        <div class="section-title">💳 Payment History / ប្រវត្តិបង់ប្រាក់</div>
        ${paymentHistory.length > 0 ? paymentHistory.map(payment => `
            <div class="row">
                <span class="label">${payment.paidDate || payment.paymentDate || '—'} · ${payment.paidBy || 'System'}</span>
                <span class="value" style="color:#34d399">$${Number(payment.amount || 0).toLocaleString()}</span>
            </div>
            <div style="font-size:11px;color:#64748b;padding:0 0 7px">${payment.description || '—'}</div>
        `).join('') : '<div style="font-size:12px;color:#64748b;text-align:center;padding:10px">មិនទាន់មានប្រវត្តិបង់ប្រាក់</div>'}
        <div class="total-paid" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:10px 14px;display:flex;justify-content:space-between;margin-top:8px">
            <span style="font-size:12px;color:#64748b;font-weight:700">សរុបបានបង់ (Total Paid)</span>
            <span style="font-size:16px;color:#10b981;font-weight:900;font-family:monospace">$${totalPaid.toLocaleString()}</span>
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

// GET /:id/pdf — Export Customer Profile and Repayment Schedule as downloadable PDF
router.get('/:id/pdf', async (req, res) => {
    try {
        const id = req.params.id;
        let contract = null;
        if (isMongoConnected) {
            const contracts = await queryAllDBs(Contract, (M) => M.find({ $or: [{ contractId: id }, { _id: id }] }));
            contract = contracts[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === id || c._id === id);
        }

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        let payments = [];
        if (isMongoConnected) {
            payments = await queryAllDBs(Payment, (M) => M.find({ contractId: contract.contractId }));
        } else if (MEM_DB.payments) {
            payments = MEM_DB.payments.filter(p => p.contractId === contract.contractId);
        }

        const pdfBuffer = await generateCustomerPdf(contract, payments, contract.brand || req.query.brand || '');
        const filename = `Report_${(contract.contractId || id).replace(/[^a-zA-Z0-9_\-]/g, '_')}_${(contract.customerNameEn || 'Customer').replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    } catch (err) {
        console.error('PDF export route error:', err);
        res.status(500).json({ error: err.message });
    }
});

const generateUniqueContractId = async (currentYear = new Date().getFullYear()) => {
    for (let i = 0; i < 20; i++) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const candidate = `CT-${currentYear}-${randomNum}`;
        let exists = false;
        if (isMongoConnected) {
            const found = await queryAllDBs(Contract, (M) => M.findOne({ contractId: candidate }));
            exists = Array.isArray(found) && found.some(doc => doc !== null);
        } else {
            exists = MEM_DB.contracts.some(c => c.contractId === candidate);
        }
        if (!exists) return candidate;
    }
    return `CT-${currentYear}-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
};

// CREATE contract
router.post('/', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        let targetContractId = (req.body.contractId || '').trim();

        if (targetContractId) {
            let exists = false;
            if (isMongoConnected) {
                const found = await queryAllDBs(Contract, (M) => M.findOne({ contractId: targetContractId }));
                exists = Array.isArray(found) && found.some(doc => doc !== null);
            } else {
                exists = MEM_DB.contracts.some(c => c.contractId === targetContractId);
            }
            if (exists) {
                targetContractId = await generateUniqueContractId(currentYear);
            }
        } else {
            targetContractId = await generateUniqueContractId(currentYear);
        }

        const newContract = {
            ...req.body,
            contractId: targetContractId,
            contractIid: req.body.contractIid || '',
            status: req.body.status || 'Application',
            lockPhoneStatus: req.body.lockPhoneStatus || 'Unlocked',
            lockWallpaperStatus: req.body.lockWallpaperStatus || 'Unlocked',
            editHistory: [{
                timestamp: new Date(),
                editedBy: req.body.lastModifiedBy || req.user?.username || 'Staff',
                reason: 'Initial contract creation',
                changedFields: ['contractId', 'customerNameEn', 'customerNameKh', 'model', 'amount'],
                previousData: {}
            }]
        };

        let savedContract = newContract;

        if (isMongoConnected) {
            const ContractWrite = getWriteModel(Contract) || Contract;
            let doc = new ContractWrite(newContract);
            try {
                await doc.save();
            } catch (saveErr) {
                if (saveErr.code === 11000 || (saveErr.message && saveErr.message.includes('E11000'))) {
                    const fallbackId = `CT-${currentYear}-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
                    doc.contractId = fallbackId;
                    await doc.save();
                    newContract.contractId = fallbackId;
                } else {
                    throw saveErr;
                }
            }
            savedContract = doc.toObject();
        }

        MEM_DB.contracts.unshift(savedContract);

        // Record Audit Log
        recordSystemAudit({
            category: 'Contract',
            level: 'Information',
            action: 'CONTRACT_CREATE',
            taskCategory: 'Customer Application',
            description: `Created new contract ${savedContract.contractId} for ${savedContract.customerNameEn || savedContract.customerNameKh}`,
            username: req.user?.username || req.body.lastModifiedBy || 'Staff',
            brand: savedContract.brand || '',
            contractId: savedContract.contractId,
            payload: { customerNameEn: savedContract.customerNameEn, model: savedContract.model, amount: savedContract.amount }
        }).catch(() => {});

        res.status(201).json(savedContract);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE contract
router.put('/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.__v;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        // Fetch existing contract to capture prior state and compute diff
        let existingContract = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) => M.findOne({ $or: [{ _id: req.params.id }, { contractId: req.params.id }] }));
            existingContract = results[0] || null;
        } else {
            existingContract = MEM_DB.contracts.find(c => c._id === req.params.id || c.contractId === req.params.id);
        }

        const changedFields = [];
        const diff = {};
        let prevObj = {};
        if (existingContract) {
            prevObj = existingContract.toObject ? existingContract.toObject() : { ...existingContract };
            for (const key in updateData) {
                if (key === 'editHistory' || key === 'lastModifiedBy' || key === 'modifiedByAdmin') continue;
                if (JSON.stringify(prevObj[key]) !== JSON.stringify(updateData[key])) {
                    changedFields.push(key);
                    diff[key] = {
                        old: prevObj[key] !== undefined && prevObj[key] !== null ? prevObj[key] : '',
                        new: updateData[key] !== undefined && updateData[key] !== null ? updateData[key] : ''
                    };
                }
            }

            if (changedFields.length > 0) {
                const historyList = Array.isArray(prevObj.editHistory) ? [...prevObj.editHistory] : [];
                const previousSnapshot = { ...prevObj };
                delete previousSnapshot.editHistory;

                historyList.unshift({
                    timestamp: new Date(),
                    editedBy: req.body.lastModifiedBy || req.user?.username || 'Staff',
                    reason: `Updated ${changedFields.join(', ')}`,
                    changedFields,
                    diff,
                    previousData: previousSnapshot
                });

                if (historyList.length > 30) historyList.length = 30; // Keep up to 30 past revisions
                updateData.editHistory = historyList;
                updateData.modifiedByAdmin = true;
                updateData.lastModifiedBy = req.body.lastModifiedBy || req.user?.username || 'Staff';
            }
        }

        let updatedDoc = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, async (BoundM) => {
                try {
                    let doc = await BoundM.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
                    if (!doc) {
                        doc = await BoundM.findOneAndUpdate({ contractId: req.params.id }, { $set: updateData }, { new: true });
                    }
                    return doc ? [doc] : [];
                } catch {
                    return [];
                }
            });
            if (results && results.length > 0) {
                updatedDoc = results[0];
            }
            if (!updatedDoc) {
                const WriteModel = getWriteModel(Contract);
                if (WriteModel) {
                    try {
                        updatedDoc = await WriteModel.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }) ||
                                     await WriteModel.findOneAndUpdate({ contractId: req.params.id }, { $set: updateData }, { new: true });
                    } catch {}
                }
            }
        }

        const idx = MEM_DB.contracts.findIndex(c => c._id === req.params.id || c.contractId === req.params.id);
        if (idx !== -1) {
            MEM_DB.contracts[idx] = { ...MEM_DB.contracts[idx], ...updateData };
            if (!updatedDoc) updatedDoc = MEM_DB.contracts[idx];
        }

        if (updatedDoc) {
            // Record Audit Log with detailed Before vs After field diffs
            const diffSummary = changedFields.slice(0, 5).map(f => `${f}: "${typeof diff[f]?.old === 'object' ? JSON.stringify(diff[f]?.old) : diff[f]?.old}" ➔ "${typeof diff[f]?.new === 'object' ? JSON.stringify(diff[f]?.new) : diff[f]?.new}"`).join(', ');
            const custName = updatedDoc.customerNameEn || updatedDoc.customerNameKh || '';
            recordSystemAudit({
                category: 'Contract',
                level: 'Information',
                action: 'CONTRACT_UPDATE',
                taskCategory: 'Contract Modification',
                description: `Updated contract ${updatedDoc.contractId || req.params.id}${custName ? ` (${custName})` : ''}: ${diffSummary || 'General Update'}${changedFields.length > 5 ? ` (+${changedFields.length - 5} more fields)` : ''}`,
                username: req.user?.username || req.body.lastModifiedBy || 'Staff',
                brand: updatedDoc.brand || '',
                contractId: updatedDoc.contractId || req.params.id,
                customerId: updatedDoc.customerId || '',
                payload: { diff, changedFields, updatedFields: updateData, previousData: prevObj }
            }).catch(() => {});

            return res.json(sanitizeAndDecryptContract(updatedDoc));
        }

        res.status(404).json({ error: 'Contract not found' });
    } catch (err) {
        console.error('Update contract error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE contract (Permanent in MongoDB, but archived/never deleted in Firebase)
router.delete('/:id', async (req, res) => {
    try {
        let deletedContractId = req.params.id;
        let targetContract = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) =>
                M.findOne({ $or: [{ _id: req.params.id }, { contractId: req.params.id }] })
            );
            targetContract = results.find(r => r != null) || null;

            await Promise.allSettled(
                [Contract].map(async (M) => {
                    await queryAllDBs(M, async (BoundM) => {
                        try { await BoundM.findByIdAndDelete(req.params.id); } catch {}
                        try { await BoundM.deleteMany({ contractId: req.params.id }); } catch {}
                        return [];
                    });
                })
            );
        } else {
            targetContract = MEM_DB.contracts.find(c => c._id === req.params.id || c.contractId === req.params.id) || null;
        }

        MEM_DB.contracts = MEM_DB.contracts.filter(c => c._id !== req.params.id && c.contractId !== req.params.id);

        const customerName = targetContract?.customerName || targetContract?.name || targetContract?.customerInfo?.name || 'N/A';
        const phone = targetContract?.phoneNumber || targetContract?.phone || targetContract?.customerInfo?.phone || 'N/A';
        const imei = targetContract?.imei1 || targetContract?.imei || targetContract?.deviceInfo?.imei1 || 'N/A';
        const brand = targetContract?.brand || req.user?.brand || '';

        // Record Audit Log with full pre-deletion data
        recordSystemAudit({
            category: 'Contract',
            level: 'Warning',
            action: 'CONTRACT_DELETE',
            taskCategory: 'Contract Removal',
            description: `Deleted contract ${targetContract?.contractId || deletedContractId} (Customer: ${customerName}, Phone: ${phone}, IMEI: ${imei})`,
            username: req.user?.username || req.query?.username || 'Staff',
            name: req.user?.name || '',
            role: req.user?.role || 'Staff',
            brand,
            contractId: targetContract?.contractId || deletedContractId,
            customerId: targetContract?.customerId || '',
            payload: {
                deletedData: targetContract || { contractId: deletedContractId },
                deletedContractId
            }
        }).catch(() => {});

        res.json({ message: 'Contract deleted from MongoDB (Archived in Firebase backup)' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to robustly parse any date string
const parseAnyDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) return dateStr;
    const str = String(dateStr).trim();
    if (!str) return null;

    // ISO or YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
    let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const d = parseInt(match[3], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (match) {
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const y = parseInt(match[3], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
    }

    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
};

// GET payment alerts (Due Today & Overdue Payments with Brand Scoping)
router.get('/payment-alerts', async (req, res) => {
    try {
        const { userBrand, username, isImmutable } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || isImmutable === true);

        let contractQuery = { status: { $ne: 'Redeem' } };
        if (userBrand && !isMasterAdmin) {
            const escaped = userBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cleanBrand = escaped.replace(/^system\s*/i, '');
            contractQuery.$or = [
                { brand: { $regex: escaped, $options: 'i' } },
                { brand: { $regex: cleanBrand, $options: 'i' } }
            ];
        }

        let contracts = [];
        let payments = [];

        if (isMongoConnected) {
            contracts = await queryAllDBs(Contract, (M) => M.find(contractQuery).sort({ createdAt: -1 }));
            payments = await queryAllDBs(Payment, (M) => M.find({}).sort({ createdAt: -1 }));
        } else {
            contracts = MEM_DB.contracts.filter(c => c.status !== 'Redeem');
            if (userBrand && !isMasterAdmin) {
                const bLower = userBrand.toLowerCase();
                contracts = contracts.filter(c => (c.brand || '').toLowerCase().includes(bLower));
            }
            payments = MEM_DB.payments;
        }

        // Map payments by contractId
        const paymentMap = {};
        for (const p of payments) {
            const cid = p.contractId;
            if (!cid) continue;
            if (!paymentMap[cid]) {
                paymentMap[cid] = { totalPaid: 0, count: 0, lastPaidDate: null };
            }
            const amt = Number(p.amount) || 0;
            paymentMap[cid].totalPaid += amt;
            paymentMap[cid].count += 1;
            const pDate = p.paidDate || p.createdAt || p.paymentDate;
            if (pDate) {
                const parsed = parseAnyDate(pDate);
                if (parsed) {
                    if (!paymentMap[cid].lastPaidDate || parsed > paymentMap[cid].lastPaidDate) {
                        paymentMap[cid].lastPaidDate = parsed;
                    }
                }
            }
        }

        const now = new Date();
        const dueTodayList = [];
        const dueIn1DayList = [];
        const dueIn3DaysList = [];
        const overdue3DaysList = [];
        const overdue7DaysList = [];
        const overdueList = [];

        for (const c of contracts) {
            const sanitized = sanitizeAndDecryptContract(c);
            const cid = sanitized.contractId;
            const pInfo = paymentMap[cid] || { totalPaid: 0, count: 0, lastPaidDate: null };

            const totalAmount = Number(sanitized.totalAmount || sanitized.amount) || 0;
            const monthlyPayment = Number(sanitized.monthlyPayment) || (totalAmount / 12) || 50;
            const totalPaid = pInfo.totalPaid;
            const remainingBalance = Math.max(0, totalAmount - totalPaid);

            // Skip if loan is fully paid off
            if (totalAmount > 0 && remainingBalance <= 0) continue;

            // Parse start date
            let startDate = parseAnyDate(sanitized.inputDate) || parseAnyDate(sanitized.createdAt) || now;

            // Calculate months paid so far
            const monthsPaid = Math.floor(totalPaid / (monthlyPayment || 1));

            // Target due date calculation
            let targetDueDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthsPaid + 1, startDate.getDate());

            // Calculate difference in days between targetDueDate and Today
            const diffTime = now.getTime() - targetDueDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

            const formattedDueDate = `${targetDueDate.getFullYear()}-${String(targetDueDate.getMonth() + 1).padStart(2, '0')}-${String(targetDueDate.getDate()).padStart(2, '0')}`;

            // Helper to format Khmer duration
            let overdueText = '';
            if (diffDays > 0) {
                const months = Math.floor(diffDays / 30);
                const days = diffDays % 30;
                if (months > 0 && days > 0) {
                    overdueText = `លើស ${months} ខែ ${days} ថ្ងៃ`;
                } else if (months > 0) {
                    overdueText = `លើស ${months} ខែ`;
                } else {
                    overdueText = `លើស ${days} ថ្ងៃ`;
                }
            }

            const alertItem = {
                contractId: cid,
                customerNameEn: sanitized.customerNameEn || '',
                customerNameKh: sanitized.customerNameKh || '',
                phone: sanitized.phone || '',
                brand: sanitized.brand || 'SYSTEM MDM',
                model: sanitized.model || '',
                serialNumber: sanitized.serialNumber || '',
                monthlyPayment,
                totalAmount,
                totalPaid,
                remainingBalance,
                dueDate: formattedDueDate,
                overdueDays: Math.max(0, diffDays),
                daysLeft: diffDays < 0 ? Math.abs(diffDays) : 0,
                overdueText,
                lockPhoneStatus: sanitized.lockPhoneStatus || 'Unlocked',
                lockWallpaperStatus: sanitized.lockWallpaperStatus || 'Unlocked',
                status: sanitized.status || 'Activated'
            };

            // Categorize alerts
            if (diffDays > 0) {
                overdueList.push(alertItem);
                if (diffDays >= 3 && diffDays <= 6) {
                    overdue3DaysList.push(alertItem);
                }
                if (diffDays >= 7 && diffDays <= 14) {
                    overdue7DaysList.push(alertItem);
                }
            } else if (diffDays === 0) {
                dueTodayList.push(alertItem);
            } else if (diffDays === -1) {
                dueIn1DayList.push(alertItem);
                dueIn3DaysList.push(alertItem);
            } else if (diffDays >= -3) {
                dueIn3DaysList.push(alertItem);
            }
        }

        // Sort lists
        overdueList.sort((a, b) => b.overdueDays - a.overdueDays);
        overdue3DaysList.sort((a, b) => b.overdueDays - a.overdueDays);
        overdue7DaysList.sort((a, b) => b.overdueDays - a.overdueDays);
        dueTodayList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        dueIn1DayList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        dueIn3DaysList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        res.json({
            success: true,
            brand: userBrand || 'ALL',
            summary: {
                dueTodayCount: dueTodayList.length,
                dueIn1DayCount: dueIn1DayList.length,
                dueIn3DaysCount: dueIn3DaysList.length,
                overdue3DaysCount: overdue3DaysList.length,
                overdue7DaysCount: overdue7DaysList.length,
                overdueCount: overdueList.length,
                totalAlerts: dueTodayList.length + dueIn1DayList.length + dueIn3DaysList.length + overdue3DaysList.length + overdue7DaysList.length + overdueList.length
            },
            dueTodayList,
            dueIn1DayList,
            dueIn3DaysList,
            overdue3DaysList,
            overdue7DaysList,
            overdueList
        });
    } catch (err) {
        console.error('Payment alerts calculation error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
