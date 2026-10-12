/**
 * multiDB.js — Multi-MongoDB Connection Manager
 *
 * Strategy:
 *   WRITE: ប្រើ DB1 ជានិច្ច, auto-failover ទៅ DB2 → DB3 ពេល DB1 down/error
 *   READ : Merge ទិន្នន័យចេញពី DB ទាំងបី (deduplicate by _id)
 */

import mongoose from 'mongoose';

// ── Connection Registry ──────────────────────────────────────────────────────

const DB_CONFIGS = [
    { name: 'DB1', uri: process.env.MONGO_URI_1 },
    { name: 'DB2', uri: process.env.MONGO_URI_2 },
    { name: 'DB3', uri: process.env.MONGO_URI_3 },
];

// Each entry: { name, uri, conn, status: 'connected'|'failed'|'pending'|'not_configured' }
export const dbInstances = [];

// ── Connect All ──────────────────────────────────────────────────────────────

/**
 * connectAllDBs — ព្យាយាម connect ទៅ DB ទាំង 3
 * Returns true if at least 1 DB connected successfully.
 */
export const connectAllDBs = async () => {
    let anyConnected = false;

    for (const cfg of DB_CONFIGS) {
        const instance = { name: cfg.name, uri: cfg.uri, conn: null, status: 'pending' };
        dbInstances.push(instance);

        if (!cfg.uri || cfg.uri.includes('YOUR_USER')) {
            console.warn(`[MultiDB] ${cfg.name}: URI not configured — skipping.`);
            instance.status = 'not_configured';
            continue;
        }

        try {
            const conn = mongoose.createConnection(cfg.uri, {
                serverSelectionTimeoutMS: 8000,
            });

            // Wait for connection to open
            await new Promise((resolve) => {
                conn.once('open', () => {
                    instance.conn = conn;
                    instance.status = 'connected';
                    anyConnected = true;
                    console.log(`[MultiDB] ✅ ${cfg.name}: Connected successfully.`);
                    resolve();
                });
                conn.once('error', (err) => {
                    instance.status = 'failed';
                    console.error(`[MultiDB] ❌ ${cfg.name}: Connection failed — ${err.message}`);
                    resolve(); // Don't reject — continue to next DB
                });
                // Timeout safety
                setTimeout(() => {
                    if (instance.status === 'pending') {
                        instance.status = 'failed';
                        console.error(`[MultiDB] ⏱ ${cfg.name}: Connection timed out.`);
                        resolve();
                    }
                }, 10000);
            });

            // Handle future disconnects
            conn.on('disconnected', () => {
                instance.status = 'failed';
                console.warn(`[MultiDB] ⚠️  ${cfg.name}: Disconnected.`);
            });
            conn.on('reconnected', () => {
                instance.status = 'connected';
                console.log(`[MultiDB] 🔄 ${cfg.name}: Reconnected.`);
            });

        } catch (err) {
            instance.status = 'failed';
            console.error(`[MultiDB] ❌ ${cfg.name}: Unexpected error — ${err.message}`);
        }
    }

    if (!anyConnected) {
        console.error('[MultiDB] ❌ All MongoDB instances failed! Running in memory-only mode.');
    }

    return anyConnected;
};

// ── Get Active Write Connection ───────────────────────────────────────────────

/**
 * getWriteDB — Returns the first available Mongoose connection for writing.
 * Priority: DB1 → DB2 → DB3
 * Returns null if all DBs are down.
 */
export const getWriteDB = () => {
    for (const instance of dbInstances) {
        if (instance.status === 'connected' && instance.conn) {
            return instance.conn;
        }
    }
    return null;
};

/**
 * getWriteModel — Returns a Mongoose Model bound to the active write DB.
 * @param {mongoose.Model} baseModel — The original model (e.g. User, Contract)
 */
export const getWriteModel = (baseModel) => {
    const writeDB = getWriteDB();
    if (!writeDB) return null;
    const schema = baseModel.schema;
    const modelName = baseModel.modelName;

    try {
        return writeDB.model(modelName);
    } catch {
        return writeDB.model(modelName, schema);
    }
};

// ── Read from DBs — Sequential Fallback ──────────────────────────────────────

/**
 * queryAllDBs — Sequential Fallback Strategy:
 *   1. Try DB1 first. If it returns results → return immediately.
 *   2. If DB1 errors OR returns 0 results → try DB2.
 *   3. If DB2 errors OR returns 0 results → try DB3.
 *
 * One DB is used at a time. Failover only on error or empty result.
 *
 * @param {mongoose.Model} baseModel  — Base Mongoose model
 * @param {Function}       queryFn    — async (Model) => array of docs
 * @returns {Array}                    Results from first successful DB
 */
export const queryAllDBs = async (baseModel, queryFn) => {
    const schema = baseModel.schema;
    const modelName = baseModel.modelName;

    for (const instance of dbInstances) {
        if (instance.status !== 'connected' || !instance.conn) continue;

        try {
            let BoundModel;
            try {
                BoundModel = instance.conn.model(modelName);
            } catch {
                BoundModel = instance.conn.model(modelName, schema);
            }

            const docs = await queryFn(BoundModel);

            // Got results → return immediately, don't query other DBs
            if (Array.isArray(docs)) {
                if (docs.length > 0) return docs;
            } else if (docs !== null && docs !== undefined) {
                return docs;
            }

            // Empty result → try next DB as fallback
            console.log(`[MultiDB] \u2139\ufe0f  ${instance.name} returned 0 results — trying next DB...`);

        } catch (err) {
            // Error → log and fallback to next DB
            console.warn(`[MultiDB] \u26a0\ufe0f  ${instance.name} query failed: ${err.message} — falling back...`);
        }
    }

    return [];
};


// ── DB Status ─────────────────────────────────────────────────────────────────

/**
 * getDBStatus — Returns current status of all DB instances.
 */
export const getDBStatus = () => {
    return dbInstances.map(({ name, status, uri }) => ({
        name,
        status,
        host: uri ? uri.replace(/\/\/.*@/, '//***@') : 'not configured',
    }));
};

/**
 * isAnyDBConnected — Returns true if at least 1 DB is connected.
 */
export const isAnyDBConnected = () => {
    return dbInstances.some((i) => i.status === 'connected');
};

/**
 * getPrimaryConn — Returns DB1 connection (for legacy/internal usage).
 */
export const getPrimaryConn = () => {
    return dbInstances[0]?.conn || null;
};
