export const getRowWithDueDate = (row, contract) => {
    if (!row || row.dueDate || !contract?.inputDate) return row;
    const duration = String(contract.duration || '').toLowerCase();
    const matched = duration.match(/\d+/);
    const count = matched ? Math.max(1, Number(matched[0])) : 1;
    const isDays = duration.includes('day') || duration.includes('ថ្ងៃ') || duration.includes('d');
    const dueDate = new Date(`${contract.inputDate}T00:00:00`);
    if (isDays) {
        dueDate.setDate(dueDate.getDate() + count);
    } else {
        dueDate.setMonth(dueDate.getMonth() + Number(row.monthIndex || 1));
    }
    return { ...row, dueDate: dueDate.toISOString().split('T')[0] };
};

export const getAutomaticPenalty = (row, contract, rules = []) => {
    if (!row?.dueDate || ['Paid', 'PayOff', 'Settled'].includes(row.status)) {
        return Number(row?.penalty || 0) || 0;
    }

    // If penalty was manually waived or overridden by admin, always respect saved penalty
    if (row.isPenaltyWaived) {
        return Number(row.penalty || 0);
    }

    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return Number(row.penalty || 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lateDays = Math.max(0, Math.floor((today - dueDate) / 86400000));
    if (lateDays <= 0) return 0;

    const brand = String(contract?.brand || '').trim();
    const applicableRules = rules
        .filter(rule => !String(rule?.brand || '').trim() || String(rule.brand).trim() === brand)
        .filter(rule => lateDays >= Number(rule.afterDays || 0));
    if (applicableRules.length === 0) return Number(row.penalty || 0) || 0;

    const bestRule = applicableRules.reduce((winner, rule) => (
        !winner || Number(rule.afterDays || 0) > Number(winner.afterDays || 0) ? rule : winner
    ), null);
    const perDay = Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
    return lateDays * perDay;
};

export const getRowInterest = (row, contract) => {
    if (row) {
        if (row.interest !== undefined && row.interest !== null && row.interest !== '' && !isNaN(Number(row.interest))) {
            return Number(row.interest);
        }
        if (row.interestAmount !== undefined && row.interestAmount !== null && row.interestAmount !== '' && !isNaN(Number(row.interestAmount))) {
            return Number(row.interestAmount);
        }
    }
    if (!contract) return 0;

    const principal = Number(contract.amount || contract.loanAmount || contract.totalAmount || 0);
    const durationStr = String(contract.duration || '12 Months').toLowerCase();
    const matched = durationStr.match(/\d+/);
    const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ') || durationStr.includes('d');
    const count = matched ? Math.max(1, parseInt(matched[0], 10)) : 1;
    const months = !isDays && durationStr.includes('year') ? count * 12 : count;

    if (contract.monthlyInterest && !isNaN(Number(contract.monthlyInterest)) && Number(contract.monthlyInterest) > 0) {
        return Number(contract.monthlyInterest);
    }

    const interestStr = String(contract.interest || contract.interestType || '').trim();
    if (interestStr) {
        const rate = parseFloat(interestStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(rate) && rate > 0) {
            return interestStr.includes('%') ? principal * (rate / 100) : rate;
        }
    }

    if (contract.totalInterest && !isNaN(Number(contract.totalInterest)) && Number(contract.totalInterest) > 0) {
        return Number(contract.totalInterest) / (isDays ? 1 : months);
    }

    const monthly = Number(contract.monthlyPayment || 0);
    if (monthly > 0 && principal > 0) {
        const monthlyPrincipal = isDays ? principal : (principal / months);
        if (monthly > monthlyPrincipal) {
            return monthly - monthlyPrincipal;
        }
    }

    return 0;
};

export const getContractTotalInterest = (contract) => {
    if (!contract) return 0;
    if (contract.totalInterest && !isNaN(Number(contract.totalInterest)) && Number(contract.totalInterest) > 0) {
        return Number(contract.totalInterest);
    }
    const principal = Number(contract.amount || contract.loanAmount || contract.totalAmount || 0);
    const durationStr = String(contract.duration || '12 Months').toLowerCase();
    const matched = durationStr.match(/\d+/);
    const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ') || durationStr.includes('d');
    const count = matched ? Math.max(1, parseInt(matched[0], 10)) : 1;
    const months = !isDays && durationStr.includes('year') ? count * 12 : count;

    if (contract.monthlyInterest && !isNaN(Number(contract.monthlyInterest)) && Number(contract.monthlyInterest) > 0) {
        return Number(contract.monthlyInterest) * (isDays ? 1 : months);
    }

    const interestStr = String(contract.interest || contract.interestType || '').trim();
    if (interestStr) {
        const rate = parseFloat(interestStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(rate) && rate > 0) {
            return (interestStr.includes('%') ? principal * (rate / 100) : rate) * (isDays ? 1 : months);
        }
    }

    const monthly = Number(contract.monthlyPayment || 0);
    if (monthly > 0 && principal > 0) {
        const totalPay = isDays ? monthly : (monthly * months);
        if (totalPay > principal) {
            return totalPay - principal;
        }
    }

    return 0;
};