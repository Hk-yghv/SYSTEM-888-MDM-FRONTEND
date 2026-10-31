import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ControlSystem from '../models/ControlSystem.js';
import { connectAllDBs, getWriteModel, isAnyDBConnected } from './multiDB.js';

export let isMongoConnected = false;

export const MEM_DB = {
    users: [
        {
            _id: 'master-admin-id',
            userId: '001290312',
            name: 'BOY BOY',
            username: '@hakyonghouv',
            email: 'yonghouvh@gmail.com',
            password: '', // set on init
            secondPassword: '',
            brand: '',
            role: 'Administrator',
            isImmutable: true,
            status: 'Online',
            telegramId: '',
            twoFactorEnabled: false,
            lastOtp: '',
            loginHistory: [{ timestamp: new Date(), ip: '127.0.0.1', deviceInfo: 'Web Browser' }],
            permissions: {}
        }
    ],
    accountLocations: [],
    loginLogs: [],
    contracts: [],
    customerIdSequence: 0,
    payments: [],
    phoneLogs: [],
    wallpaperLogs: [],
    deviceActionLogs: [],
    controlSystems: [],
    followUps: [],
    followUps2: [],
    followUpsSenSok: [],
    calendarEvents: [],
    cashTransactions: [],
    activatedDescriptionStatuses: [],
    inventoryItems: [],
    controlSystem: {
        droplists: [
            { category: 'Device Models', items: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'Samsung Galaxy S24 Ultra', 'iPad Air 5'] },
            { category: 'Contract Types', items: ['Standard Installment', 'VIP Premium', 'Corporate Plan'] },
            { category: 'Payment Methods', items: ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'] },
            { category: 'Brands', items: ['MDM', 'ECloud', '888MDM'] },
            { category: 'Follow Up 4 Sources', items: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'] },
            { category: 'Follow Up 4 Contact Types', items: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'] },
            { category: 'Follow Up 4 Asset Types', items: ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'] },
            { category: 'Reject Submit Reasons', items: [] },
            { category: 'Reject CS Reasons', items: [] }
        ],
        call_phone_display: {
            title: 'SYSTEM MDM HOTLINE',
            phoneNumber: '+855 12 903 120',
            subtext: 'Contact support for instant phone lock or payment inquiry'
        },
        lockphone_display_text: 'ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់',
        lockphone_phone_number: '+855 12 903 120',
        lockphone_telegram_chat_ids: [],
        lockphone_user_template: 'User: {{username}} — Role: {{role}}',
        roles: ['Administrator', 'Manager', 'Staff', 'Viewer', 'Salary'],
        product_variants: []
    }
};

// Initialize hash for master password
bcrypt.hash('houv#^123', 10).then(hash => {
    MEM_DB.users[0].password = hash;
});

const SYSTEM_PAGES = [
    '/dashboard', '/customer', '/device', '/contract/application', '/contract/activated',
    '/contract/check', '/contract/redeem', '/contract/comments', '/contract/blacklist',
    '/installment/schedule', '/installment/pad', '/installment/history', '/installment/paymentHistory', '/lostphone/actions', '/lostphone/lockphone', '/lostphone/unlockphone',
    '/wallpaper/actions', '/wallpaper/lockphone', '/wallpaper/unlockphone',
    '/history/login-history', '/history/device-history',
    '/report/all', '/report/activated', '/report/redeem', '/report/lock-phone', '/report/set-wallpaper', '/report/installment', '/report/follow-up',
    '/follow-up/follow-up-1', '/follow-up/follow-up-2', '/follow-up/follow-up-3', '/follow-up/sen-sok',
    '/inventory/sen-sok', '/inventory/chbar-ampov', '/inventory/stueng-mean-chey',
    '/settings/all-account', '/settings/control-system', '/settings/products',
    '/phone-valuation', '/calendar', '/profile', '/audit/device'
];

export const ensureMasterAdmin = async () => {
    try {
        if (!isMongoConnected) return;

        // Use write model bound to the active write DB (DB1 → DB2 → DB3)
        const UserWrite = getWriteModel(User) || User;
        const masterUsername = '@hakyonghouv';
        let admin = await UserWrite.findOne({ username: masterUsername });
        const hashedPassword = await bcrypt.hash('houv#^123', 10);

        const fullPermissions = {};
        SYSTEM_PAGES.forEach(pg => {
            fullPermissions[pg] = { read: true, edit: true, create: true, delete: true };
        });

        if (!admin) {
            admin = new UserWrite({
                userId: '001290312',
                name: 'BOY BOY',
                username: masterUsername,
                email: 'yonghouvh@gmail.com',
                password: hashedPassword,
                secondPassword: '',
                brand: '',
                role: 'Administrator',
                isImmutable: true,
                status: 'Online',
                permissions: fullPermissions
            });
            await admin.save();
        }
    } catch (err) {
        console.error('Master admin sync error:', err.message);
    }
};

// ── Main entry point — connects to all 3 MongoDB instances ───────────────────
export const connectDB = async () => {
    const anyConnected = await connectAllDBs();
    isMongoConnected = anyConnected || isAnyDBConnected();

    if (isMongoConnected) {
        console.log('[DB] Multi-MongoDB ready. Write target: first available DB (DB1 → DB2 → DB3).');

        // Clean up legacy single 'key_1' index on primary ControlSystem
        const ControlSystemWrite = getWriteModel(ControlSystem) || ControlSystem;
        try {
            await ControlSystemWrite.collection.dropIndex('key_1');
            console.log('[DB] Dropped legacy key_1 index on ControlSystem.');
        } catch (e) {
            // Index key_1 does not exist — normal
        }
        try {
            await ControlSystemWrite.syncIndexes();
        } catch (syncErr) {
            console.warn('[DB] ControlSystem syncIndexes warning:', syncErr.message);
        }

        await ensureMasterAdmin();
    } else {
        console.error('[DB] No MongoDB connected. System running in memory-only mode.');
    }
};
