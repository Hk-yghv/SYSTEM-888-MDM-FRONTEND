import express from 'express';
import Salary from '../models/Salary.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();

if (!MEM_DB.salaries) {
    MEM_DB.salaries = [];
}

// GET /api/salary/staff-list - Directory of all staff with salary records & salary accounts for Admin
router.get('/staff-list', async (req, res) => {
    try {
        const { userBrand = '', userRole = '', username = '', isImmutable = 'false' } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator');

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

        // Map of staff members
        const staffMap = new Map();

        // 1. Seed with registered users having role 'salary' or staff
        allUsers.forEach(u => {
            const uRole = (u.role || '').toLowerCase();
            if (uRole === 'salary' || isMasterAdmin) {
                const key = (u.username || u.name || '').trim();
                if (key && !staffMap.has(key)) {
                    staffMap.set(key, {
                        key,
                        staffName: u.username || u.name || '',
                        staffNameKh: u.nameKh || '',
                        staffNameEn: u.name || u.username || '',
                        joinDate: u.joinDate || '',
                        role: u.role || 'Salary',
                        brand: u.brand || '',
                        avatar: u.avatar || '',
                        totalAmount: 0,
                        recordsCount: 0,
                        latestDate: '',
                        isUserAccount: true
                    });
                }
            }
        });

        // 2. Aggregate from all Salary records
        allSalaries.forEach(item => {
            const rawKey = (item.staffName || item.staffNameEn || item.staffNameKh || item.createdBy || 'Unknown').trim();
            if (!rawKey) return;

            let entry = staffMap.get(rawKey);
            if (!entry) {
                // Check if matches by English or Khmer name
                for (const existing of staffMap.values()) {
                    if (
                        (item.staffNameEn && existing.staffNameEn && existing.staffNameEn.toLowerCase() === item.staffNameEn.toLowerCase()) ||
                        (item.staffNameKh && existing.staffNameKh && existing.staffNameKh === item.staffNameKh) ||
                        (item.staffName && existing.staffName && existing.staffName.toLowerCase() === item.staffName.toLowerCase())
                    ) {
                        entry = existing;
                        break;
                    }
                }
            }

            if (!entry) {
                entry = {
                    key: rawKey,
                    staffName: item.staffName || item.staffNameEn || item.staffNameKh || rawKey,
                    staffNameKh: item.staffNameKh || '',
                    staffNameEn: item.staffNameEn || item.staffName || '',
                    joinDate: item.joinDate || '',
                    role: 'Staff',
                    brand: item.brand || '',
                    avatar: '',
                    totalAmount: 0,
                    recordsCount: 0,
                    latestDate: '',
                    isUserAccount: false
                };
                staffMap.set(rawKey, entry);
            }

            if (!entry.staffNameKh && item.staffNameKh) entry.staffNameKh = item.staffNameKh;
            if (!entry.staffNameEn && (item.staffNameEn || item.staffName)) entry.staffNameEn = item.staffNameEn || item.staffName;
            if (!entry.joinDate && item.joinDate) entry.joinDate = item.joinDate;
            if (!entry.brand && item.brand) entry.brand = item.brand;

            entry.totalAmount += Number(item.amount) || 0;
            entry.recordsCount += 1;

            if (item.date && (!entry.latestDate || item.date > entry.latestDate)) {
                entry.latestDate = item.date;
            }
        });

        const staffList = Array.from(staffMap.values()).sort((a, b) => b.recordsCount - a.recordsCount || a.staffName.localeCompare(b.staffName));

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
            staffName = ''
        } = req.query;

        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator');
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pageSize = parseInt(limit);

        let filter = {};
        // If not Master Admin, strictly isolate to the user's own salary records only
        if (!isMasterAdmin) {
            filter.$or = [
                { createdBy: username },
                { staffName: username },
                { staffNameEn: username },
                { staffNameKh: username }
            ];
            if (userBrand) filter.brand = userBrand;
        } else if (staffName) {
            // Master Admin filtering by specific staff
            filter.$or = [
                { staffName: staffName },
                { staffNameEn: staffName },
                { staffNameKh: staffName },
                { createdBy: staffName }
            ];
            if (userBrand) filter.brand = userBrand;
        } else if (userBrand) {
            // Master Admin can optionally filter by brand if provided
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
                list = list.filter(item =>
                    item.createdBy === username ||
                    item.staffName === username ||
                    item.staffNameEn === username ||
                    item.staffNameKh === username
                );
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (staffName) {
                list = list.filter(item =>
                    item.staffName === staffName ||
                    item.staffNameEn === staffName ||
                    item.staffNameKh === staffName ||
                    item.createdBy === staffName
                );
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
            staffName = ''
        } = req.query;

        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator');

        let filter = {};
        if (!isMasterAdmin) {
            filter.$or = [
                { createdBy: username },
                { staffName: username },
                { staffNameEn: username },
                { staffNameKh: username }
            ];
            if (userBrand) filter.brand = userBrand;
        } else if (staffName) {
            filter.$or = [
                { staffName: staffName },
                { staffNameEn: staffName },
                { staffNameKh: staffName },
                { createdBy: staffName }
            ];
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
                list = list.filter(item =>
                    item.createdBy === username ||
                    item.staffName === username ||
                    item.staffNameEn === username ||
                    item.staffNameKh === username
                );
                if (userBrand) list = list.filter(item => item.brand === userBrand);
            } else if (staffName) {
                list = list.filter(item =>
                    item.staffName === staffName ||
                    item.staffNameEn === staffName ||
                    item.staffNameKh === staffName ||
                    item.createdBy === staffName
                );
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
            category: category || 'Basic Salary',
            paymentMethod: paymentMethod || 'ABA Bank',
            note: note || '',
            brand: brand || '',
            createdBy: createdBy || 'Administrator'
        };

        if (isMongoConnected) {
            const WriteSalary = getWriteModel(Salary);
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

// PUT /api/salary/:id - Update salary record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
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

        if (isMongoConnected) {
            const WriteSalary = getWriteModel(Salary);
            const updated = await WriteSalary.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
            if (!updated) {
                return res.status(404).json({ error: 'Salary entry not found' });
            }
            return res.json({ message: 'Salary entry updated successfully', data: updated });
        } else {
            const index = MEM_DB.salaries.findIndex(s => s._id === id || s.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Salary entry not found' });
            }
            MEM_DB.salaries[index] = {
                ...MEM_DB.salaries[index],
                ...updateFields,
                updatedAt: new Date().toISOString()
            };
            return res.json({ message: 'Salary entry updated successfully', data: MEM_DB.salaries[index] });
        }
    } catch (err) {
        console.error('Update salary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/salary/:id - Delete salary record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            const WriteSalary = getWriteModel(Salary);
            const deleted = await WriteSalary.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ error: 'Salary entry not found' });
            }
            return res.json({ message: 'Salary entry deleted successfully' });
        } else {
            const index = MEM_DB.salaries.findIndex(s => s._id === id || s.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Salary entry not found' });
            }
            MEM_DB.salaries.splice(index, 1);
            return res.json({ message: 'Salary entry deleted successfully' });
        }
    } catch (err) {
        console.error('Delete salary error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
