import express from 'express';

const router = express.Router();

// In-memory state for Phone App & Real-time Live Session
// Manual Connect Rule: Device is NOT auto-connected by default; Admin user must click Connect in System!
let activeDevice = {
    isConnected: false, // Default false: requires manual admin connect action in System!
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
        { sender: "SYSTEM MDM", text: "Device paired with SYSTEM Admin", date: "Yesterday 18:30" }
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

// ── MANUAL CONNECT Device (Triggered by System Admin) ──
router.post('/connect', (req, res) => {
    if (activeDevice) {
        activeDevice.isConnected = true;
        activeDevice.lastSeen = new Date().toISOString();
    } else {
        activeDevice = {
            isConnected: true,
            id: "PH-8829-S24U",
            model: "Samsung Galaxy S24 Ultra",
            brand: "SAMSUNG",
            lastSeen: new Date().toISOString()
        };
    }
    res.json({
        success: true,
        message: "ឧបករណ៍ទូរស័ព្ទត្រូវបានភ្ជាប់ទៅកាន់ System ដោយជោគជ័យ!",
        device: activeDevice
    });
});

// ── DISCONNECT Device (Triggered by System Admin) ──
router.post('/disconnect', (req, res) => {
    if (activeDevice) {
        activeDevice.isConnected = false;
        activeDevice.lastSeen = new Date().toISOString();
    }
    res.json({
        success: true,
        message: "ការភ្ជាប់ទៅកាន់ទូរស័ព្ទត្រូវបានផ្តាច់ចេញពី System រួចរាល់!",
        device: activeDevice
    });
});

// ── PAIR Device (from QR, Wi-Fi, or Hotspot) ──
router.post('/pair', (req, res) => {
    const deviceInfo = req.body;
    activeDevice = {
        ...activeDevice,
        ...deviceInfo,
        isConnected: false, // Paired, but requires manual Connect button click in System
        lastSeen: new Date().toISOString()
    };
    res.json({
        success: true,
        message: "Device paired successfully. Please click 'Connect Device' in System to activate connection.",
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

// ── REAL-TIME SCAN SYNC (From Mobile Phone App) ──
router.post('/scan-sync', (req, res) => {
    // REQUIREMENT: Device must be connected AND Computer system MUST have Create page open
    if (!activeDevice || !activeDevice.isConnected) {
        return res.status(403).json({
            success: false,
            errorCode: "DEVICE_NOT_CONNECTED",
            message: "ទូរស័ព្ទមិនទាន់បានភ្ជាប់ជាមួយ System ទេ! សូមចូលទៅកាន់ Settings -> Phone App រួចចុច 'Connect Phone' ជាមុនសិន។"
        });
    }

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

// ── CONSUME Scanned Doc Data ──
router.post('/consume-scanned-doc', (req, res) => {
    const consumed = latestScannedDoc;
    latestScannedDoc = null;
    res.json({ success: true, consumed });
});

export default router;
