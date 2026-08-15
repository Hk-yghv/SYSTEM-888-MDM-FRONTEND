import express from 'express';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

// DASHBOARD STATS API
router.get('/stats', async (req, res) => {
    try {
        const { userBrand, userRole } = req.query;
        let totalContracts, activatedContracts, applicationContracts, checkContracts,
            redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount, totalLoanAmount;

        let query = {};
        if (userBrand && userRole !== 'Administrator') {
            query.brand = userBrand;
        }

        if (isMongoConnected) {
            [totalContracts, activatedContracts, applicationContracts, checkContracts,
                redeemContracts, blacklistContracts, commentsContracts,
                lockedPhones, lockedWallpapers] = await Promise.all([
                    Contract.countDocuments(query),
                    Contract.countDocuments({ ...query, status: 'Activated' }),
                    Contract.countDocuments({ ...query, status: 'Application' }),
                    Contract.countDocuments({ ...query, status: 'Check' }),
                    Contract.countDocuments({ ...query, status: 'Redeem' }),
                    Contract.countDocuments({ ...query, status: 'Blacklist' }),
                    Contract.countDocuments({ ...query, status: 'Comments' }),
                    Contract.countDocuments({ ...query, lockPhoneStatus: 'Locked' }),
                    Contract.countDocuments({ ...query, lockWallpaperStatus: 'Locked' })
                ]);
            unlockedPhones = totalContracts - lockedPhones;
            unlockedWallpapers = totalContracts - lockedWallpapers;

            let paymentQuery = {};
            if (userBrand && userRole !== 'Administrator') {
                const matchedContracts = await Contract.find({ brand: userBrand }).select('contractId');
                const contractIds = matchedContracts.map(c => c.contractId);
                paymentQuery.contractId = { $in: contractIds };
            }

            paymentCount = await Payment.countDocuments(paymentQuery);
            const revenueAgg = await Payment.aggregate([
                { $match: paymentQuery },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            totalRevenue = revenueAgg[0]?.total || 0;

            const activatedQuery = { ...query, status: 'Activated' };
            const loanAgg = await Contract.aggregate([
                { $match: activatedQuery },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            totalLoanAmount = loanAgg[0]?.total || 0;
        } else {
            const contracts = MEM_DB.contracts.filter(c => {
                if (userBrand && userRole !== 'Administrator') return c.brand === userBrand;
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
                if (userBrand && userRole !== 'Administrator') return contractIds.includes(p.contractId);
                return true;
            });
            totalRevenue = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            paymentCount = filteredPayments.length;
            const activatedContracts2 = contracts.filter(c => c.status === 'Activated');
            totalLoanAmount = activatedContracts2.reduce((sum, c) => sum + (Number(c.totalAmount) || Number(c.amount) || 0), 0);
        }

        res.json({
            totalContracts, activatedContracts, applicationContracts,
            checkContracts, redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount,
            totalLoanAmount: totalLoanAmount || 0,
            outstandingBalance: Math.max((totalLoanAmount || 0) - (totalRevenue || 0), 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
