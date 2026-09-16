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

            // Repayment metrics across active contracts
            const repaymentMetrics = calculateRepayments(allContracts.filter(c => c.status === 'Activated' || c.status === 'Application' || c.status === 'Check'));
            var totalRepaymentExpected = repaymentMetrics.totalRepaymentExpected;
            var totalScheduledRepayment = repaymentMetrics.totalScheduledRepayment;
            var totalPenaltyRepayment = repaymentMetrics.totalPenaltyRepayment;
            var totalInterest = repaymentMetrics.totalInterest;
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

            // Repayment metrics across active contracts
            const repaymentMetrics = calculateRepayments(contracts.filter(c => c.status === 'Activated' || c.status === 'Application' || c.status === 'Check'));
            var totalRepaymentExpected = repaymentMetrics.totalRepaymentExpected;
            var totalScheduledRepayment = repaymentMetrics.totalScheduledRepayment;
            var totalPenaltyRepayment = repaymentMetrics.totalPenaltyRepayment;
            var totalInterest = repaymentMetrics.totalInterest;
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
            outstandingBalance,
            totalRepaymentExpected: totalRepaymentExpected || 0,
            totalScheduledRepayment: totalScheduledRepayment || 0,
            totalPenaltyRepayment: totalPenaltyRepayment || 0,
            totalInterest: totalInterest || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function calculateContractInterest(c) {
    if (c.totalInterest && !isNaN(Number(c.totalInterest)) && Number(c.totalInterest) > 0) {
        return Number(c.totalInterest);
    }
    const durationStr = String(c.duration || '').toLowerCase();
    const matched = durationStr.match(/\d+/);
    const count = matched ? parseInt(matched[0], 10) : 1;
    const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ');
    const months = isDays ? Math.max(1, Math.ceil(count / 30)) : Math.max(1, count);

    if (c.monthlyInterest && !isNaN(Number(c.monthlyInterest)) && Number(c.monthlyInterest) > 0) {
        return Number(c.monthlyInterest) * months;
    }

    const interestStr = String(c.interest || c.interestType || '').trim();
    const principal = Number(c.amount || c.loanAmount || 0);

    if (interestStr.includes('%')) {
        const rate = parseFloat(interestStr.replace(/[^0-9.]/g, '')) || 0;
        const monthlyInterestUSD = principal * (rate / 100);
        return monthlyInterestUSD * months;
    }

    const numericInterest = parseFloat(interestStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(numericInterest) && numericInterest > 0) {
        return numericInterest * months;
    }

    if (Array.isArray(c.repaymentSchedule) && c.repaymentSchedule.length > 0) {
        const sumSchedInterest = c.repaymentSchedule.reduce((s, row) => s + (Number(row.interest || row.interestAmount || 0)), 0);
        if (sumSchedInterest > 0) return sumSchedInterest;
    }

    const monthly = Number(c.monthlyPayment) || 0;
    if (monthly > 0 && principal > 0) {
        const totalPay = isDays ? monthly : (monthly * months);
        if (totalPay > principal) {
            return totalPay - principal;
        }
    }

    return 0;
}

function calculateRepayments(contractsList) {
    let totalRepaymentExpected = 0;
    let totalScheduledRepayment = 0;
    let totalPenaltyRepayment = 0;
    let totalInterest = 0;

    contractsList.forEach(c => {
        totalInterest += calculateContractInterest(c);

        if (Array.isArray(c.repaymentSchedule) && c.repaymentSchedule.length > 0) {
            c.repaymentSchedule.forEach(row => {
                const scheduled = Number(row.scheduledAmount) || Number(row.amount) || Number(c.monthlyPayment) || 0;
                const penalty = Number(row.penalty) || 0;
                totalScheduledRepayment += scheduled;
                totalPenaltyRepayment += penalty;
                totalRepaymentExpected += (scheduled + penalty);
            });
        } else {
            const durationStr = String(c.duration || '').toLowerCase();
            const matched = durationStr.match(/\d+/);
            const count = matched ? parseInt(matched[0], 10) : 1;
            const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ');
            const monthly = Number(c.monthlyPayment) || 0;
            const scheduled = isDays
                ? (monthly || Number(c.amount) || 0)
                : (monthly > 0 ? (monthly * count) : (Number(c.amount) || 0));
            totalScheduledRepayment += scheduled;
            totalRepaymentExpected += scheduled;
        }
    });

    return { totalRepaymentExpected, totalScheduledRepayment, totalPenaltyRepayment, totalInterest };
}

export default router;

