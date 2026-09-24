import express from 'express';
import Salary from '../models/Salary.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.salaries) {
    MEM_DB.salaries = [];
}

const norm = (str) => (str || '').toString().trim().replace(/^@/, '').toLowerCase();

// GET /api/salary/staff-list - Directory of all staff with salary records & salary accounts for Admin
router.get('/staff-list', async (req, res) => {
    try {
        const { userBrand = '', userRole = '', username = '', isImmutable = 'false' } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator' || userRole === 'Admin');

        let allSalaries = [];
        let allUsers = [];

        if (isMongoConnected) {
            allSalaries = await queryAllDBs(Salary, (M) => M.find(userBrand && !isMasterAdmin ? { brand: userBrand } : {}).sort({ date: -1 }));
            allUsers = await queryAllDBs(User, (M) => M.find({}));
        } else {
            allSalaries = [...MEM_DB.salaries];
            if (userBrand && !isMasterAdmin) {
                allSalaries = allSalaries.filter(s => s.brand === userBrand);
            }
            allUsers = [...(MEM_DB.users || [])];
        }

        // Map of staff members keyed by normalized username/name
        const staffMap = new Map();

        // 1. Include registered users (especially role 'salary' or staff accounts)
        allUsers.forEach(u => {
            const uRole = (u.role || '').toLowerCase();
            const rawKey = (u.username || u.name || '').trim();
            const nKey = norm(rawKey);
            if (!nKey) return;

            if (uRole === 'salary' || !staffMap.has(nKey)) {
                staffMap.set(nKey, {
                    key: rawKey,
                    staffName: u.username || u.name || '',
                    staffNameKh: u.nameKh || '',
                    staffNameEn: u.name || u.username || '',
                    joinDate: u.joinDate || '',
                    role: u.role || 'Salary',
                    brand: u.brand || '',
                    avatar: u.avatar || '',
                    qrCodePhoto: u.qrCodePhoto || '',
                    totalAmount: 0,
                    recordsCount: 0,
                    latestDate: '',
                    isUserAccount: true
                });
            }
        });

        // 2. Aggregate salary amounts and incorporate any staff from salary records
        allSalaries.forEach(item => {
            const rawKey = (item.staffName || item.staffNameEn || item.staffNameKh || item.createdBy || '').trim();
            if (!rawKey) return;

            const nStaffName = norm(item.staffName);
            const nStaffNameEn = norm(item.staffNameEn);
            const nStaffNameKh = (item.staffNameKh || '').trim();
            const nCreatedBy = norm(item.createdBy);

            // Find matching entry in staffMap
            let entry = staffMap.get(nStaffName) || staffMap.get(nStaffNameEn) || staffMap.get(nCreatedBy);
            if (!entry) {
                for (const existing of staffMap.values()) {
                    const exName = norm(existing.staffName);
                    const exNameEn = norm(existing.staffNameEn);
                    const exKey = norm(existing.key);
                    const exKh = (existing.staffNameKh || '').trim();

                    if (
                        (nStaffName && (exName === nStaffName || exNameEn === nStaffName || exKey === nStaffName)) ||
                        (nStaffNameEn && (exName === nStaffNameEn || exNameEn === nStaffNameEn || exKey === nStaffNameEn)) ||
                        (nCreatedBy && (exName === nCreatedBy || exKey === nCreatedBy)) ||
                        (nStaffNameKh && exKh && exKh === nStaffNameKh)
                    ) {
                        entry = existing;
                        break;
                    }
                }
            }

            // If still no entry exists in staffMap, create one from salary record
            if (!entry) {
                const primaryKey = nStaffName || nStaffNameEn || nCreatedBy || rawKey;
                entry = {
                    key: rawKey,
                    staffName: item.staffName || item.staffNameEn || item.staffNameKh || item.createdBy || 'Staff',
                    staffNameKh: item.staffNameKh || '',
                    staffNameEn: item.staffNameEn || item.staffName || '',
                    joinDate: item.joinDate || '',
                    role: 'Salary',
                    brand: item.brand || '',
                    avatar: '',
                    qrCodePhoto: item.qrCodePhoto || '',
                    totalAmount: 0,
                    recordsCount: 0,
                    latestDate: '',
                    isUserAccount: false
                };
                staffMap.set(primaryKey, entry);
            }

            // Update entry details from salary record if missing or newer
            if (!entry.staffNameKh && item.staffNameKh) entry.staffNameKh = item.staffNameKh;
            if (!entry.staffNameEn && (item.staffNameEn || item.staffName)) entry.staffNameEn = item.staffNameEn || item.staffName;
            if ((!entry.joinDate || entry.joinDate === '—') && item.joinDate) entry.joinDate = item.joinDate;
            if (!entry.qrCodePhoto && item.qrCodePhoto) entry.qrCodePhoto = item.qrCodePhoto;
            if (!entry.brand && item.brand) entry.brand = item.brand;

            entry.totalAmount += Number(item.amount) || 0;
            entry.recordsCount += 1;

            if (item.date && (!entry.latestDate || item.date > entry.latestDate)) {
                entry.latestDate = item.date;
                if (item.joinDate && (!entry.joinDate || entry.joinDate === '—')) {
                    entry.joinDate = item.joinDate;
                }
            }
        });

        // Filter and sort staff directory
        const staffList = Array.from(staffMap.values())
            .filter(s => {
                const r = (s.role || '').toLowerCase();
                return r === 'salary' || s.recordsCount > 0 || isMasterAdmin;
            })
            .sort((a, b) => b.recordsCount - a.recordsCount || a.staffName.localeCompare(b.staffName));

        res.json({
            data: staffList,
            total: staffList.length
        });
    } catch (err) {
        console.error('Fetch staff list error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/salary - List salaries with filtering, pagination, search
router.get('/', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            page = 1,
            limit = 10,
            search = '',
            startDate = '',
            endDate = '',
            month = '',
            year = '',
            paymentMethod = '',
            staffName = '',
            staffNameKh = '',
            staffNameEn = ''
        } = req.query;

        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator' || userRole === 'Admin');
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        let filter = {};
        // If not Master Admin, strictly isolate to the user's own salary records only
        if (!isMasterAdmin) {
            const cleanUser = username.trim().replace(/^@/, '');
            const uRegex = new RegExp(`^@?${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            filter.$or = [
                { createdBy: uRegex },
                { staffName: uRegex },
                { staffNameEn: uRegex },
                { staffNameKh: username }
            ];
            if (userBrand) filter.brand = userBrand;
        } else if (staffName || staffNameKh || staffNameEn) {
            const staffQueries = [];
            if (staffName) {
                const clean = staffName.trim().replace(/^@/, '');
                const sRegex = new RegExp(`^@?${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                staffQueries.push({ staffName: sRegex }, { staffNameEn: sRegex }, { staffNameKh: staffName }, { createdBy: sRegex });
            }
            if (staffNameKh) {
                staffQueries.push({ staffNameKh });
            }
            if (staffNameEn) {
                const cleanEn = staffNameEn.trim().replace(/^@/, '');
                const enRegex = new RegExp(`^@?${cleanEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                staffQueries.push({ staffNameEn: enRegex }, { staffName: enRegex });
            }
            filter.$or = staffQueries;
            if (userBrand) filter.brand = userBrand;
        } else if (userBrand) {
            filter.brand = userBrand;
        }

        if (month) {
            filter.month = month;
        }
        if (year) {
            filter.year = year;
        }
        if (paymentMethod) {
            filter.paymentMethod = paymentMethod;
        }

        let allRecords = [];
        if (isMongoConnected) {
            allRecords = await queryAllDBs(Salary, (M) => {
                let f = { ...filter };
                if (search) {
                    const searchConditions = [
                        { staffName: { $regex: search, $options: 'i' } },
                        { staffNameKh: { $regex: search, $options: 'i' } },
                        { staffNameEn: { $regex: search, $options: 'i' } },
                        { joinDate: { $regex: search, $options: 'i' } },
                        { note: { $regex: search, $options: 'i' } },
                        { category: { $regex: search, $options: 'i' } },
                        { paymentMethod: { $regex: search, $options: 'i' } },
                        { createdBy: { $regex: search, $options: 'i' } }
                    ];
                    if (f.$or) {
                        f.$and = [
                            { $or: f.$or },
                            { $or: searchConditions }
                        ];
                        delete f.$or;
                    } else {
                        f.$or = searchConditions;
                    }
                }
                if (startDate || endDate) {
                    f.date = {};
                    if (startDate) f.date.$gte = startDate;
                    if (endDate) f.date.$lte = endDate;
                }
                return M.find(f).sort({ date: -1, createdAt: -1 });
            });
        } else {
            let list = [...MEM_DB.salaries];
            if (!isMasterAdmin) {
                const cleanUser = username.trim().replace(/^@/, '').toLowerCase();
                list = list.filter(item =>
                    norm(item.createdBy) === cleanUser ||
                    norm(item.staffName) === cleanUser ||
                    norm(item.staffNameEn) === cleanUser ||
                    (item.staffNameKh && item.staffNameKh === username)
                );
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (staffName || staffNameKh || staffNameEn) {
                const cleanStaff = (staffName || '').trim().replace(/^@/, '').toLowerCase();
                const cleanEn = (staffNameEn || '').trim().replace(/^@/, '').toLowerCase();
                list = list.filter(item => {
                    const iStaff = norm(item.staffName);
                    const iEn = norm(item.staffNameEn);
                    const iCreated = norm(item.createdBy);
                    const iKh = (item.staffNameKh || '').trim();
                    return (
                        (cleanStaff && (iStaff === cleanStaff || iEn === cleanStaff || iCreated === cleanStaff || iKh === staffName)) ||
                        (cleanEn && (iEn === cleanEn || iStaff === cleanEn)) ||
                        (staffNameKh && iKh === staffNameKh)
                    );
                });
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (userBrand) {
                list = list.filter(item => item.brand === userBrand);
            }
            if (month) list = list.filter(item => item.month === month);
            if (year) list = list.filter(item => item.year === year);
            if (paymentMethod) list = list.filter(item => item.paymentMethod === paymentMethod);
            if (search) {
                const s = search.toLowerCase();
                list = list.filter(item =>
                    (item.staffName && item.staffName.toLowerCase().includes(s)) ||
                    (item.staffNameKh && item.staffNameKh.toLowerCase().includes(s)) ||
                    (item.staffNameEn && item.staffNameEn.toLowerCase().includes(s)) ||
                    (item.joinDate && item.joinDate.toLowerCase().includes(s)) ||
                    (item.note && item.note.toLowerCase().includes(s)) ||
                    (item.category && item.category.toLowerCase().includes(s)) ||
                    (item.paymentMethod && item.paymentMethod.toLowerCase().includes(s)) ||
                    (item.createdBy && item.createdBy.toLowerCase().includes(s))
                );
            }
            if (startDate || endDate) {
                list = list.filter(item => {
                    if (startDate && item.date < startDate) return false;
                    if (endDate && item.date > endDate) return false;
                    return true;
                });
            }
            allRecords = list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        }

        // Deduplicate records by _id
        const seen = new Set();
        const deduped = [];
        for (const item of allRecords) {
            const id = (item._id || item.id || '').toString();
            if (id && !seen.has(id)) {
                seen.add(id);
                deduped.push(item);
            } else if (!id) {
                deduped.push(item);
            }
        }

        const total = deduped.length;
        const data = pageSize >= 9999 ? deduped : deduped.slice(skip, skip + pageSize);
        const totalAmount = deduped.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        res.json({
            data,
            total,
            totalAmount,
            page: parseInt(page),
            totalPages: Math.ceil(total / pageSize) || 1
        });
    } catch (err) {
        console.error('Fetch salaries error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/salary/stats - Aggregated Monthly Stats for Bar Chart & Cards
router.get('/stats', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            year = '',
            staffName = '',
            staffNameKh = '',
            staffNameEn = ''
        } = req.query;

        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator' || userRole === 'Admin');

        let filter = {};
        if (!isMasterAdmin) {
            const cleanUser = username.trim().replace(/^@/, '');
            const uRegex = new RegExp(`^@?${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            filter.$or = [
                { createdBy: uRegex },
                { staffName: uRegex },
                { staffNameEn: uRegex },
                { staffNameKh: username }
            ];
            if (userBrand) filter.brand = userBrand;
        } else if (staffName || staffNameKh || staffNameEn) {
            const staffQueries = [];
            if (staffName) {
                const clean = staffName.trim().replace(/^@/, '');
                const sRegex = new RegExp(`^@?${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                staffQueries.push({ staffName: sRegex }, { staffNameEn: sRegex }, { staffNameKh: staffName }, { createdBy: sRegex });
            }
            if (staffNameKh) {
                staffQueries.push({ staffNameKh });
            }
            if (staffNameEn) {
                const cleanEn = staffNameEn.trim().replace(/^@/, '');
                const enRegex = new RegExp(`^@?${cleanEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                staffQueries.push({ staffNameEn: enRegex }, { staffName: enRegex });
            }
            filter.$or = staffQueries;
            if (userBrand) filter.brand = userBrand;
        } else if (userBrand) {
            filter.brand = userBrand;
        }
        if (year) {
            filter.year = year;
        }

        let allRecords = [];
        if (isMongoConnected) {
            allRecords = await queryAllDBs(Salary, (M) => M.find(filter).sort({ date: 1 }));
        } else {
            let list = [...MEM_DB.salaries];
            if (!isMasterAdmin) {
                const cleanUser = username.trim().replace(/^@/, '').toLowerCase();
                list = list.filter(item =>
                    norm(item.createdBy) === cleanUser ||
                    norm(item.staffName) === cleanUser ||
                    norm(item.staffNameEn) === cleanUser ||
                    (item.staffNameKh && item.staffNameKh === username)
                );
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (staffName || staffNameKh || staffNameEn) {
                const cleanStaff = (staffName || '').trim().replace(/^@/, '').toLowerCase();
                const cleanEn = (staffNameEn || '').trim().replace(/^@/, '').toLowerCase();
                list = list.filter(item => {
                    const iStaff = norm(item.staffName);
                    const iEn = norm(item.staffNameEn);
                    const iCreated = norm(item.createdBy);
                    const iKh = (item.staffNameKh || '').trim();
                    return (
                        (cleanStaff && (iStaff === cleanStaff || iEn === cleanStaff || iCreated === cleanStaff || iKh === staffName)) ||
                        (cleanEn && (iEn === cleanEn || iStaff === cleanEn)) ||
                        (staffNameKh && iKh === staffNameKh)
                    );
                });
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (userBrand) {
                list = list.filter(item => item.brand === userBrand);
            }
            if (year) list = list.filter(item => item.year === year);
            allRecords = list;
        }

        // Deduplicate
        const seen = new Set();
        const deduped = [];
        for (const item of allRecords) {
            const id = (item._id || item.id || '').toString();
            if (id && !seen.has(id)) {
                seen.add(id);
                deduped.push(item);
            } else if (!id) {
                deduped.push(item);
            }
        }

        let grandTotal = 0;
        const monthlyMap = {};
        const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
        let currentMonthTotal = 0;

        deduped.forEach(item => {
            const amt = Number(item.amount) || 0;
            grandTotal += amt;

            let mKey = item.month;
            if (!mKey && item.date) {
                mKey = item.date.slice(0, 7);
            }
            if (!mKey) mKey = 'Unknown';

            if (!monthlyMap[mKey]) {
                monthlyMap[mKey] = {
                    month: mKey,
                    totalAmount: 0,
                    count: 0
                };
            }
            monthlyMap[mKey].totalAmount += amt;
            monthlyMap[mKey].count += 1;

            if (mKey === currentMonthKey) {
                currentMonthTotal += amt;
            }
        });

        const monthlyStats = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

        res.json({
            grandTotal,
            currentMonthTotal,
            totalRecords: deduped.length,
            monthlyStats
        });
    } catch (err) {
        console.error('Fetch salary stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/salary/save-staff-info - Save or update staff profile info (Khmer/English names, Join Date & QR Code)
router.post('/save-staff-info', async (req, res) => {
    try {
        const { staffKey = '', username = '', staffNameKh = '', staffNameEn = '', joinDate = '', qrCodePhoto = '' } = req.body;
        const targetUsername = (username || staffKey || '').trim().replace(/^@/, '');
        const targetKey = (staffKey || username || '').trim();

        if (!targetKey && !targetUsername && !staffNameKh && !staffNameEn) {
            return res.status(400).json({ error: 'Staff identifier is required' });
        }

        // 1. Update User if found
        if (isMongoConnected) {
            const UserWrite = getWriteModel(User) || User;
            const userFilter = {
                $or: [
                    { username: targetUsername },
                    { username: `@${targetUsername}` },
                    { username: targetKey },
                    { name: targetKey },
                    { name: staffNameEn }
                ].filter(c => Object.values(c)[0])
            };
            if (userFilter.$or.length > 0) {
                await UserWrite.updateMany(userFilter, {
                    $set: {
                        ...(staffNameKh ? { nameKh: staffNameKh } : {}),
                        ...(staffNameEn ? { name: staffNameEn } : {}),
                        ...(joinDate ? { joinDate } : {}),
                        ...(qrCodePhoto !== undefined ? { qrCodePhoto } : {})
                    }
                });
            }

            // 2. Update all existing Salary records for this staff
            const SalaryWrite = getWriteModel(Salary) || Salary;
            const salaryFilter = {
                $or: [
                    { staffName: targetKey },
                    { staffName: targetUsername },
                    { staffName: `@${targetUsername}` },
                    { staffNameEn: staffNameEn || targetKey },
                    { staffNameKh: staffNameKh },
                    { createdBy: targetUsername },
                    { createdBy: `@${targetUsername}` }
                ].filter(c => Object.values(c)[0])
            };
            if (salaryFilter.$or.length > 0) {
                const updateDoc = {
                    ...(staffNameKh ? { staffNameKh } : {}),
                    ...(staffNameEn ? { staffNameEn, staffName: staffNameEn } : {}),
                    ...(joinDate ? { joinDate } : {}),
                    ...(qrCodePhoto !== undefined ? { qrCodePhoto } : {})
                };
                if (Object.keys(updateDoc).length > 0) {
                    await SalaryWrite.updateMany(salaryFilter, { $set: updateDoc });
                }
            }
        }

        // Update MEM_DB if needed
        (MEM_DB.users || []).forEach(u => {
            const uUser = (u.username || '').replace(/^@/, '');
            if (uUser === targetUsername || u.name === targetKey) {
                if (staffNameKh) u.nameKh = staffNameKh;
                if (staffNameEn) u.name = staffNameEn;
                if (joinDate) u.joinDate = joinDate;
                if (qrCodePhoto !== undefined) u.qrCodePhoto = qrCodePhoto;
            }
        });
        (MEM_DB.salaries || []).forEach(s => {
            const sStaff = (s.staffName || '').replace(/^@/, '');
            const sCreated = (s.createdBy || '').replace(/^@/, '');
            if (sStaff === targetUsername || sCreated === targetUsername || (staffNameKh && s.staffNameKh === staffNameKh)) {
                if (staffNameKh) s.staffNameKh = staffNameKh;
                if (staffNameEn) { s.staffNameEn = staffNameEn; s.staffName = staffNameEn; }
                if (joinDate) s.joinDate = joinDate;
                if (qrCodePhoto !== undefined) s.qrCodePhoto = qrCodePhoto;
            }
        });

        res.json({
            message: 'Staff profile updated successfully',
            data: { staffNameKh, staffNameEn, joinDate, qrCodePhoto }
        });
    } catch (err) {
        console.error('Save staff info error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/salary - Create new salary record
router.post('/', async (req, res) => {
    try {
        const {
            staffName = '',
            staffNameKh = '',
            staffNameEn = '',
            joinDate = '',
            amount,
            date,
            proofPhoto = '',
            qrCodePhoto = '',
            category = 'Basic Salary',
            paymentMethod = 'ABA Bank',
            note = '',
            brand = '',
            createdBy = 'Administrator'
        } = req.body;

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Please provide a valid salary amount (ចំនួនប្រាក់ខែ).' });
        }
        if (!date) {
            return res.status(400).json({ error: 'Please provide a valid date (កាលបរិច្ឆេទ).' });
        }

        const dateStr = String(date).split('T')[0];
        const parts = dateStr.split('-');
        const year = parts[0] || new Date().getFullYear().toString();
        const month = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : dateStr.slice(0, 7);

        const salaryData = {
            staffName: String(staffName || staffNameEn || staffNameKh || '').trim(),
            staffNameKh: String(staffNameKh).trim(),
            staffNameEn: String(staffNameEn || staffName || '').trim(),
            joinDate: String(joinDate || '').trim(),
            amount: Number(amount),
            date: dateStr,
            month,
            year,
            proofPhoto: proofPhoto || '',
            qrCodePhoto: qrCodePhoto || '',
            category: category || 'Basic Salary',
            paymentMethod: paymentMethod || 'ABA Bank',
            note: note || '',
            brand: brand || '',
            createdBy: createdBy || 'Administrator'
        };

        if (isMongoConnected) {
            const WriteSalary = getWriteModel(Salary) || Salary;
            const newSalary = new WriteSalary(salaryData);
            const saved = await newSalary.save();
            return res.status(201).json({ message: 'Salary recorded successfully', data: saved });
        } else {
            const memorySalary = {
                _id: 'sal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                ...salaryData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            MEM_DB.salaries.unshift(memorySalary);
            return res.status(201).json({ message: 'Salary recorded successfully (Memory Mode)', data: memorySalary });
        }
    } catch (err) {
        console.error('Create salary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/salary/:id - Fetch single salary record
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({ error: 'Invalid salary ID parameter' });
        }

        if (isMongoConnected) {
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                const item = await queryAllDBs(Salary, (M) => M.findById(id));
                if (item && item.length > 0) {
                    return res.json({ success: true, data: item[0] });
                }
            }
        }

        const memItem = (MEM_DB.salaries || []).find(s => String(s._id) === String(id) || String(s.id) === String(id));
        if (memItem) {
            return res.json({ success: true, data: memItem });
        }

        return res.status(404).json({ error: 'Salary entry not found' });
    } catch (err) {
        console.error('Fetch salary by ID error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// PUT /api/salary/:id - Update salary record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({ error: 'Invalid salary ID parameter' });
        }

        const updateFields = { ...req.body };

        if (updateFields.amount !== undefined) {
            updateFields.amount = Number(updateFields.amount);
        }
        if (updateFields.date) {
            const dateStr = String(updateFields.date).split('T')[0];
            updateFields.date = dateStr;
            const parts = dateStr.split('-');
            updateFields.year = parts[0];
            updateFields.month = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : dateStr.slice(0, 7);
        }

        if (isMongoConnected && id.match(/^[0-9a-fA-F]{24}$/)) {
            const WriteSalary = getWriteModel(Salary) || Salary;
            const updated = await WriteSalary.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
            if (updated) {
                return res.json({ message: 'Salary entry updated successfully', data: updated });
            }
        }
        
        // Memory fallback
        const index = (MEM_DB.salaries || []).findIndex(s => String(s._id) === String(id) || String(s.id) === String(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Salary entry not found' });
        }
        MEM_DB.salaries[index] = {
            ...MEM_DB.salaries[index],
            ...updateFields,
            updatedAt: new Date().toISOString()
        };
        return res.json({ message: 'Salary entry updated successfully', data: MEM_DB.salaries[index] });
    } catch (err) {
        console.error('Update salary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/salary/:id - Delete salary record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({ error: 'Invalid salary ID parameter' });
        }

        let targetSalary = null;

        if (isMongoConnected && id.match(/^[0-9a-fA-F]{24}$/)) {
            const results = await queryAllDBs(Salary, (M) => M.findById(id));
            targetSalary = results.find(r => r != null) || null;
            const WriteSalary = getWriteModel(Salary) || Salary;
            await WriteSalary.findByIdAndDelete(id);
        } else {
            const index = (MEM_DB.salaries || []).findIndex(s => String(s._id) === String(id) || String(s.id) === String(id));
            if (index !== -1) {
                targetSalary = MEM_DB.salaries[index];
                MEM_DB.salaries.splice(index, 1);
            }
        }

        // Record audit log with deleted salary record
        recordSystemAudit({
            category: 'Financial',
            level: 'Warning',
            action: 'SALARY_RECORD_DELETE',
            taskCategory: 'Salary Deletion',
            description: `Deleted salary record for ${targetSalary?.staffName || targetSalary?.username || id} (Amount: $${targetSalary?.netSalary || targetSalary?.salary || 0}, Month: ${targetSalary?.month || targetSalary?.date || 'N/A'})`,
            username: req.user?.username || req.query?.username || 'Staff',
            brand: targetSalary?.brand || '',
            payload: {
                deletedData: targetSalary || { id }
            }
        }).catch(() => {});

        return res.json({ message: 'Salary entry deleted successfully' });
    } catch (err) {
        console.error('Delete salary error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
