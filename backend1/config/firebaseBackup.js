import axios from 'axios';
import User from '../models/User.js';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import ControlSystem from '../models/ControlSystem.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import { queryAllDBs, isAnyDBConnected } from './multiDB.js';
import { MEM_DB } from './db.js';

let firebaseBackupStatus = {
    configured: false,
    lastBackupTime: null,
    lastBackupStatus: 'Idle',
    recordCounts: {},
    error: null
};

export const getFirebaseBackupStatus = () => firebaseBackupStatus;

export const formatDocForFirebase = (doc) => {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    if (obj._id) obj._id = obj._id.toString();

    for (const key in obj) {
        if (obj[key] instanceof Date) {
            obj[key] = obj[key].toISOString();
        } else if (Array.isArray(obj[key])) {
            obj[key] = obj[key].map(item => typeof item === 'object' && item !== null ? formatDocForFirebase(item) : item);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            obj[key] = formatDocForFirebase(obj[key]);
        }
    }
    return obj;
};

export const runFirebaseBackup = async () => {
    const firebaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    const authSecret = process.env.FIREBASE_SECRET_KEY || process.env.FIREBASE_AUTH_KEY;

    if (!firebaseUrl || firebaseUrl.includes('YOUR_FIREBASE')) {
        firebaseBackupStatus.configured = false;
        firebaseBackupStatus.lastBackupStatus = 'Not Configured (Set FIREBASE_DATABASE_URL in .env)';
        console.log('[Firebase Backup] ℹ️ FIREBASE_DATABASE_URL not configured in environment variables.');
        return { success: false, message: 'FIREBASE_DATABASE_URL not configured' };
    }

    firebaseBackupStatus.configured = true;
    firebaseBackupStatus.lastBackupStatus = 'Syncing...';

    try {
        console.log('[Firebase Backup] 🔄 Starting MongoDB to Firebase full backup sync...');

        let users = [];
        let contracts = [];
        let payments = [];
        let controlSystems = [];
        let phoneLogs = [];
        let wallpaperLogs = [];
        let deviceLogs = [];

        if (isAnyDBConnected()) {
            users = await queryAllDBs(User, (M) => M.find({}));
            contracts = await queryAllDBs(Contract, (M) => M.find({}));
            payments = await queryAllDBs(Payment, (M) => M.find({}));
            controlSystems = await queryAllDBs(ControlSystem, (M) => M.find({}));
            phoneLogs = await queryAllDBs(PhoneLog, (M) => M.find({}));
            wallpaperLogs = await queryAllDBs(WallpaperLog, (M) => M.find({}));
            deviceLogs = await queryAllDBs(DeviceActionLog, (M) => M.find({}));
        } else {
            users = MEM_DB.users || [];
            contracts = MEM_DB.contracts || [];
            payments = MEM_DB.payments || [];
            controlSystems = MEM_DB.controlSystems || [];
            phoneLogs = MEM_DB.phoneLogs || [];
            wallpaperLogs = MEM_DB.wallpaperLogs || [];
            deviceLogs = MEM_DB.deviceActionLogs || [];
        }

        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                systemName: 'SYSTEM MDM Database Backup',
                totalCollections: 7
            },
            users: users.map(formatDocForFirebase),
            contracts: contracts.map(formatDocForFirebase),
            payments: payments.map(formatDocForFirebase),
            controlSystems: controlSystems.map(formatDocForFirebase),
            phoneLogs: phoneLogs.map(formatDocForFirebase),
            wallpaperLogs: wallpaperLogs.map(formatDocForFirebase),
            deviceActionLogs: deviceLogs.map(formatDocForFirebase)
        };

        const cleanUrl = firebaseUrl.endsWith('/') ? firebaseUrl.slice(0, -1) : firebaseUrl;
        const targetUrl = `${cleanUrl}/SYSTEM_MDM_BACKUP.json` + (authSecret ? `?auth=${authSecret}` : '');

        await axios.put(targetUrl, backupData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        firebaseBackupStatus.lastBackupTime = new Date().toISOString();
        firebaseBackupStatus.lastBackupStatus = 'Success';
        firebaseBackupStatus.recordCounts = {
            users: users.length,
            contracts: contracts.length,
            payments: payments.length,
            controlSystems: controlSystems.length,
            phoneLogs: phoneLogs.length,
            wallpaperLogs: wallpaperLogs.length,
            deviceActionLogs: deviceLogs.length
        };
        firebaseBackupStatus.error = null;

        console.log(`[Firebase Backup] ✅ Backup completed successfully at ${firebaseBackupStatus.lastBackupTime}!`);
        return { success: true, timestamp: firebaseBackupStatus.lastBackupTime, counts: firebaseBackupStatus.recordCounts };

    } catch (err) {
        console.error('[Firebase Backup] ❌ Backup failed:', err.message);
        firebaseBackupStatus.lastBackupStatus = 'Failed';
        firebaseBackupStatus.error = err.message;
        return { success: false, error: err.message };
    }
};

// Automatic Hourly Backup Sync Scheduler
export const startFirebaseBackupScheduler = () => {
    // Initial sync attempt 10 seconds after server startup
    setTimeout(() => {
        runFirebaseBackup().catch(() => {});
    }, 10000);

    // Hourly sync schedule
    setInterval(() => {
        runFirebaseBackup().catch(() => {});
    }, 60 * 60 * 1000);
};
