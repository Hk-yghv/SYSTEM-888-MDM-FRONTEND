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
    const deviceInfo = req.body || {};
    
    const fullDeviceInfo = {
        id: deviceInfo.id || "PH-" + Math.floor(1000 + Math.random() * 9000),
        username: deviceInfo.username || "@houv",
        model: deviceInfo.model || "Samsung Galaxy S24 Ultra",
        brand: deviceInfo.brand || "888MDM",
        imei1: deviceInfo.imei1 || "358941109482103",
        imei2: deviceInfo.imei2 || "358941109482104",
        osVersion: deviceInfo.osVersion || "Android 14 (One UI 6.1)",
        batteryLevel: deviceInfo.batteryLevel || 92,
        isCharging: false,
        storage: "256 GB (82 GB Available)",
        ram: "12 GB (4.8 GB Available)",
        carrier: "Smart Axiata 5G",
        ip: deviceInfo.ip || "192.168.1.105",
        smsCount: 42,
        recentSms: [
            { sender: "Smart", text: "Your main balance is $12.50 valid until 30/09/2026", date: "Today 14:20" },
            { sender: "ABA Bank", text: "Received $150.00 from John Doe (Ref: 981245)", date: "Today 10:15" },
            { sender: "SYSTEM MDM", text: "Device pairing request sent to SYSTEM Admin", date: "Just Now" }
        ],
        lastSeen: new Date().toISOString()
    };

    // If already connected, update telemetry but keep connection state
    if (activeDevice.isConnected) {
        activeDevice = {
            ...activeDevice,
            ...fullDeviceInfo,
            isConnected: true,
            isPending: false
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
        ...fullDeviceInfo,
        isConnected: false,
        isPending: true
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

// ── REAL-TIME SCAN SYNC (From Mobile Phone App or Web Scanner) ──
router.post('/scan-sync', (req, res) => {
    const { docData, deviceSpecs } = req.body;
    if (!docData && !deviceSpecs) {
        return res.status(400).json({ success: false, message: "No scan data provided" });
    }

    latestScannedDoc = {
        ...(docData || {}),
        ...(deviceSpecs || {}),
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
