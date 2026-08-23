import express from 'express';

const router = express.Router();

// Phone App State Cache
let phoneAppState = {
    createSessionActive: false,
    scannedDoc: null,
    device: {
        id: 'DEV-MDM-9901',
        model: 'Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
        imei1: '358941109482103',
        imei2: '358941109482104',
        meid: '35894110948210',
        serialNumber: 'R5CW10X998L',
        batteryLevel: 94,
        isCharging: true,
        ram: '12 GB',
        storage: '512 GB (210 GB Free)',
        ip: '192.168.1.108',
        carrier: 'Smart Axiata 5G',
        osVersion: 'Android 14 (OneUI 6.1)',
        isConnected: true,
        isPending: false,
        lastSeen: new Date(),
        smsCount: 12,
        recentSms: [
            { sender: 'ABA Bank', text: 'You received $150.00 from Customer CHET VANDETH for MDM Installment.', date: 'Today 10:14 AM' },
            { sender: 'Smart 5G', text: 'Your 5G Unlimited High-Speed data pack is active.', date: 'Yesterday' },
            { sender: 'MDM Security', text: 'Device security audit verified & Knox MDM profile active.', date: '2 days ago' }
        ]
    }
};

// ── GET Phone App & Device Status ──
router.get('/status', (req, res) => {
    res.json({
        success: true,
        device: phoneAppState.device,
        createSessionActive: phoneAppState.createSessionActive,
        scannedDoc: phoneAppState.scannedDoc
    });
});

// ── POST Create Application Session Status ──
router.post('/create-session', (req, res) => {
    const { active } = req.body;
    phoneAppState.createSessionActive = !!active;
    res.json({ success: true, createSessionActive: phoneAppState.createSessionActive });
});

// ── POST Push Scanned Document from Mobile Phone ──
router.post('/push-scanned-doc', (req, res) => {
    const { doc } = req.body;
    if (doc && typeof doc === 'object') {
        phoneAppState.scannedDoc = doc;
        return res.json({ success: true, message: 'Scanned document received successfully', doc });
    }
    res.status(400).json({ error: 'Invalid document payload' });
});

// ── POST Consume Scanned Document ──
router.post('/consume-scanned-doc', (req, res) => {
    const consumed = phoneAppState.scannedDoc;
    phoneAppState.scannedDoc = null;
    res.json({ success: true, consumed });
});

// ── POST Approve Connection ──
router.post('/approve-connect', (req, res) => {
    if (phoneAppState.device) {
        phoneAppState.device.isConnected = true;
        phoneAppState.device.isPending = false;
        phoneAppState.device.lastSeen = new Date();
    }
    res.json({ success: true, message: 'Device connection approved successfully!', device: phoneAppState.device });
});

// ── POST Disconnect Device ──
router.post('/disconnect', (req, res) => {
    if (phoneAppState.device) {
        phoneAppState.device.isConnected = false;
        phoneAppState.device.isPending = false;
    }
    res.json({ success: true, message: 'Device disconnected successfully', device: phoneAppState.device });
});

// ── POST Sync Real-Time Telemetry from Mobile App ──
router.post('/sync-device', (req, res) => {
    const { device } = req.body;
    if (device && typeof device === 'object') {
        phoneAppState.device = {
            ...phoneAppState.device,
            ...device,
            lastSeen: new Date()
        };
        return res.json({ success: true, message: 'Device telemetry updated', device: phoneAppState.device });
    }
    res.status(400).json({ error: 'Invalid device payload' });
});

export default router;
