import express from 'express';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';

const router = express.Router();

// DASHBOARD STATS API
router.get('/stats', async (req, res) => {
    try {
        const { userBrand, userRole, username, isImmutable } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || isImmutable === true);

        let totalContracts, activatedContracts, applicationContracts, checkContracts,
            redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount, totalLoanAmount, totalCustomerReceived, totalBorrowers;

        let query = {};
        if (userBrand && !isMasterAdmin) {
            query.brand = userBrand;
        }

        if (isMongoConnected) {
            const allContracts = await queryAllDBs(Contract, (M) => M.find(query));
            totalContracts = allContracts.length;
            activatedContracts = allContracts.filter(c => c.status === 'Activated').length;
            applicationContracts = allContracts.filter(c => c.status === 'Application').length;
            checkContracts = allContracts.filter(c => c.status === 'Check').length;
            redeemContracts = allContracts.filter(c => c.status === 'Redeem').length;
            blacklistContracts = allContracts.filter(c => c.status === 'Blacklist').length;
            commentsContracts = allContracts.filter(c => c.status === 'Comments').length;
            lockedPhones = allContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
            unlockedPhones = totalContracts - lockedPhones;
            lockedWallpapers = allContracts.filter(c => c.lockWallpaperStatus === 'Locked').length;
            unlockedWallpapers = totalContracts - lockedWallpapers;

            // Payments
            const contractIds = allContracts.map(c => c.contractId);
            const allPayments = await queryAllDBs(Payment, (M) => {
                if (userBrand && !isMasterAdmin) {
                    return M.find({ contractId: { $in: contractIds } });
                }
                return M.find();
            });
            paymentCount = allPayments.length;
            totalRevenue = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // Financial metrics aggregated from Activated contracts
            const activatedList = allContracts.filter(c => c.status === 'Activated');
            totalLoanAmount = activatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            totalCustomerReceived = activatedList.reduce((sum, c) => sum + (Number(c.monthlyPayment) || 0), 0);
            totalBorrowers = activatedList.length;
        } else {
            // MEM_DB fallback
            const contracts = MEM_DB.contracts.filter(c => {
                if (userBrand && !isMasterAdmin) return c.brand === userBrand;
                return true;
            });
            totalContracts = contracts.length;
            activatedContracts = contracts.filter(c => c.status === 'Activated').length;
            applicationContracts = contracts.filter(c => c.status === 'Application').length;
            checkContracts = contracts.filter(c => c.status === 'Check').length;
            redeemContracts = contracts.filter(c => c.status === 'Redeem').length;
            blacklistContracts = contracts.filter(c => c.status === 'Blacklist').length;
            commentsContracts = contracts.filter(c => c.status === 'Comments').length;
            lockedPhones = contracts.filter(c => c.lockPhoneStatus === 'Locked').length;
            unlockedPhones = contracts.filter(c => c.lockPhoneStatus !== 'Locked').length;
            lockedWallpapers = contracts.filter(c => c.lockWallpaperStatus === 'Locked').length;
            unlockedWallpapers = contracts.filter(c => c.lockWallpaperStatus !== 'Locked').length;

            const contractIds = contracts.map(c => c.contractId);
            const filteredPayments = MEM_DB.payments.filter(p => {
                if (userBrand && !isMasterAdmin) return contractIds.includes(p.contractId);
                return true;
            });
            totalRevenue = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            paymentCount = filteredPayments.length;

            // Aggregate ONLY Activated contracts for financial metrics
            const activatedList = contracts.filter(c => c.status === 'Activated');
            totalLoanAmount = activatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            totalCustomerReceived = activatedList.reduce((sum, c) => sum + (Number(c.monthlyPayment) || 0), 0);
            totalBorrowers = activatedList.length;
        }

        const outstandingBalance = Math.max((totalLoanAmount || 0) - (totalRevenue || 0), 0);

        res.json({
            totalContracts, activatedContracts, applicationContracts,
            checkContracts, redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount,
            totalLoanAmount: totalLoanAmount || 0,
            totalCustomerReceived: totalCustomerReceived || 0,
            totalBorrowers: totalBorrowers || 0,
            outstandingBalance
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

