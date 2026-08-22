import express from 'express';

const router = express.Router();

// In-memory state for Phone App & Real-time Live Session
let activeDevice = {
    isConnected: true,
    id: "PH-8829-S24U",
    model: "Samsung Galaxy S24 Ultra",
    brand: "SAMSUNG",
    imei1: "358941109482103",
    imei2: "358941109482104",
    osVersion: "Android 14 (One UI 6.1)",
    batteryLevel: 88,
    isCharging: false,
    storage: "256 GB (82 GB Available)",
    ram: "12 GB (4.8 GB Available)",
    carrier: "Smart Axiata 5G",
    ip: "192.168.1.105",
    smsCount: 42,
    recentSms: [
        { sender: "Smart", text: "Your main balance is $12.50 valid until 30/09/2026", date: "Today 14:20" },
        { sender: "ABA Bank", text: "Received $150.00 from John Doe (Ref: 981245)", date: "Today 10:15" },
        { sender: "SYSTEM MDM", text: "Device paired successfully with SYSTEM Admin", date: "Yesterday 18:30" }
    ],
    lastSeen: new Date().toISOString()
};

let createSessionActive = false; // Computer create page status
let latestScannedDoc = null;    // Real-time scanned payload from mobile app

// ── GET Phone App & Live Session Status ──
router.get('/status', (req, res) => {
    res.json({
        success: true,
        device: activeDevice,
        createSessionActive,
        latestScannedDoc,
        timestamp: new Date().toISOString()
    });
});

// ── SET Computer Create Session Active State ──
router.post('/create-session', (req, res) => {
    const { active } = req.body;
    createSessionActive = Boolean(active);
    
    // If closed, clear pending scanned doc
    if (!createSessionActive) {
        latestScannedDoc = null;
    }

    res.json({
        success: true,
        createSessionActive,
        message: `Computer create session status set to: ${createSessionActive}`
    });
});

// ── PAIR Device (from QR, Wi-Fi, or Hotspot) ──
router.post('/pair', (req, res) => {
    const deviceInfo = req.body;
    activeDevice = {
        ...activeDevice,
        ...deviceInfo,
        isConnected: true,
        lastSeen: new Date().toISOString()
    };
    res.json({
        success: true,
        message: "Device paired successfully",
        device: activeDevice
    });
});

// ── HEARTBEAT Telemetry ──
router.post('/heartbeat', (req, res) => {
    if (activeDevice) {
        activeDevice.lastSeen = new Date().toISOString();
        if (req.body.batteryLevel !== undefined) activeDevice.batteryLevel = req.body.batteryLevel;
        if (req.body.isCharging !== undefined) activeDevice.isCharging = req.body.isCharging;
    }
    res.json({ success: true, createSessionActive });
});

// ── UNPAIR / Disconnect Device ──
router.post('/disconnect', (req, res) => {
    if (activeDevice) {
        activeDevice.isConnected = false;
    }
    res.json({ success: true, message: "Device disconnected" });
});

// ── REAL-TIME SCAN SYNC (From Mobile Phone App) ──
router.post('/scan-sync', (req, res) => {
    // REQUIREMENT: Computer system MUST have Create page open first
    if (!createSessionActive) {
        return res.status(403).json({
            success: false,
            errorCode: "CREATE_FORM_NOT_OPEN",
            message: "សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!"
        });
    }

    const { docData } = req.body;
    if (!docData) {
        return res.status(400).json({ success: false, message: "No document data provided" });
    }

    latestScannedDoc = {
        ...docData,
        timestamp: new Date().toISOString()
    };

    res.json({
        success: true,
        message: "ទិន្នន័យស្កេនត្រូវបញ្ជូនទៅកាន់ Computer System ដោយជោគជ័យ!",
        latestScannedDoc
    });
});

// ── CONSUME Scanned Doc Data (Called by Computer after auto-populating) ──
router.post('/consume-scanned-doc', (req, res) => {
    const consumed = latestScannedDoc;
    latestScannedDoc = null;
    res.json({ success: true, consumed });
});

export default router;
