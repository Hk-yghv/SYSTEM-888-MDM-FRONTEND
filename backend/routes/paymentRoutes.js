import express from 'express';
import QRCode from 'qrcode';
import Payment from '../models/Payment.js';
import Contract from '../models/Contract.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel, dbInstances } from '../config/multiDB.js';
import { resolveUserIsolation, applyIsolationFilter, filterInMemoryRecords } from '../utils/brandIsolation.js';

const router = express.Router();

// Helper: normalize a payment doc so paymentImages is always an array
// and image/photo/receiptImage are populated from paymentImages if empty
const normalizePayment = (p) => {
    const obj = p && typeof p.toObject === 'function' ? p.toObject() : { ...p };
    // Ensure paymentImages is always an array
    if (!Array.isArray(obj.paymentImages)) {
        obj.paymentImages = [];
    }
    // If single image fields exist but paymentImages is empty, populate it
    const singleImg = obj.photo || obj.image || obj.receiptImage || '';
    if (obj.paymentImages.length === 0 && singleImg) {
        obj.paymentImages = [singleImg];
    }
    // If paymentImages has items but single fields are empty, fill them
    if (obj.paymentImages.length > 0 && !obj.photo && !obj.image && !obj.receiptImage) {
        obj.photo = obj.paymentImages[0];
        obj.image = obj.paymentImages[0];
        obj.receiptImage = obj.paymentImages[0];
    }
    return obj;
};

