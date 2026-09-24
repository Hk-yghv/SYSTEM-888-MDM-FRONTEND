import SystemAuditLog from '../models/SystemAuditLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { getWriteModel } from '../config/multiDB.js';
import { exportDeletedLogToGoogleSheet } from '../services/logArchivalService.js';

let eventCounter = 1000;

export const recordSystemAudit = async (param1, param2, param3, param4) => {
    try {
        let options = {};
        if (param1 && typeof param1 === 'object' && (param1.headers || param1.method || param1.url)) {
            // Called with (req, action, description, payload)
            const req = param1;
            const action = param2 || 'ACTION';
            const description = param3 || `User performed ${action}`;
            const payload = param4 || {};
            const ip = req.headers?.['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
            const deviceInfo = req.headers?.['user-agent'] || 'Windows Client';
            options = {
                category: req.body?.category || 'System',
                level: req.body?.level || (action.includes('DELETE') ? 'Warning' : 'Information'),
                action,
                taskCategory: action.replace(/_/g, ' '),
                description,
                username: req.user?.username || req.query?.username || req.body?.username || 'Staff',
                name: req.user?.name || req.body?.name || '',
                role: req.user?.role || req.body?.role || 'Staff',
                brand: req.user?.brand || req.query?.brand || req.body?.brand || '',
                ip,
                deviceInfo,
                path: req.originalUrl || req.url || '',
                contractId: req.params?.id || req.body?.contractId || '',
                customerId: req.body?.customerId || '',
                payload
            };
        } else if (param1 && typeof param1 === 'object') {
            options = { ...param1 };
        }

        const {
            category = 'System',
            level = 'Information',
            action = 'GENERIC_ACTION',
            taskCategory = 'General',
            description = '',
            username = 'System',
            name = '',
            role = 'Staff',
            brand = '',
            ip = '127.0.0.1',
            deviceInfo = 'Windows Client',
            path = '',
            contractId = '',
            customerId = '',
            payload = {}
        } = options;

        eventCounter = (eventCounter + 1) % 99999;
        const eventId = `EVT-${eventCounter}`;

        const logEntry = {
            eventId,
            category,
            level,
            action,
            taskCategory,
            description,
            username,
            name,
            role,
            brand: brand || '',
            ip,
            deviceInfo,
            path,
            contractId,
            customerId,
            payload,
            timestamp: new Date()
        };

        if (isMongoConnected) {
            try {
                const WriteModel = getWriteModel(SystemAuditLog) || SystemAuditLog;
                await WriteModel.create(logEntry);
            } catch (dbErr) {
                console.warn('[AuditLogger] MongoDB save error:', dbErr.message);
            }
        }

        if (!Array.isArray(MEM_DB.systemAuditLogs)) {
            MEM_DB.systemAuditLogs = [];
        }
        MEM_DB.systemAuditLogs.unshift({ ...logEntry, _id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) });
        if (MEM_DB.systemAuditLogs.length > 2000) {
            MEM_DB.systemAuditLogs = MEM_DB.systemAuditLogs.slice(0, 2000);
        }

        // Real-time synchronization of deleted data to Google Sheet 2
        if (action.includes('DELETE') || payload?.deletedData || payload?.deletedRecord || payload?.previousData) {
            exportDeletedLogToGoogleSheet(logEntry).catch(e => {
                console.warn('[AuditLogger] Real-time Google Sheet delete sync warning:', e.message);
            });
        }

        return logEntry;
    } catch (err) {
        console.error('[AuditLogger] Error recording audit log:', err.message);
        return null;
    }
};
