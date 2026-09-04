import SystemAuditLog from '../models/SystemAuditLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { getWriteModel } from '../config/multiDB.js';

let eventCounter = 1000;

export const recordSystemAudit = async ({
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
}) => {
    try {
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

        return logEntry;
    } catch (err) {
        console.error('[AuditLogger] Error recording audit log:', err.message);
        return null;
    }
};