// GET complete payment history for one contract
router.get(['/payments/contract/:contractId', '/contract/:contractId'], async (req, res) => {
    try {
        const { contractId } = req.params;
        let payments;
        if (isMongoConnected) {
            payments = await queryAllDBs(Payment, (M) => M.find({ contractId }).sort({ createdAt: -1 }).lean());
        } else {
            payments = MEM_DB.payments
                .filter(payment => payment.contractId === contractId)
                .sort((a, b) => new Date(b.createdAt || b.paidDate) - new Date(a.createdAt || a.paidDate));
        }
        const normalized = payments.map(normalizePayment);
        res.json({ data: normalized, total: normalized.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET payments
router.get(['/payments', '/'], async (req, res) => {
    try {
        const {
            brand = '',
            limit = '10',
            page = '1',
            dateFrom = '',
            dateTo = '',
            search = ''
        } = req.query;
        const isolation = await resolveUserIsolation(req);
        const requestedBrand = isolation.isMasterAdmin ? (brand || isolation.brand) : isolation.brand;
        const isGetAll = limit === 'all' || req.query.all === 'true';
        const parsedLimit = isGetAll ? 999999 : (parseInt(limit) || 10);
        const parsedPage = parseInt(page) || 1;
        const skip = (parsedPage - 1) * parsedLimit;

        if (isMongoConnected) {
            let matchedContractIds = null;
            if (requestedBrand || isolation.hasSubBrandRestriction) {
                let contractQuery = {};
                if (requestedBrand) contractQuery.brand = requestedBrand;
                if (isolation.hasSubBrandRestriction) {
                    contractQuery.subBrand = { $in: isolation.allowedSubBrands };
                }
                const matchedContracts = await queryAllDBs(Contract, (M) => M.find(contractQuery).select('contractId'));
                matchedContractIds = matchedContracts.map(c => c.contractId);
            }
            let allPayments = await queryAllDBs(Payment, (M) => {
                let f = {};
                if (matchedContractIds) f.contractId = { $in: matchedContractIds };
                // Date range filter
                if (dateFrom || dateTo) {
                    f.paidDate = {};
                    if (dateFrom) f.paidDate.$gte = dateFrom;
                    if (dateTo) f.paidDate.$lte = dateTo;
                }
                return M.find(f).sort({ createdAt: -1 }).lean();
            });
            // Normalize paymentImages on every doc
            allPayments = allPayments.map(normalizePayment);
            // Apply search filter in memory (after fetch)
            if (search) {
                const q = search.toLowerCase();
                allPayments = allPayments.filter(p =>
                    (p.customerName || '').toLowerCase().includes(q) ||
                    (p.serialNumber || '').toLowerCase().includes(q) ||
                    (p.contractId || '').toLowerCase().includes(q) ||
                    (p.paidBy || '').toLowerCase().includes(q)
                );
            }
            const total = allPayments.length;
            const totalAmountPaid = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const data = allPayments.slice(skip, skip + parsedLimit);
            return res.json({
                data,
                total,
                page: parsedPage,
                totalPages: Math.ceil(total / parsedLimit),
                summary: {
                    totalPayments: total,
                    totalAmountPaid: Math.round((totalAmountPaid + Number.EPSILON) * 100) / 100
                }
            });
        }

        // MEM_DB path
        let filtered = MEM_DB.payments;
        if (requestedBrand) {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === requestedBrand).map(c => c.contractId);
            filtered = filtered.filter(p => contractIds.includes(p.contractId));
        }
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(p =>
                (p.customerName || '').toLowerCase().includes(q) ||
                (p.serialNumber || '').toLowerCase().includes(q) ||
                (p.contractId || '').toLowerCase().includes(q) ||
                (p.paidBy || '').toLowerCase().includes(q)
            );
        }
        if (dateFrom) filtered = filtered.filter(p => (p.paidDate || '') >= dateFrom);
        if (dateTo) filtered = filtered.filter(p => (p.paidDate || '') <= dateTo);
        const total = filtered.length;
        const totalAmountPaid = filtered.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const data = filtered.slice(skip, skip + parsedLimit);
        res.json({
            data,
            total,
            page: parsedPage,
            totalPages: Math.ceil(total / parsedLimit),
            summary: {
                totalPayments: total,
                totalAmountPaid: Math.round((totalAmountPaid + Number.EPSILON) * 100) / 100
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST payment
router.post(['/payments', '/'], async (req, res) => {
    try {
        const {
            contractId, amount, customerName, photo, image, receiptImage,
            paymentImages, // array from RepaymentScheduleModal
            serialNumber, model, paidDate, paidBy, description,
            paymentType, monthLabel, monthIndex, dueDate, penalty, scheduledAmount
        } = req.body;

        let contract = null;
        if (contractId) {
            if (isMongoConnected) {
                const contracts = await queryAllDBs(Contract, (M) => M.find({ contractId }));
                contract = contracts[0] || null;
            } else {
                contract = MEM_DB.contracts.find(c => c.contractId === contractId);
            }
        }

        const uniquePaymentId = 'PAY-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);

        // Merge all image sources:
        // - paymentImages = array from RepaymentScheduleModal (schedule table pay button)
        // - photo/image/receiptImage = single string from QrPaymentModal
        const imagesArray = Array.isArray(paymentImages) && paymentImages.length > 0
            ? paymentImages.filter(Boolean)
            : [];
        const singleImg = photo || image || receiptImage || imagesArray[0] || '';
        // Combine: single image (if not already in array) + all array images, deduplicated
        const allImages = [...new Set([...(singleImg ? [singleImg] : []), ...imagesArray])].filter(Boolean);
        const proofImg = allImages[0] || '';

        const paymentObj = {
            paymentId: uniquePaymentId,
            contractId: contractId || 'N/A',
            customerName: customerName || contract?.customerNameEn || contract?.customerNameKh || 'Customer',
            photo: proofImg,
            image: proofImg,
            receiptImage: proofImg,
            paymentImages: allImages,
            serialNumber: serialNumber || contract?.serialNumber || 'N/A',
            model: model || contract?.model || 'Device',
            paidDate: paidDate || new Date().toISOString().split('T')[0],
            paidBy: paidBy || 'QR Mobile Payment',
            amount: Number(amount) || 0,
            description: description || '',
            brand: contract?.brand || '',
            subBrand: contract?.subBrand || '',
            paymentType: paymentType || '',
            monthLabel: monthLabel || '',
            monthIndex: Number(monthIndex) || 0,
            dueDate: dueDate || '',
            penalty: Number(penalty) || 0,
            scheduledAmount: Number(scheduledAmount) || 0
        };

        if (isMongoConnected) {
            const PaymentWrite = getWriteModel(Payment) || Payment;
            const doc = new PaymentWrite(paymentObj);
            await doc.save();
            paymentObj._id = doc._id;
        } else {
            paymentObj._id = 'p-' + Date.now();
        }

        MEM_DB.payments.unshift(paymentObj);
        res.status(201).json({ success: true, payment: paymentObj });
    } catch (err) {
        console.error("===== PAYMENT ERROR =====", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Helper: Check if request is from Master Admin / Account admin ធំ
const checkIsMasterAdmin = (req) => {
    const u = req.user || {};
    const bodyUserRole = req.body?.userRole;
    const bodyUsername = req.body?.username;
    const bodyIsImmutable = req.body?.isImmutable;

    return Boolean(
        u.username === '@hakyonghouv' ||
        u.username === 'hakyonghouv' ||
        u.isImmutable === true ||
        u.role === 'Administrator' ||
        u.role === 'Admin' ||
        bodyUsername === '@hakyonghouv' ||
        bodyUsername === 'hakyonghouv' ||
        bodyIsImmutable === true ||
        bodyIsImmutable === 'true' ||
        bodyUserRole === 'Administrator' ||
        bodyUserRole === 'Admin'
    );
};

// PUT /payments/:id — Update a payment record (Master Admin only)
router.put(['/payments/:id', '/:id'], async (req, res) => {
    try {
        if (!checkIsMasterAdmin(req)) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied: Only Administrator can edit payment history records.'
            });
        }

        const { id } = req.params;
        const {
            amount,
            paidDate,
            customerName,
            model,
            serialNumber,
            brand,
            paidBy,
            description,
            contractId,
            receiptImage,
            photo,
            image,
            paymentImages
        } = req.body;

        const updateData = {};
        if (amount !== undefined) updateData.amount = Number(amount) || 0;
        if (paidDate !== undefined) updateData.paidDate = paidDate;
        if (customerName !== undefined) updateData.customerName = customerName;
        if (model !== undefined) updateData.model = model;
        if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
        if (brand !== undefined) updateData.brand = brand;
        if (paidBy !== undefined) updateData.paidBy = paidBy;
        if (description !== undefined) updateData.description = description;
        if (contractId !== undefined) updateData.contractId = contractId;
        if (photo !== undefined) updateData.photo = photo;
        if (image !== undefined) updateData.image = image;
        if (receiptImage !== undefined) updateData.receiptImage = receiptImage;
        if (paymentImages !== undefined) {
            updateData.paymentImages = Array.isArray(paymentImages) ? paymentImages : [paymentImages].filter(Boolean);
            if (!updateData.photo && updateData.paymentImages.length > 0) {
                updateData.photo = updateData.paymentImages[0];
                updateData.image = updateData.paymentImages[0];
                updateData.receiptImage = updateData.paymentImages[0];
            }
        }

        let updatedDoc = null;

        if (isMongoConnected) {
            const filter = {
                $or: [
                    { paymentId: id },
                    ...(id && id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
                ]
            };

            for (const instance of dbInstances) {
                if (instance.status === 'connected' && instance.conn) {
                    try {
                        const M = instance.conn.model('Payment');
                        const doc = await M.findOneAndUpdate(filter, { $set: updateData }, { new: true }).lean();
                        if (doc && !updatedDoc) updatedDoc = doc;
                    } catch (e) {
                        console.warn(`[Payment] Update in ${instance.name} failed:`, e.message);
                    }
                }
            }

            if (!updatedDoc) {
                const PaymentWrite = getWriteModel(Payment) || Payment;
                updatedDoc = await PaymentWrite.findOneAndUpdate(filter, { $set: updateData }, { new: true }).lean();
            }
        }

        // Also sync in MEM_DB
        const memIdx = MEM_DB.payments.findIndex(
            p => p._id?.toString() === id || p.paymentId === id
        );
        if (memIdx !== -1) {
            MEM_DB.payments[memIdx] = {
                ...MEM_DB.payments[memIdx],
                ...updateData
            };
            if (!updatedDoc) updatedDoc = MEM_DB.payments[memIdx];
        }

        if (!updatedDoc) {
            return res.status(404).json({ success: false, error: 'Payment record not found' });
        }

        return res.json({ success: true, payment: normalizePayment(updatedDoc) });
    } catch (err) {
        console.error('Update payment error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /payments/:id — Delete a payment record (Master Admin only)
router.delete(['/payments/:id', '/:id'], async (req, res) => {
    try {
        if (!checkIsMasterAdmin(req)) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied: Only Administrator can delete payment history records.'
            });
        }

        const { id } = req.params;
        const filter = {
            $or: [
                { paymentId: id },
                ...(id && id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
            ]
        };

        if (isMongoConnected) {
            for (const instance of dbInstances) {
                if (instance.status === 'connected' && instance.conn) {
                    try {
                        const M = instance.conn.model('Payment');
                        await M.findOneAndDelete(filter);
                    } catch (e) {
                        console.warn(`[Payment] Delete in ${instance.name} failed:`, e.message);
                    }
                }
            }
        }

        MEM_DB.payments = MEM_DB.payments.filter(
            p => p._id?.toString() !== id && p.paymentId !== id
        );

        return res.json({ success: true, message: 'Payment record deleted successfully.' });
    } catch (err) {
        console.error('Delete payment error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// QR payload
router.get('/payments/qr-payload/:contractId', async (req, res) => {
    try {
        let contract = null;
        if (isMongoConnected) {
            const contracts = await queryAllDBs(Contract, (M) => M.find({ contractId: req.params.contractId }));
            contract = contracts[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === req.params.contractId);
        }
        if (!contract) return res.status(404).json({ error: 'Activated contract not found' });

        const payloadData = {
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh})`,
            photo: contract.customerPhoto,
            serialNumber: contract.serialNumber,
            model: contract.model,
            suggestedAmount: contract.monthlyPayment
        };

        const publicBaseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const paymentPageUrl = `${publicBaseUrl.replace(/\/$/, '')}/pay/${encodeURIComponent(contract.contractId)}`;
        const qrDataUrl = await QRCode.toDataURL(paymentPageUrl);
        res.json({ payload: payloadData, qrDataUrl, paymentPageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── QR Payment Page (Mobile) ──
// Served when customer scans QR code on their phone
router.get('/pay/:contractId', async (req, res) => {
    try {
        const { contractId } = req.params;
        let contract = null;
        if (isMongoConnected) {
            const contracts = await queryAllDBs(Contract, (M) => M.find({ contractId }));
            contract = contracts[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === contractId);
        }

        if (!contract) {
            return res.status(404).send(`
                <!DOCTYPE html><html lang="km"><head><meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>មិនរកឃើញ</title>
                <style>body{margin:0;background:#0f172a;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}h2{color:#f87171}p{color:#94a3b8;font-size:14px}</style>
                </head><body><div><h2>❌ Contract Not Found</h2><p>Contract ID: ${contractId}</p></div></body></html>
            `);
        }

        // Get recent payments for this contract
        let recentPayments = [];
        try {
            if (isMongoConnected) {
                const Payment = (await import('../models/Payment.js')).default;
                recentPayments = await Payment.find({ contractId }).sort({ createdAt: -1 }).limit(5);
            } else {
                recentPayments = MEM_DB.payments.filter(p => p.contractId === contractId).slice(0, 5);
            }
        } catch (e) { /* ignore */ }

        const totalPaid = recentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const photoUrl = contract.customerPhoto || contract.googleDrivePhotoUrl || '';
        const amountDue = contract.monthlyPayment || 100;
        const today = new Date().toLocaleDateString('km-KH', { year: 'numeric', month: 'long', day: 'numeric' });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>💳 Payment — ${contract.contractId}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; padding: 16px; padding-bottom: 40px; }
        .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px; margin-bottom: 14px; backdrop-filter: blur(10px); }
        .header { text-align: center; padding: 12px 0 8px; }
        .badge { display: inline-block; background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
        .contract-id { font-size: 13px; color: #94a3b8; margin-bottom: 2px; }
        .photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid #10b981; margin: 10px auto; display: block; background: #1e293b; }
        .photo-placeholder { width: 84px; height: 84px; border-radius: 50%; border: 3px solid #475569; margin: 10px auto; display: flex; align-items: center; justify-content: center; font-size: 32px; background: #1e293b; }
        .name-en { font-size: 18px; font-weight: 800; text-align: center; color: #f1f5f9; }
        .name-kh { font-size: 14px; font-weight: 600; text-align: center; color: #94a3b8; margin-top: 2px; }
        .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .row .label { color: #64748b; font-weight: 600; }
        .row .value { color: #e2e8f0; font-weight: 700; text-align: right; max-width: 60%; }
        .section-title { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }

        /* Payment Form Elements */
        .input-group { margin-bottom: 12px; }
        .input-label { display: block; font-size: 12px; font-weight: 700; color: #10b981; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .amount-input-wrapper { position: relative; display: flex; align-items: center; }
        .currency-symbol { position: absolute; left: 16px; font-size: 24px; font-weight: 900; color: #10b981; font-family: monospace; }
        .pay-input { width: 100%; background: #090d16; border: 2px solid #10b981; border-radius: 16px; padding: 14px 16px 14px 42px; font-size: 28px; font-weight: 900; color: #fff; font-family: monospace; outline: none; transition: border-color 0.2s; }
        .pay-input:focus { border-color: #34d399; box-shadow: 0 0 15px rgba(16,185,129,0.3); }

        .quick-amounts { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
        .btn-quick { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .btn-quick:active, .btn-quick.active { background: #10b981; color: #fff; border-color: #10b981; }

        .btn-pay { width: 100%; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #fff; font-size: 16px; font-weight: 800; padding: 16px; border: none; border-radius: 16px; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(16,185,129,0.4); transition: transform 0.1s, box-shadow 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-pay:active { transform: scale(0.98); }

        .pay-row { display: flex; justify-content: space-between; font-size: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .pay-row .p-date { color: #94a3b8; }
        .pay-row .p-amt { color: #10b981; font-weight: 700; font-family: monospace; }
        .total-paid { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .total-paid span:first-child { font-size: 12px; color: #64748b; font-weight: 700; }
        .total-paid span:last-child { font-size: 16px; color: #10b981; font-weight: 900; font-family: monospace; }

        /* Modal Overlay */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; padding: 20px; z-index: 99999; }
        .modal-overlay.active { display: flex; }
        .modal-box { background: #1e293b; border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; padding: 24px; width: 100%; max-width: 360px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .modal-title { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .modal-desc { font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5; }
        .modal-amount { font-size: 32px; font-weight: 900; color: #10b981; font-family: monospace; margin: 10px 0 20px; }
        .modal-btns { display: flex; gap: 10px; }
        .btn-cancel { flex: 1; background: rgba(255,255,255,0.1); color: #cbd5e1; border: none; padding: 14px; border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .btn-confirm { flex: 1; background: #10b981; color: #fff; border: none; padding: 14px; border-radius: 14px; font-weight: 800; font-size: 14px; cursor: pointer; }

        /* Success Card */
        .success-box { background: rgba(16,185,129,0.15); border: 2px solid #10b981; border-radius: 16px; padding: 16px; text-align: center; display: none; margin-bottom: 14px; animation: popIn 0.3s ease; }
        .success-box.active { display: block; }
        @keyframes popIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
    </style>
</head>
<body>
    <div class="header">
        <div class="badge">💳 QR Mobile Payment</div>
        <div class="contract-id">Contract: <strong>${contract.contractId}</strong></div>
        <div class="contract-id" style="font-size:11px;color:#475569">${today}</div>
    </div>

    <!-- Customer Card -->
    <div class="card">
        ${photoUrl
            ? `<img src="${photoUrl}" class="photo" alt="Customer Photo" onerror="this.style.display='none'">`
            : `<div class="photo-placeholder">👤</div>`
        }
        <div class="name-en">${contract.customerNameEn || '—'}</div>
        <div class="name-kh">${contract.customerNameKh || ''}</div>
    </div>

    <!-- Success Message Alert -->
    <div id="successBox" class="success-box">
        <div style="font-size:32px;margin-bottom:4px">🎉</div>
        <div style="font-size:16px;font-weight:800;color:#34d399">បង់ប្រាក់បានជោគជ័យ!</div>
        <div id="successDetails" style="font-size:12px;color:#cbd5e1;margin-top:4px">Payment submitted successfully</div>
    </div>

    <!-- Interactive Payment Card -->
    <div class="card">
        <div class="section-title">💵 បញ្ចូលទឹកប្រាក់ត្រូវបង់ (Enter Payment Amount)</div>
        <div class="input-group">
            <label class="input-label">ទឹកប្រាក់ដែលត្រូវបង់ ($ USD)</label>
            <div class="amount-input-wrapper">
                <span class="currency-symbol">$</span>
                <input type="number" id="payAmount" value="${amountDue}" step="any" min="1" class="pay-input" placeholder="0.00" />
            </div>
        </div>

        <div class="quick-amounts">
            <button type="button" class="btn-quick" onclick="setAmount(50)">$50</button>
            <button type="button" class="btn-quick" onclick="setAmount(100)">$100</button>
            <button type="button" class="btn-quick" onclick="setAmount(150)">$150</button>
            <button type="button" class="btn-quick" onclick="setAmount(200)">$200</button>
            <button type="button" class="btn-quick active" onclick="setAmount(${amountDue})">Full ($${amountDue})</button>
        </div>

        <button type="button" id="payBtn" onclick="openConfirmModal()" class="btn-pay">
            <span>💳 បង់ប្រាក់ (Pay Now)</span>
        </button>
    </div>

    <!-- Device Details -->
    <div class="card">
        <div class="section-title">📱 Details / ព័ត៌មានឧបករណ៍</div>
        <div class="row"><span class="label">Model</span><span class="value">${contract.model || '—'}</span></div>
        <div class="row"><span class="label">Brand</span><span class="value">${contract.brand || '—'}</span></div>
        <div class="row"><span class="label">Serial</span><span class="value" style="font-family:monospace;font-size:11px">${contract.serialNumber || '—'}</span></div>
        <div class="row"><span class="label">Monthly Payment</span><span class="value" style="color:#10b981 font-mono">$${amountDue}</span></div>
        <div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">${contract.status}</span></div>
    </div>

    <!-- Recent Payments -->
    <div class="card" id="historyCard">
        <div class="section-title">📋 ប្រវត្តិបង់ប្រាក់ចុងក្រោយ (Payment History)</div>
        <div id="paymentHistoryList">
            ${recentPayments.length > 0 ? recentPayments.map(p => `
                <div class="pay-row">
                    <span class="p-date">${p.paidDate || p.paymentDate || '—'} &nbsp; (${p.paidBy || 'QR Payment'})</span>
                    <span class="p-amt">$${Number(p.amount || 0).toLocaleString()}</span>
                </div>
            `).join('') : '<div style="font-size:12px;color:#64748b;text-align:center;padding:10px">មិនទាន់មានប្រវត្តិបង់ប្រាក់</div>'}
        </div>
        <div class="total-paid">
            <span>សរុបបានបង់ (Total Paid)</span>
            <span id="totalPaidAmt">$${totalPaid.toLocaleString()}</span>
        </div>
    </div>

    <!-- Confirmation Modal -->
    <div id="confirmModal" class="modal-overlay">
        <div class="modal-box">
            <div style="font-size:40px;margin-bottom:8px">❓</div>
            <div class="modal-title">បញ្ជាក់ការបង់ប្រាក់</div>
            <div class="modal-desc">តើអ្នកពិតជាចង់បង់ប្រាក់ចំនួននេះសម្រាប់កិច្ចសន្យា <strong>${contract.contractId}</strong> មែនទេ?</div>
            <div class="modal-amount" id="modalDisplayAmt">$0</div>
            <div class="modal-btns">
                <button type="button" class="btn-cancel" onclick="closeConfirmModal()">លុបចោល</button>
                <button type="button" class="btn-confirm" id="confirmBtn" onclick="submitPayment()">យល់ព្រមបង់</button>
            </div>
        </div>
    </div>

    <script>
        const contractData = {
            contractId: "${contract.contractId}",
            customerName: "${contract.customerNameEn || ''} (${contract.customerNameKh || ''})",
            serialNumber: "${contract.serialNumber || ''}",
            model: "${contract.model || ''}"
        };

        function setAmount(val) {
            document.getElementById('payAmount').value = val;
            document.querySelectorAll('.btn-quick').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
        }

        function openConfirmModal() {
            const amt = parseFloat(document.getElementById('payAmount').value);
            if (!amt || amt <= 0) {
                alert('សូមបញ្ចូលទឹកប្រាក់ត្រឹមត្រូវ!');
                return;
            }
            document.getElementById('modalDisplayAmt').innerText = '$' + amt.toLocaleString();
            document.getElementById('confirmModal').classList.add('active');
        }

        function closeConfirmModal() {
            document.getElementById('confirmModal').classList.remove('active');
        }

        async function submitPayment() {
            const amt = parseFloat(document.getElementById('payAmount').value);
            const confirmBtn = document.getElementById('confirmBtn');
            confirmBtn.innerText = 'កំពុងដំណើរការ...';
            confirmBtn.disabled = true;

            const payload = {
                contractId: contractData.contractId,
                customerName: contractData.customerName || 'Customer',
                serialNumber: contractData.serialNumber || 'N/A',
                model: contractData.model || 'Device',
                amount: amt,
                paidDate: new Date().toISOString().split('T')[0],
                paidBy: 'QR Mobile Payment',
                description: 'Paid via QR Code Mobile Scanner'
            };

            try {
                // This page is public, so use the public payment route directly.
                const res = await fetch('/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                closeConfirmModal();
                confirmBtn.innerText = 'យល់ព្រមបង់';
                confirmBtn.disabled = false;

                if (res.ok) {
                    // Show success
                    document.getElementById('successDetails').innerText = 'បានបង់ប្រាក់ចំនួន $' + amt + ' ជោគជ័យ!';
                    document.getElementById('successBox').classList.add('active');

                    // Prepend to history UI
                    const list = document.getElementById('paymentHistoryList');
                    if (list.innerHTML.includes('មិនទាន់មាន')) {
                        list.innerHTML = '';
                    }
                    const newRow = document.createElement('div');
                    newRow.className = 'pay-row';
                    newRow.innerHTML = '<span class="p-date">' + payload.paidDate + ' &nbsp; (QR Mobile Payment)</span><span class="p-amt">$' + amt + '</span>';
                    list.insertBefore(newRow, list.firstChild);

                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    const errData = await res.json().catch(() => ({}));
                    alert('មានបញ្ហាក្នុងការបង់ប្រាក់: ' + (errData.error || errData.message || 'HTTP ' + res.status));
                }
            } catch (err) {
                closeConfirmModal();
                confirmBtn.innerText = 'យល់ព្រមបង់';
                confirmBtn.disabled = false;
                alert('Connection Error: ' + err.message);
            }
        }
    </script>
</body>
</html>`);
    } catch (err) {
        res.status(500).send(`<html><body style="background:#0f172a;color:#f87171;font-family:sans-serif;padding:40px;text-align:center"><h2>Server Error</h2><p>${err.message}</p></body></html>`);
    }
});

export default router;
