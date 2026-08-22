import express from 'express';

const router = express.Router();

// In-memory state for Phone App & Real-time Live Session
let activeDevice = {
    isConnected: false,      // MANUAL: must be approved by Admin, not auto-connect
    isPending: false,         // Device requested to pair, waiting for Admin approval
    id: null,
    model: null,
    brand: null,
    imei1: null,
    imei2: null,
    osVersion: null,
    batteryLevel: null,
    isCharging: false,
    storage: null,
    ram: null,
    carrier: null,
    ip: null,
    smsCount: 0,
    recentSms: [],
    lastSeen: null
};

let createSessionActive = false;
let latestScannedDoc = null;

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
    if (!createSessionActive) {
        latestScannedDoc = null;
    }
    res.json({
        success: true,
        createSessionActive,
        message: `Computer create session status set to: ${createSessionActive}`
    });
});

// ── REQUEST TO PAIR (from Mobile App) → Sets device as Pending, NOT connected yet ──
router.post('/pair', (req, res) => {
    const deviceInfo = req.body;

    // If already connected, update telemetry but keep connection state
    if (activeDevice.isConnected) {
        activeDevice = {
            ...activeDevice,
            ...deviceInfo,
            isConnected: true,
            isPending: false,
            lastSeen: new Date().toISOString()
        };
        return res.json({
            success: true,
            status: 'connected',
            message: "Device telemetry updated (already connected)",
            device: activeDevice
        });
    }

    // New pairing request → mark as PENDING, wait for Admin to approve
    activeDevice = {
        ...activeDevice,
        ...deviceInfo,
        isConnected: false,
        isPending: true,
        lastSeen: new Date().toISOString()
    };

    res.json({
        success: true,
        status: 'pending',
        message: "ការស្នើសុំភ្ជាប់ ត្រូវបានទទួល! កំពុងរង់ចាំការអនុម័តពី Computer Administrator...",
        device: activeDevice
    });
});

// ── ADMIN APPROVES CONNECTION (Manual "Connect" button in System) ──
router.post('/approve-connect', (req, res) => {
    if (!activeDevice.isPending && !activeDevice.id) {
        return res.status(404).json({ success: false, message: "គ្មាន Device ណាស្នើសុំភ្ជាប់ទេ" });
    }
    activeDevice.isConnected = true;
    activeDevice.isPending = false;
    activeDevice.lastSeen = new Date().toISOString();
    res.json({
        success: true,
        message: "Device ត្រូវបានភ្ជាប់ (Approved by Admin)",
        device: activeDevice
    });
});

// ── ADMIN DISCONNECTS / UNPAIRS Device ──
router.post('/disconnect', (req, res) => {
    activeDevice.isConnected = false;
    activeDevice.isPending = false;
    res.json({ success: true, message: "Device ត្រូវបានផ្តាច់ (Disconnected by Admin)" });
});

// ── HEARTBEAT Telemetry ──
router.post('/heartbeat', (req, res) => {
    if (activeDevice.isConnected) {
        activeDevice.lastSeen = new Date().toISOString();
        if (req.body.batteryLevel !== undefined) activeDevice.batteryLevel = req.body.batteryLevel;
        if (req.body.isCharging !== undefined) activeDevice.isCharging = req.body.isCharging;
    }
    res.json({
        success: true,
        createSessionActive,
        connectionStatus: activeDevice.isConnected ? 'connected' : activeDevice.isPending ? 'pending' : 'disconnected'
    });
});

// ── REAL-TIME SCAN SYNC (From Mobile Phone App) ──
router.post('/scan-sync', (req, res) => {
    if (!activeDevice.isConnected) {
        return res.status(403).json({
            success: false,
            errorCode: "DEVICE_NOT_CONNECTED",
            message: "ទូរស័ព្ទមិនទាន់ភ្ជាប់ទៅ Computer System ទេ! សូមមើល Settings > Phone App"
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

// ── CONSUME Scanned Doc Data (Called by Computer after auto-populating) ──
router.post('/consume-scanned-doc', (req, res) => {
    const consumed = latestScannedDoc;
    latestScannedDoc = null;
    res.json({ success: true, consumed });
});

export default router;
