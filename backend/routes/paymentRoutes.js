import express from 'express';
import QRCode from 'qrcode';
import Payment from '../models/Payment.js';
import Contract from '../models/Contract.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

// GET payments
router.get('/payments', async (req, res) => {
    try {
        const { userBrand, userRole, page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }
        if (search) {
            filter.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { paidBy: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const total = await Payment.countDocuments(filter);
            const data = await Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.payments;
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(p => contractIds.includes(p.contractId));
        }
        if (search) filtered = filtered.filter(p =>
            (p.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.paidBy || '').toLowerCase().includes(search.toLowerCase())
        );
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST payment
router.post('/payments', async (req, res) => {
    try {
        const { contractId } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);

        const payment = {
            paymentId: 'PAY-' + Math.floor(1000 + Math.random() * 9000),
            brand: contract?.brand || '',
            ...req.body
        };

        if (isMongoConnected) {
            const doc = new Payment(payment);
            await doc.save();
            payment._id = doc._id;
        } else {
            payment._id = 'p-' + Date.now();
        }

        MEM_DB.payments.unshift(payment);
        res.status(201).json(payment);
    } catch (err) {
        console.error("===== PAYMENT ERROR =====", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// QR payload
router.get('/payments/qr-payload/:contractId', async (req, res) => {
    try {
        let contract = isMongoConnected ? await Contract.findOne({ contractId: req.params.contractId }) : MEM_DB.contracts.find(c => c.contractId === req.params.contractId);
        if (!contract) return res.status(404).json({ error: 'Activated contract not found' });

        const payloadData = {
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh})`,
            photo: contract.customerPhoto,
            serialNumber: contract.serialNumber,
            model: contract.model,
            suggestedAmount: contract.monthlyPayment
        };

        const paymentPageUrl = `${req.protocol}://${req.get('host')}/pay/${contract.contractId}`;
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
        let contract = isMongoConnected
            ? await Contract.findOne({ contractId })
            : MEM_DB.contracts.find(c => c.contractId === contractId);

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
        const amountDue = contract.monthlyPayment || 0;
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
        body { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f1f5f9; font-family: 'Segoe UI', sans-serif; min-height: 100vh; padding: 16px; }
        .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px; margin-bottom: 14px; backdrop-filter: blur(10px); }
        .header { text-align: center; padding: 16px 0 8px; }
        .badge { display: inline-block; background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .contract-id { font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
        .photo { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #10b981; margin: 10px auto; display: block; background: #1e293b; }
        .photo-placeholder { width: 90px; height: 90px; border-radius: 50%; border: 3px solid #475569; margin: 10px auto; display: flex; align-items: center; justify-content: center; font-size: 32px; background: #1e293b; }
        .name-en { font-size: 18px; font-weight: 800; text-align: center; color: #f1f5f9; }
        .name-kh { font-size: 15px; font-weight: 600; text-align: center; color: #94a3b8; margin-top: 2px; }
        .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .row .label { color: #64748b; font-weight: 600; }
        .row .value { color: #e2e8f0; font-weight: 700; text-align: right; max-width: 60%; }
        .amount-box { background: linear-gradient(135deg, #059669, #10b981); border-radius: 16px; padding: 18px; text-align: center; }
        .amount-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; }
        .amount-value { font-size: 36px; font-weight: 900; color: #fff; font-family: monospace; margin-top: 4px; }
        .section-title { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .pay-row { display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .pay-row .p-date { color: #94a3b8; }
        .pay-row .p-amt { color: #10b981; font-weight: 700; font-family: monospace; }
        .note { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #fbbf24; line-height: 1.6; }
        .footer { text-align: center; font-size: 11px; color: #334155; padding: 10px 0; }
        .total-paid { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .total-paid span:first-child { font-size: 12px; color: #64748b; font-weight: 700; }
        .total-paid span:last-child { font-size: 16px; color: #10b981; font-weight: 900; font-family: monospace; }
    </style>
</head>
<body>
    <div class="header">
        <div class="badge">💳 Payment Info</div>
        <div class="contract-id">Contract: <strong>${contract.contractId}</strong></div>
        <div class="contract-id" style="font-size:11px;color:#475569">${today}</div>
    </div>

    <div class="card">
        ${photoUrl
            ? `<img src="${photoUrl}" class="photo" alt="Customer Photo" onerror="this.style.display='none'">`
            : `<div class="photo-placeholder">👤</div>`
        }
        <div class="name-en">${contract.customerNameEn || '—'}</div>
        <div class="name-kh">${contract.customerNameKh || ''}</div>
    </div>

    <div class="card">
        <div class="section-title">📱 Device & Loan Info</div>
        <div class="row"><span class="label">Model</span><span class="value">${contract.model || '—'}</span></div>
        <div class="row"><span class="label">Brand</span><span class="value">${contract.brand || '—'}</span></div>
        <div class="row"><span class="label">Serial</span><span class="value" style="font-family:monospace;font-size:11px">${contract.serialNumber || '—'}</span></div>
        <div class="row"><span class="label">Duration</span><span class="value">${contract.duration || '—'}</span></div>
        <div class="row"><span class="label">Interest</span><span class="value">${contract.interest || '—'}</span></div>
        <div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">${contract.status}</span></div>
    </div>

    <div class="amount-box" style="margin-bottom:14px">
        <div class="amount-label">ទឹកប្រាក់ត្រូវបង់ / Amount Due</div>
        <div class="amount-value">$${Number(amountDue).toLocaleString()}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:4px">Per installment payment</div>
    </div>

    ${recentPayments.length > 0 ? `
    <div class="card">
        <div class="section-title">📋 Recent Payments (${recentPayments.length})</div>
        ${recentPayments.map(p => `
            <div class="pay-row">
                <span class="p-date">${p.paidDate || p.paymentDate || '—'} &nbsp; ${p.paidBy || ''}</span>
                <span class="p-amt">$${Number(p.amount || 0).toLocaleString()}</span>
            </div>
        `).join('')}
        <div class="total-paid">
            <span>Total Paid (last ${recentPayments.length})</span>
            <span>$${totalPaid.toLocaleString()}</span>
        </div>
    </div>` : ''}

    <div class="note">
        ⚠️ សូមបង់ប្រាក់តាមរយៈការិយាល័យ ឬ ទំនាក់ទំនងតាម agent ដែលទទួលខុសត្រូវ។<br>
        Please contact your agent to process this payment.
    </div>

    <div class="footer" style="margin-top:16px">
        SYSTEM MDM — Payment Information Page<br>
        Scan QR Code from Activated Contract
    </div>
</body>
</html>`);
    } catch (err) {
        res.status(500).send(`<html><body style="background:#0f172a;color:#f87171;font-family:sans-serif;padding:40px;text-align:center"><h2>Server Error</h2><p>${err.message}</p></body></html>`);
    }
});

export default router;



