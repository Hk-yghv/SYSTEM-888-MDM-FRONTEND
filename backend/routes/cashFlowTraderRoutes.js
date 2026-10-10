import express from 'express';
import CashTransaction from '../models/CashTransaction.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';

const router = express.Router();

const normalizeDateStr = (dateVal) => {
    if (!dateVal) return '';
    const clean = String(dateVal).trim().split('T')[0].split(' ')[0];
    const dmy = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = clean.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return clean;
};

// GET /api/cashflow-trader
router.get('/', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            startDate = '',
            endDate = '',
            limitDays = 90
        } = req.query;

        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

        let cashTransactions = [];
        let payments = [];

        if (isMongoConnected) {
            // Fetch cash transactions
            cashTransactions = await queryAllDBs(CashTransaction, (M) => {
                let f = {};
                if (userBrand && !isMasterAdmin) {
                    f.brand = userBrand;
                }
                return M.find(f).lean();
            });

            // Fetch payments (Customer Installments = Cash In)
            payments = await queryAllDBs(Payment, (M) => {
                let f = {};
                if (userBrand && !isMasterAdmin) {
                    f.brand = userBrand;
                }
                return M.find(f).lean();
            });
        } else {
            let ctList = MEM_DB.cashTransactions || [];
            let pList = MEM_DB.payments || [];
            if (userBrand && !isMasterAdmin) {
                ctList = ctList.filter(item => item.brand === userBrand);
                pList = pList.filter(item => item.brand === userBrand);
            }
            cashTransactions = ctList;
            payments = pList;
        }

        // Deduplicate records if any from multiDB query
        const ctSeen = new Set();
        const uniqueCT = [];
        for (const item of cashTransactions) {
            const key = item._id ? String(item._id) : (item.transactionId || JSON.stringify(item));
            if (!ctSeen.has(key)) {
                ctSeen.add(key);
                uniqueCT.push(item);
            }
        }

        const pSeen = new Set();
        const uniquePayments = [];
        for (const item of payments) {
            const key = item._id ? String(item._id) : (item.paymentId || JSON.stringify(item));
            if (!pSeen.has(key)) {
                pSeen.add(key);
                uniquePayments.push(item);
            }
        }

        // Map transactions by Date (YYYY-MM-DD)
        const dateMap = {};

        // 1. Process Installment Payments (Cash In)
        uniquePayments.forEach(p => {
            const dateStr = normalizeDateStr(p.paidDate || p.createdAt);
            if (!dateStr || dateStr.length < 10) return;

            if (!dateMap[dateStr]) {
                dateMap[dateStr] = {
                    date: dateStr,
                    cashIn: 0,
                    cashOut: 0,
                    inflowItems: [],
                    outflowItems: []
                };
            }

            const amt = Number(p.amount) || 0;
            dateMap[dateStr].cashIn += amt;
            dateMap[dateStr].inflowItems.push({
                source: 'Payment',
                title: p.customerName ? `បង់ប្រាក់រំលស់ - ${p.customerName}` : 'ការបង់ប្រាក់កុងត្រា',
                amount: amt,
                category: p.paymentType || 'Installment',
                performedBy: p.paidBy || 'Customer QR',
                time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
            });
        });

        // 2. Process Cash Transactions (cash_in, cash_out, penalty)
        uniqueCT.forEach(c => {
            const dateStr = normalizeDateStr(c.date || c.createdAt);
            if (!dateStr || dateStr.length < 10) return;

            if (!dateMap[dateStr]) {
                dateMap[dateStr] = {
                    date: dateStr,
                    cashIn: 0,
                    cashOut: 0,
                    inflowItems: [],
                    outflowItems: []
                };
            }

            const amtUSD = Number(c.amountUSD ?? c.amount) || 0;
            const type = String(c.type || '').toLowerCase();

            if (type === 'cash_out') {
                dateMap[dateStr].cashOut += amtUSD;
                dateMap[dateStr].outflowItems.push({
                    source: 'CashTransaction',
                    title: c.description || c.category || 'ចំណាយប្រាក់ចេញ',
                    amount: amtUSD,
                    category: c.category || 'Expense',
                    performedBy: c.performedBy || 'Staff',
                    time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                });
            } else {
                // cash_in or penalty
                dateMap[dateStr].cashIn += amtUSD;
                dateMap[dateStr].inflowItems.push({
                    source: 'CashTransaction',
                    title: c.description || (type === 'penalty' ? 'ប្រាក់ពិន័យ' : 'ប្រាក់ចូល'),
                    amount: amtUSD,
                    category: c.category || (type === 'penalty' ? 'Penalty' : 'Cash In'),
                    performedBy: c.performedBy || 'Staff',
                    time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                });
            }
        });

        // Sort all dates chronologically (oldest to newest) to calculate Day-over-Day
        const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

        const dailyRecords = [];
        let runningBalance = 0;

        for (let i = 0; i < sortedDates.length; i++) {
            const dStr = sortedDates[i];
            const current = dateMap[dStr];
            const prev = i > 0 ? dateMap[sortedDates[i - 1]] : null;

            const cashIn = Math.round(current.cashIn * 100) / 100;
            const cashOut = Math.round(current.cashOut * 100) / 100;
            const netFlow = Math.round((cashIn - cashOut) * 100) / 100;
            runningBalance = Math.round((runningBalance + netFlow) * 100) / 100;

            // Day-over-Day (DoD) calculation
            const prevIn = prev ? Math.round(prev.cashIn * 100) / 100 : 0;
            const prevOut = prev ? Math.round(prev.cashOut * 100) / 100 : 0;
            const prevNet = prev ? Math.round((prev.cashIn - prev.cashOut) * 100) / 100 : 0;

            const inDiff = prev ? Math.round((cashIn - prevIn) * 100) / 100 : 0;
            const inPct = prev && prevIn > 0 ? Math.round(((cashIn - prevIn) / prevIn) * 1000) / 10 : (cashIn > 0 && !prev ? 100 : 0);

            const outDiff = prev ? Math.round((cashOut - prevOut) * 100) / 100 : 0;
            const outPct = prev && prevOut > 0 ? Math.round(((cashOut - prevOut) / prevOut) * 1000) / 10 : (cashOut > 0 && !prev ? 100 : 0);

            const netDiff = prev ? Math.round((netFlow - prevNet) * 100) / 100 : 0;

            dailyRecords.push({
                date: dStr,
                cashIn,
                cashOut,
                netFlow,
                runningBalance,
                // Day-over-Day comparisons
                inDiff,
                inPct,
                outDiff,
                outPct,
                netDiff,
                isHigherInflow: inDiff > 0,
                isLowerInflow: inDiff < 0,
                isHigherOutflow: outDiff > 0,
                isLowerOutflow: outDiff < 0,
                // Breakdowns
                inflowCount: current.inflowItems.length,
                outflowCount: current.outflowItems.length,
                inflowItems: current.inflowItems,
                outflowItems: current.outflowItems
            });
        }

        // Filter by date range if provided
        let filteredRecords = dailyRecords;
        if (startDate) {
            filteredRecords = filteredRecords.filter(r => r.date >= startDate);
        }
        if (endDate) {
            filteredRecords = filteredRecords.filter(r => r.date <= endDate);
        }

        // Summary Calculations
        const totalCashIn = filteredRecords.reduce((sum, r) => sum + r.cashIn, 0);
        const totalCashOut = filteredRecords.reduce((sum, r) => sum + r.cashOut, 0);
        const totalNetFlow = totalCashIn - totalCashOut;

        const maxInDay = filteredRecords.reduce((max, r) => (!max || r.cashIn > max.cashIn ? r : max), null);
        const maxOutDay = filteredRecords.reduce((max, r) => (!max || r.cashOut > max.cashOut ? r : max), null);

        // Find today & yesterday record
        const todayStr = normalizeDateStr(new Date());
        const todayRecord = dailyRecords.find(r => r.date === todayStr) || {
            date: todayStr,
            cashIn: 0,
            cashOut: 0,
            netFlow: 0,
            inDiff: 0,
            inPct: 0,
            outDiff: 0,
            outPct: 0,
            netDiff: 0
        };

        res.json({
            success: true,
            summary: {
                totalCashIn: Math.round(totalCashIn * 100) / 100,
                totalCashOut: Math.round(totalCashOut * 100) / 100,
                totalNetFlow: Math.round(totalNetFlow * 100) / 100,
                highestInflowDay: maxInDay ? { date: maxInDay.date, amount: maxInDay.cashIn } : null,
                highestOutflowDay: maxOutDay ? { date: maxOutDay.date, amount: maxOutDay.cashOut } : null,
                totalDaysRecorded: filteredRecords.length,
                todayStats: todayRecord
            },
            dailyRecords: filteredRecords.reverse() // Return newest first for trading feed
        });
    } catch (err) {
        console.error('Error fetching cashflow trader metrics:', err);
        res.status(500).json({ success: false, error: err.message, dailyRecords: [] });
    }
});

export default router;
