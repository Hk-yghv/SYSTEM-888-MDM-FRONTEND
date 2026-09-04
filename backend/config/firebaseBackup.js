import axios from 'axios';
import User from '../models/User.js';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import ControlSystem from '../models/ControlSystem.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import FollowUp from '../models/FollowUp.js';
import FollowUp2 from '../models/FollowUp2.js';
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

// Helper to merge and preserve Firebase history without deletion
const mergeWithFirebaseHistory = (mongoList, firebaseList = [], keyField = '_id') => {
    const mongoMap = new Map();
    mongoList.forEach(m => {
        const k = String(m[keyField] || m.contractId || m.userId || m.paymentId || m._id || '');
        if (k) mongoMap.set(k, m);
    });

    const mergedList = [];
    const processedKeys = new Set();

    // 1. Process items currently in MongoDB
    mongoList.forEach(mongoItem => {
        const k = String(mongoItem[keyField] || mongoItem.contractId || mongoItem.userId || mongoItem.paymentId || mongoItem._id || '');
        processedKeys.add(k);

        const existingFbItem = (Array.isArray(firebaseList) ? firebaseList : []).find(fb => {
            const fbKey = String(fb[keyField] || fb.contractId || fb.userId || fb.paymentId || fb._id || '');
            return fbKey === k;
        });

        if (existingFbItem) {
            // Check if item has edits
            const history = Array.isArray(existingFbItem._editHistory) ? [...existingFbItem._editHistory] : [];
            const previousCopy = { ...existingFbItem };
            delete previousCopy._editHistory;

            // Preserve existing history and append previous version if updated
            const isDifferent = JSON.stringify(formatDocForFirebase(mongoItem)) !== JSON.stringify(formatDocForFirebase(previousCopy));
            if (isDifferent && history.length < 30) {
                history.unshift({
                    savedAt: new Date().toISOString(),
                    previousState: previousCopy
                });
            }

            mergedList.push({
                ...formatDocForFirebase(mongoItem),
                _editHistory: history,
                _lastSyncedAt: new Date().toISOString()
            });
        } else {
            mergedList.push({
                ...formatDocForFirebase(mongoItem),
                _editHistory: [],
                _lastSyncedAt: new Date().toISOString()
            });
        }
    });

    // 2. Preserve archived items that were deleted in MongoDB (Never delete from Firebase!)
    if (Array.isArray(firebaseList)) {
        firebaseList.forEach(fbItem => {
            const k = String(fbItem[keyField] || fbItem.contractId || fbItem.userId || fbItem.paymentId || fbItem._id || '');
            if (k && !processedKeys.has(k)) {
                mergedList.push({
                    ...fbItem,
                    _archivedInFirebase: true,
                    _deletedInMongo: true,
                    _deletedAt: fbItem._deletedAt || new Date().toISOString()
                });
            }
        });
    }

    return mergedList;
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
        console.log('[Firebase Backup] 🔄 Starting MongoDB to Firebase non-destructive backup sync with history preservation...');

        let users = [];
        let contracts = [];
        let payments = [];
        let controlSystems = [];
        let phoneLogs = [];
        let wallpaperLogs = [];
        let deviceLogs = [];
        let followUps = [];
        let followUps2 = [];

        if (isAnyDBConnected()) {
            users = await queryAllDBs(User, (M) => M.find({}));
            contracts = await queryAllDBs(Contract, (M) => M.find({}));
            payments = await queryAllDBs(Payment, (M) => M.find({}));
            controlSystems = await queryAllDBs(ControlSystem, (M) => M.find({}));
            phoneLogs = await queryAllDBs(PhoneLog, (M) => M.find({}));
            wallpaperLogs = await queryAllDBs(WallpaperLog, (M) => M.find({}));
            deviceLogs = await queryAllDBs(DeviceActionLog, (M) => M.find({}));
            followUps = await queryAllDBs(FollowUp, (M) => M.find({}));
            followUps2 = await queryAllDBs(FollowUp2, (M) => M.find({}));
        } else {
            users = MEM_DB.users || [];
            contracts = MEM_DB.contracts || [];
            payments = MEM_DB.payments || [];
            controlSystems = MEM_DB.controlSystems || [];
            phoneLogs = MEM_DB.phoneLogs || [];
            wallpaperLogs = MEM_DB.wallpaperLogs || [];
            deviceLogs = MEM_DB.deviceActionLogs || [];
            followUps = MEM_DB.followUps || [];
            followUps2 = MEM_DB.followUps2 || [];
        }

        const cleanUrl = firebaseUrl.endsWith('/') ? firebaseUrl.slice(0, -1) : firebaseUrl;
        const targetUrl = `${cleanUrl}/SYSTEM_MDM_BACKUP.json` + (authSecret ? `?auth=${authSecret}` : '');

        // Fetch existing Firebase backup first to preserve edit history and archived items
        let existingBackup = null;
        try {
            const fetchRes = await axios.get(targetUrl, { timeout: 15000 });
            if (fetchRes.data && typeof fetchRes.data === 'object') {
                existingBackup = fetchRes.data;
            }
        } catch (fErr) {
            console.log('[Firebase Backup] Initial backup or fetch note:', fErr.message);
        }

        const mergedUsers = mergeWithFirebaseHistory(users, existingBackup?.users, 'username');
        const mergedContracts = mergeWithFirebaseHistory(contracts, existingBackup?.contracts, 'contractId');
        const mergedPayments = mergeWithFirebaseHistory(payments, existingBackup?.payments, 'paymentId');
        const mergedControlSystems = mergeWithFirebaseHistory(controlSystems, existingBackup?.controlSystems, 'brand');
        const mergedPhoneLogs = mergeWithFirebaseHistory(phoneLogs, existingBackup?.phoneLogs, '_id');
        const mergedWallpaperLogs = mergeWithFirebaseHistory(wallpaperLogs, existingBackup?.wallpaperLogs, '_id');
        const mergedDeviceLogs = mergeWithFirebaseHistory(deviceLogs, existingBackup?.deviceActionLogs, '_id');
        const mergedFollowUps = mergeWithFirebaseHistory(followUps, existingBackup?.followUps, 'followUpId');
        const mergedFollowUps2 = mergeWithFirebaseHistory(followUps2, existingBackup?.followUps2, 'followUpId');

        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                systemName: 'SYSTEM MDM Permanent Archival Backup',
                version: '2.0.0',
                nonDestructive: true,
                totalCollections: 9
            },
            users: mergedUsers,
            contracts: mergedContracts,
            payments: mergedPayments,
            controlSystems: mergedControlSystems,
            phoneLogs: mergedPhoneLogs,
            wallpaperLogs: mergedWallpaperLogs,
            deviceActionLogs: mergedDeviceLogs,
            followUps: mergedFollowUps,
            followUps2: mergedFollowUps2
        };

        let response = null;
        let lastErr = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[Firebase Backup] Sending non-destructive sync to Firebase (Attempt ${attempt}/3)...`);
                response = await axios.put(targetUrl, backupData, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 35000
                });
                break;
            } catch (err) {
                lastErr = err;
                console.warn(`[Firebase Backup] Attempt ${attempt} failed: ${err.message}`);
                if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt));
            }
        }
        if (!response) throw lastErr;

        firebaseBackupStatus.lastBackupTime = new Date().toISOString();
        firebaseBackupStatus.lastBackupStatus = 'Success';
        firebaseBackupStatus.recordCounts = {
            users: mergedUsers.length,
            contracts: mergedContracts.length,
            payments: mergedPayments.length,
            controlSystems: mergedControlSystems.length,
            phoneLogs: mergedPhoneLogs.length,
            wallpaperLogs: mergedWallpaperLogs.length,
            deviceActionLogs: mergedDeviceLogs.length,
            followUps: mergedFollowUps.length,
            followUps2: mergedFollowUps2.length
        };
        firebaseBackupStatus.error = null;

        console.log(`[Firebase Backup] ✅ Non-destructive backup completed successfully at ${firebaseBackupStatus.lastBackupTime}!`);
        return { success: true, timestamp: firebaseBackupStatus.lastBackupTime, counts: firebaseBackupStatus.recordCounts };

    } catch (err) {
        console.error('[Firebase Backup] ❌ Backup failed:', err.message);
        firebaseBackupStatus.lastBackupStatus = 'Failed';
        firebaseBackupStatus.error = err.message;
        return { success: false, error: err.message };
    }
};

/**
 * Restore MongoDB completely from Firebase Backup
 * Cleans damaged/corrupted MongoDB collections and restores healthy state from Firebase
 */
export const restoreFromFirebase = async () => {
    const firebaseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    const authSecret = process.env.FIREBASE_SECRET_KEY || process.env.FIREBASE_AUTH_KEY;

    if (!firebaseUrl || firebaseUrl.includes('YOUR_FIREBASE')) {
        throw new Error('FIREBASE_DATABASE_URL is not configured in environment variables.');
    }

    const cleanUrl = firebaseUrl.endsWith('/') ? firebaseUrl.slice(0, -1) : firebaseUrl;
    const targetUrl = `${cleanUrl}/SYSTEM_MDM_BACKUP.json` + (authSecret ? `?auth=${authSecret}` : '');

    console.log('[Firebase Restore] 📥 Fetching backup snapshot from Firebase...');
    const response = await axios.get(targetUrl, { timeout: 35000 });
    const backup = response.data;

    if (!backup || typeof backup !== 'object') {
        throw new Error('No valid backup snapshot found in Firebase database.');
    }

    const filterActive = (arr) => Array.isArray(arr) ? arr.filter(item => !item._deletedInMongo) : [];

    const usersToRestore = filterActive(backup.users || []);
    const contractsToRestore = filterActive(backup.contracts || []);
    const paymentsToRestore = filterActive(backup.payments || []);
    const controlSystemsToRestore = filterActive(backup.controlSystems || []);
    const phoneLogsToRestore = filterActive(backup.phoneLogs || []);
    const wallpaperLogsToRestore = filterActive(backup.wallpaperLogs || []);
    const deviceLogsToRestore = filterActive(backup.deviceActionLogs || []);
    const followUpsToRestore = filterActive(backup.followUps || []);
    const followUps2ToRestore = filterActive(backup.followUps2 || []);

    console.log(`[Firebase Restore] 🔄 Restoring: ${contractsToRestore.length} contracts, ${usersToRestore.length} users, ${paymentsToRestore.length} payments, ${controlSystemsToRestore.length} control systems, ${followUpsToRestore.length} follow ups, ${followUps2ToRestore.length} follow ups 2...`);

    // Restore into MongoDB across multi-DBs
    if (isAnyDBConnected()) {
        const restoreCollection = async (Model, items) => {
            if (!items || items.length === 0) return;
            const cleanItems = items.map(it => {
                const copy = { ...it };
                if (Array.isArray(copy._editHistory) && (!copy.editHistory || copy.editHistory.length === 0)) {
                    copy.editHistory = copy._editHistory.map(h => ({
                        timestamp: h.savedAt ? new Date(h.savedAt) : new Date(),
                        editedBy: h.previousState?.lastModifiedBy || 'Firebase Backup',
                        reason: 'Archival edit snapshot',
                        previousData: h.previousState,
                        changedFields: []
                    }));
                }
                delete copy._editHistory;
                delete copy._lastSyncedAt;
                delete copy._archivedInFirebase;
                delete copy._deletedInMongo;
                return copy;
            });

            await queryAllDBs(Model, async (M) => {
                await M.deleteMany({});
                if (cleanItems.length > 0) {
                    await M.insertMany(cleanItems, { ordered: false });
                }
            });
        };

        await restoreCollection(User, usersToRestore);
        await restoreCollection(Contract, contractsToRestore);
        await restoreCollection(Payment, paymentsToRestore);
        await restoreCollection(ControlSystem, controlSystemsToRestore);
        await restoreCollection(PhoneLog, phoneLogsToRestore);
        await restoreCollection(WallpaperLog, wallpaperLogsToRestore);
        await restoreCollection(DeviceActionLog, deviceLogsToRestore);
        await restoreCollection(FollowUp, followUpsToRestore);
        await restoreCollection(FollowUp2, followUps2ToRestore);
    }

    // Sync Memory DB
    MEM_DB.users = usersToRestore;
    MEM_DB.contracts = contractsToRestore;
    MEM_DB.payments = paymentsToRestore;
    MEM_DB.controlSystems = controlSystemsToRestore;
    MEM_DB.phoneLogs = phoneLogsToRestore;
    MEM_DB.wallpaperLogs = wallpaperLogsToRestore;
    MEM_DB.deviceActionLogs = deviceLogsToRestore;
    MEM_DB.followUps = followUpsToRestore;
    MEM_DB.followUps2 = followUps2ToRestore;

    const restoredCounts = {
        users: usersToRestore.length,
        contracts: contractsToRestore.length,
        payments: paymentsToRestore.length,
        controlSystems: controlSystemsToRestore.length,
        phoneLogs: phoneLogsToRestore.length,
        wallpaperLogs: wallpaperLogsToRestore.length,
        deviceActionLogs: deviceLogsToRestore.length,
        followUps: followUpsToRestore.length,
        followUps2: followUps2ToRestore.length
    };

    console.log('[Firebase Restore] ✅ Database restoration from Firebase completed successfully!', restoredCounts);
    return {
        success: true,
        restoredAt: new Date().toISOString(),
        backupTimestamp: backup.metadata?.timestamp || 'Unknown',
        counts: restoredCounts
    };
};

// Automatic Hourly Backup Sync Scheduler
export const startFirebaseBackupScheduler = () => {
    setTimeout(() => {
        runFirebaseBackup().catch(() => {});
    }, 10000);

    setInterval(() => {
        runFirebaseBackup().catch(() => {});
    }, 60 * 60 * 1000);
};
