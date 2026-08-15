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

export default router;
