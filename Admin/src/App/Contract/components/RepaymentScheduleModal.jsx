import { useLanguage } from '../../../context/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../context/AuthContext';
import { FaDollarSign, FaLock, FaCalendarAlt, FaCheckCircle, FaSave, FaEdit, FaUndo, FaFilePdf, FaCalculator, FaImage } from 'react-icons/fa';
import { MdClose, MdSwapHoriz, MdMoneyOff } from 'react-icons/md';
import { roundMoney, roundPrincipalToCents, toCurrencyCents } from '../../../utils/installmentRounding';
import ImageGalleryModal from '../../../components/ImageGalleryModal';
import ImageUrlListInput from '../../../components/ImageUrlListInput';
import { fileToBase64, ensureBase64List } from '../../../utils/mediaUtils';

const round2 = roundMoney;

const formatMoney = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const RepaymentScheduleModal = ({ open, setOpen, contract, mode = 'view_edit', defaultMonthIdx = null, onSaved, onRedeem }) => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();

    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin'
    );

    const [rows, setRows] = useState([]);
    const [latePenaltyRules, setLatePenaltyRules] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState(['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer']);
    const [submitting, setSubmitting] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [activeDropdownIdx, setActiveDropdownIdx] = useState(null);
    const rowRefs = useRef([]);
    const dropdownRef = useRef(null);

    // Image lightbox for viewing saved payment images in the schedule table
    const [lightboxImages, setLightboxImages] = useState([]);
    const [lightboxIdx, setLightboxIdx] = useState(0);

    // ── Payment Confirmation Modal State ──────────────────────────────────────
    const [payConfirm, setPayConfirm] = useState(null);
    const [payConfirmSubmitting, setPayConfirmSubmitting] = useState(false);
    // payConfirm = { idx, mode: 'Paid' | 'PayOff', amount, paidBy, description, imageItems: [{file, preview}] }

    // ── Wave Penalty Modal State ──────────────────────────────────────────────
    const [waivePenaltyModal, setWaivePenaltyModal] = useState(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (activeDropdownIdx === null) return;
        const handler = (e) => {
            const btn = document.getElementById(`pay-btn-${activeDropdownIdx}`);
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) && btn && !btn.contains(e.target)) {
                setActiveDropdownIdx(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [activeDropdownIdx]);

    // Fetch Payment Methods from controlsystem
    useEffect(() => {
        if (!open || !contract) return;
        const brand = contract.brand || user?.brand || '';
        fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                const pmCat = data?.droplists?.find(d => d.category === 'Payment Methods');
                if (pmCat && pmCat.items?.length) {
                    setPaymentMethods(pmCat.items);
                }
            })
            .catch(err => console.error('Fetch payment methods error:', err));
    }, [open, contract, API_BASE1, user?.brand]);

    const applyCalculateSchedule2 = () => {
        if (!contract) return;

        const principal = Number(contract.amount || contract.totalAmount || 0);
        const rateStr = String(contract.interest || contract.interestType || '14%');
        const ratePercent = parseFloat(rateStr.replace(/[^0-9.]/g, '')) || 0;

        const durationStr = String(contract.duration || '12 Months');
        const matched = durationStr.match(/\d+/);
        const months = matched ? Math.max(1, parseInt(matched[0], 10)) : 1;
        const isDays = durationStr.toLowerCase().includes('day') || durationStr.toLowerCase().includes('ថ្ងៃ') || durationStr.toLowerCase().includes('d');

        const baseDate = contract.inputDate ? new Date(`${contract.inputDate}T00:00:00`) : new Date();
        const originalDay = isNaN(baseDate.getTime()) ? new Date().getDate() : baseDate.getDate();

        if (isDays) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + months);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;
            const monthlyInterest = round2(principal * (ratePercent / 100));
            const totalDue = round2(principal + monthlyInterest);

            const newRows = [{
                monthIndex: 1,
                labelName: `${months} ថ្ងៃ (${months} Days)`,
                dueDate: dateStr,
                loanAmount: principal,
                interest: monthlyInterest,
                penalty: 0,
                scheduledAmount: totalDue,
                totalAmount: totalDue,
                paidAmount: 0,
                comment: '',
                paidDate: '',
                status: 'Pending'
            }];
            setRows(newRows);
        } else {
            const monthlyInterest = round2(principal * (ratePercent / 100));
            const roundedMonthlyPrincipalCents = roundPrincipalToCents(principal / months);
            let remainingPrincipalCents = toCurrencyCents(principal);

            const addMonthsSafe = (bDate, origDay, mOffset) => {
                const d = new Date(bDate);
                d.setDate(1);
                d.setMonth(d.getMonth() + mOffset);
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                d.setDate(Math.min(origDay, lastDay));
                return d;
            };

            const newRows = [];
            for (let i = 1; i <= months; i++) {
                const d = addMonthsSafe(baseDate, originalDay, i);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${day}`;
                const principalPaymentCents = i === months
                    ? remainingPrincipalCents
                    : Math.min(remainingPrincipalCents, roundedMonthlyPrincipalCents);
                remainingPrincipalCents -= principalPaymentCents;
                const monthlyTotalDue = round2(principalPaymentCents / 100 + monthlyInterest);

                newRows.push({
                    monthIndex: i,
                    labelName: `ខែទី ${i} (Month ${i})`,
                    dueDate: dateStr,
                    loanAmount: principal,
                    interest: monthlyInterest,
                    penalty: 0,
                    scheduledAmount: monthlyTotalDue,
                    totalAmount: monthlyTotalDue,
                    paidAmount: 0,
                    comment: '',
                    paidDate: '',
                    status: 'Pending'
                });
            }
            setRows(newRows);
        }
    };

    const autoSaveRows = async (updatedRows) => {
        if (!contract?._id) return;
        try {
            await fetch(`${API_BASE1}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repaymentSchedule: updatedRows,
                    modifiedByAdmin: isMasterAdmin
                })
            });
            if (onSaved) onSaved();
        } catch (err) {
            console.error('Auto-save repayment schedule error:', err);
        }
    };

    const handleDirectExportPdf = async () => {
        if (!contract || downloadingPdf) return;
        setDownloadingPdf(true);
        try {
            const id = contract._id || contract.contractId;
            const res = await fetch(`${API_BASE1}/contracts/${id}/pdf`);
            if (!res.ok) throw new Error(`Status: ${res.status}`);

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            const safeName = (contract.customerNameEn || contract.customerNameKh || 'Customer').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const safeId = (contract.contractId || contract.serialNumber || 'Contract').replace(/[^a-zA-Z0-9_\-]/g, '_');
            link.download = `Report_${safeId}_${safeName}.pdf`;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(link);
            }, 300);
        } catch (err) {
            console.error('Direct PDF export error:', err);
            alert('Download Failed: ' + err.message);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const computeLatePenalty = (row, rules = []) => {
        if (!row || !row.dueDate) return Number(row?.penalty || 0) || 0;
        if (row.status === 'Paid' || row.status === 'PayOff' || row.status === 'Settled') return Number(row.penalty || 0) || 0;

        const due = new Date(`${row.dueDate}T00:00:00`);
        if (Number.isNaN(due.getTime())) return Number(row.penalty || 0) || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((today - due) / 86400000));
        if (diffDays <= 0) return 0;

        const relevantRules = (Array.isArray(rules) ? rules : []).filter(rule => {
            const ruleBrand = String(rule?.brand || '').trim();
            const selectedBrand = String(contract?.brand || user?.brand || '').trim();
            return !ruleBrand || ruleBrand === selectedBrand;
        });

        if (relevantRules.length === 0) return 0;

        const applicable = relevantRules.filter(rule => diffDays >= Number(rule.afterDays || 0));
        if (applicable.length === 0) return 0;

        const bestRule = applicable.reduce((winner, rule) => {
            const ruleAmount = Number(rule.penaltyPerDay || rule.amount || rule.penalty || 0);
            if (!winner || Number(rule.afterDays || 0) > Number(winner.afterDays || 0)) return { ...rule, ruleAmount };
            return winner;
        }, null);

        return diffDays * Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
    };

    const computeLateDays = (row) => {
        if (!row || !row.dueDate) return 0;
        const due = new Date(`${row.dueDate}T00:00:00`);
        if (Number.isNaN(due.getTime())) return 0;

        let targetDate = new Date();
        if (row.paidDate && (row.status === 'Paid' || row.status === 'PayOff')) {
            const paid = new Date(`${row.paidDate}T00:00:00`);
            if (!Number.isNaN(paid.getTime())) {
                targetDate = paid;
            }
        }
        targetDate.setHours(0, 0, 0, 0);
        return Math.max(0, Math.floor((targetDate - due) / 86400000));
    };

    useEffect(() => {
        const fetchLatePenaltySetting = async () => {
            const brand = contract?.brand || user?.brand || '';
            try {
                const res = await fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`);
                if (res.ok) {
                    const data = await res.json();
                    const rules = Array.isArray(data?.late_penalty_rules) ? data.late_penalty_rules : [];
                    setLatePenaltyRules(rules);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch late penalty config:', err);
            }
            setLatePenaltyRules([]);
        };

        fetchLatePenaltySetting();
    }, [API_BASE1, contract?.brand, user?.brand]);

    // Parse duration string (e.g. "15 Days" -> { isDays: true, count: 15 }, "3 Months" -> { isDays: false, count: 3 })
    const parseDuration = (durationStr) => {
        if (!durationStr) return { isDays: false, count: 3 };
        const str = String(durationStr).toLowerCase().trim();
        const matched = str.match(/\d+/);
        const count = matched ? Math.max(1, parseInt(matched[0], 10)) : 3;

        const isDays = str.includes('day') || str.includes('ថ្ងៃ') || str.includes('d');
        return { isDays, count };
    };

    // Helper to generate default schedule rows
    const generateDefaultRows = (ctr) => {
        const { isDays, count } = parseDuration(ctr?.duration);
        const totalLoan = Number(ctr?.amount) || Number(ctr?.totalAmount) || 0;
        const startDate = ctr?.inputDate ? new Date(ctr.inputDate) : new Date();
        const rateStr = String(ctr?.interest || ctr?.interestType || '14%');
        const ratePercent = parseFloat(rateStr.replace(/[^0-9.]/g, '')) || 0;
        const defaultInterest = round2(totalLoan * (ratePercent / 100));

        if (isDays) {
            // For DAYS (e.g. 15 Days): generate ONLY 1 ROW with due date N days later!
            const d = new Date(startDate);
            d.setDate(d.getDate() + count);
            const dateStr = d.toISOString().split('T')[0];
            const totalDue = round2(totalLoan + defaultInterest);

            return [{
                monthIndex: 1,
                labelName: `${count} ថ្ងៃ (${count} Days)`,
                dueDate: dateStr,
                loanAmount: totalLoan,
                interest: defaultInterest,
                penalty: 0,
                scheduledAmount: totalDue,
                totalAmount: totalDue,
                paidAmount: 0,
                comment: '',
                paidDate: '',
                status: 'Pending'
            }];
        } else {
            // For MONTHS (e.g. 3 Months): generate count rows (1 row per month)
            const monthlyPrincipal = round2(totalLoan / count);
            const monthlyBase = Number(ctr?.monthlyPayment) || round2(monthlyPrincipal + defaultInterest);
            const generated = [];
            for (let i = 0; i < count; i++) {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i + 1);
                const dateStr = d.toISOString().split('T')[0];

                generated.push({
                    monthIndex: i + 1,
                    labelName: `ខែទី ${i + 1} (Month ${i + 1})`,
                    dueDate: dateStr,
                    loanAmount: totalLoan,
                    interest: defaultInterest,
                    penalty: 0,
                    scheduledAmount: monthlyBase,
                    totalAmount: monthlyBase,
                    paidAmount: 0,
                    comment: '',
                    paidDate: '',
                    status: 'Pending'
                });
            }
            return generated;
        }
    };

    useEffect(() => {
        if (!open || !contract) return;

        setLightboxImages([]);
        setLightboxIdx(0);

        const rateStr = String(contract?.interest || contract?.interestType || '14%');
        const ratePercent = parseFloat(rateStr.replace(/[^0-9.]/g, '')) || 0;
        const totalLoan = Number(contract?.amount || contract?.totalAmount || 0);

        const baseRows = Array.isArray(contract.repaymentSchedule) && contract.repaymentSchedule.length > 0
            ? contract.repaymentSchedule
            : generateDefaultRows(contract);

        const generatedRows = generateDefaultRows(contract);
        const normalizedRows = baseRows.map((row, index) => {
            const rowWithDueDate = row.dueDate
                ? row
                : { ...row, dueDate: generatedRows[index]?.dueDate || '' };
            const autoPenalty = computeLatePenalty(rowWithDueDate, latePenaltyRules);
            const scheduledAmount = round2(Number(row.scheduledAmount || 0));
            const total = round2(Number(row.totalAmount || 0)) || round2(scheduledAmount + Number(row.penalty || 0));
            const rowInterest = row.interest !== undefined && row.interest !== null && row.interest !== ''
                ? round2(Number(row.interest))
                : (generatedRows[index]?.interest ?? round2(totalLoan * (ratePercent / 100)));

            const effectivePenalty = row.isPenaltyWaived
                ? round2(Number(row.penalty || 0))
                : (autoPenalty > 0 ? autoPenalty : round2(Number(row.penalty || 0)));

            return {
                ...rowWithDueDate,
                interest: rowInterest,
                penalty: effectivePenalty,
                totalAmount: round2(scheduledAmount + effectivePenalty),
                isPenaltyWaived: Boolean(row.isPenaltyWaived)
            };
        });

        setRows(normalizedRows);
        setActiveDropdownIdx(null);

        if (defaultMonthIdx !== null && defaultMonthIdx >= 0) {
            setTimeout(() => {
                const el = rowRefs.current[defaultMonthIdx];
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    }, [open, contract, defaultMonthIdx, latePenaltyRules]);

    if (!open || !contract) return null;

    const isReadOnly = mode === 'read_only';
    const isSetupActivate = mode === 'setup_activate';

    // Find the first unpaid/non-payoff row index (active row for Dollar dropdown)
    const payOffTriggeredIdx = rows.findIndex(r => r.status === 'PayOff');
    const firstPendingIdx = rows.findIndex(r => r.status === 'Pending' || r.status === 'Saved');
    const activeRowIdx = payOffTriggeredIdx !== -1 ? -1 : (firstPendingIdx !== -1 ? firstPendingIdx : -1);

    const handleRowChange = (idx, field, val) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[idx], [field]: val };

            if (field === 'dueDate') {
                const autoPenalty = computeLatePenalty({ ...row, dueDate: val }, latePenaltyRules);
                row.penalty = autoPenalty;
            }

            if (field === 'penalty' || field === 'scheduledAmount' || field === 'dueDate') {
                const penaltyNum = Number(field === 'penalty' ? val : row.penalty) || 0;
                const schedNum = Number(field === 'scheduledAmount' ? val : row.scheduledAmount) || 0;
                row.totalAmount = round2(penaltyNum + schedNum);
            }

            updated[idx] = row;
            return updated;
        });
    };

    const handleSaveRowDraft = (idx) => {
        const updated = [...rows];
        if (updated[idx].status === 'Pending') {
            updated[idx].status = 'Saved';
        }
        setRows(updated);
        setActiveDropdownIdx(null);
        autoSaveRows(updated);
    };



    const openPayConfirm = (idx, mode) => {
        const row = rows[idx];
        const totalAmt = Number(row.penalty || 0) + Number(row.scheduledAmount || 0);
        setPayConfirm({
            idx,
            mode,
            amount: totalAmt,
            paidBy: paymentMethods[0] || 'Cash',
            description: '',
            imageItems: [],
            imageUrls: []
        });
        setActiveDropdownIdx(null);
    };

    const handlePayConfirmImagesAdd = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const newItems = files.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        setPayConfirm(prev => ({
            ...prev,
            imageItems: [...(prev.imageItems || []), ...newItems]
        }));
        // reset input so same file can be re-added
        e.target.value = '';
    };

    const handlePayConfirmRemoveImage = (imgIdx) => {
        setPayConfirm(prev => {
            const updated = [...(prev.imageItems || [])];
            if (updated[imgIdx]?.preview?.startsWith('blob:')) {
                URL.revokeObjectURL(updated[imgIdx].preview);
            }
            updated.splice(imgIdx, 1);
            return { ...prev, imageItems: updated };
        });
    };

    const uploadImagesToCloudinary = async (imageItems) => {
        const urls = [];
        for (const item of imageItems) {
            try {
                const b64 = await fileToBase64(item.file);
                if (b64) urls.push(b64);
            } catch (err) {
                console.error('Failed to convert image to base64:', err);
            }
        }
        return urls;
    };

    const handlePayConfirmSubmit = async () => {
        if (!payConfirm || payConfirmSubmitting) return;
        setPayConfirmSubmitting(true);
        try {
            const { idx, mode, amount, paidBy, description, imageItems, imageUrls } = payConfirm;
            const todayStr = new Date().toISOString().split('T')[0];

            // Upload local images and ensure existing URLs are converted to Base64
            const uploadedUrls = imageItems.length > 0
                ? await uploadImagesToCloudinary(imageItems)
                : [];
            const convertedExisting = (imageUrls && imageUrls.length > 0)
                ? await ensureBase64List(imageUrls)
                : [];
            const allImageUrls = [...new Set([...uploadedUrls, ...convertedExisting])];

            let updated;
            const paidRow = rows[idx];
            if (mode === 'Paid') {
                updated = [...rows];
                updated[idx] = {
                    ...updated[idx],
                    paidAmount: Number(amount),
                    paidDate: updated[idx].paidDate || todayStr,
                    comment: description,
                    paymentImages: allImageUrls,
                    status: 'Paid'
                };
            } else {
                updated = rows.map((r, i) => {
                    if (i === idx) {
                        return {
                            ...r,
                            paidAmount: Number(amount),
                            paidDate: r.paidDate || todayStr,
                            comment: description,
                            paymentImages: allImageUrls,
                            status: 'PayOff'
                        };
                    }
                    if (i > idx) return { ...r, status: 'Settled' };
                    return r;
                });
            }

            setRows(updated);
            setPayConfirm(null);
            await autoSaveRows(updated);

            // ── Save to Payment History ───────────────────────────────────────
            try {
                await fetch(`${API_BASE1}/payments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractId: contract.contractId || contract._id,
                        contractDbId: contract._id,
                        customerName: contract.customerNameEn || contract.customerNameKh || '',
                        customerNameKh: contract.customerNameKh || '',
                        model: contract.model || '',
                        serialNumber: contract.serialNumber || '',
                        brand: contract.brand || user?.brand || '',
                        paidDate: paidRow.paidDate || todayStr,
                        paidBy: paidBy || user?.username || user?.name || '',
                        amount: Number(amount),
                        description: description || '',
                        paymentImages: allImageUrls,
                        paymentType: mode,
                        monthLabel: paidRow.labelName || `Month ${paidRow.monthIndex}`,
                        monthIndex: paidRow.monthIndex,
                        dueDate: paidRow.dueDate || '',
                        penalty: Number(paidRow.penalty || 0),
                        scheduledAmount: Number(paidRow.scheduledAmount || 0),
                    })
                });
            } catch (payErr) {
                console.error('Failed to record payment history:', payErr);
            }
            // ─────────────────────────────────────────────────────────────────
        } finally {
            setPayConfirmSubmitting(false);
        }
    };

    const handleMarkPaid = (idx) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const updated = [...rows];
        const current = updated[idx];
        const paidVal = Number(current.paidAmount) || Number(current.totalAmount) || 0;

        updated[idx] = {
            ...current,
            paidAmount: round2(paidVal),
            paidDate: current.paidDate || todayStr,
            status: 'Paid'
        };
        setRows(updated);
        setActiveDropdownIdx(null);
        autoSaveRows(updated);
    };

    const handleMarkPayOff = (idx) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const updated = rows.map((r, i) => {
            if (i === idx) {
                const paidVal = Number(r.paidAmount) || Number(r.totalAmount) || 0;
                return {
                    ...r,
                    paidAmount: round2(paidVal),
                    paidDate: r.paidDate || todayStr,
                    status: 'PayOff'
                };
            }
            if (i > idx) {
                return {
                    ...r,
                    status: 'Settled'
                };
            }
            return r;
        });
        setRows(updated);
        setActiveDropdownIdx(null);
        autoSaveRows(updated);
    };

    const handleRevertRow = (idx) => {
        if (!isMasterAdmin) return;
        const updated = rows.map((r, i) => {
            if (i >= idx) {
                return {
                    ...r,
                    status: 'Pending',
                    paidDate: r.status === 'Paid' || r.status === 'PayOff' ? '' : r.paidDate
                };
            }
            return r;
        });
        setRows(updated);
        setActiveDropdownIdx(null);
        autoSaveRows(updated);
    };

    const applyLatePenaltyToAllRows = () => {
        setRows(prev => prev.map(row => {
            const penalty = computeLatePenalty(row, latePenaltyRules);
            const scheduled = Number(row.scheduledAmount || 0);
            return {
                ...row,
                penalty,
                totalAmount: round2(scheduled + penalty)
            };
        }));
    };

    const handleRedeem = async () => {
        if (!window.confirm(`តើអ្នកពិតជាប្រាកដថាចង់ប្តូរស្ថានភាពទៅជា Redeem សម្រាប់ "${contract?.customerNameEn || contract?.customerNameKh || ''}" មែនទេ?`)) return;

        if (onRedeem) {
            setOpen(false);
            onRedeem(contract);
            return;
        }

        setSubmitting(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await fetch(`${API_BASE1}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repaymentSchedule: rows,
                    status: 'Redeem',
                    redeemDate: todayStr,
                    modifiedByAdmin: isMasterAdmin
                })
            });
            if (res.ok) {
                setOpen(false);
                if (onSaved) onSaved();
            } else {
                alert('បរាជ័យក្នុងការ Redeem');
            }
        } catch (err) {
            console.error('Redeem error:', err);
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveSchedule = async (newContractStatus = null) => {
        setSubmitting(true);
        try {
            const targetStatus = newContractStatus || contract.status;
            const res = await fetch(`${API_BASE1}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repaymentSchedule: rows,
                    status: targetStatus,
                    modifiedByAdmin: isMasterAdmin
                })
            });

            if (res.ok) {
                setOpen(false);
                if (onSaved) onSaved();
            } else {
                alert('រក្សាទុកតារាងមិនបានសម្រេច (Failed to save schedule)');
            }
        } catch (err) {
            console.error('Save repayment schedule error:', err);
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>

            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[99999] p-2 select-none">
                <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-xs text-slate-800">

                    {/* Header */}
                    <div className="px-5 py-1 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                    <span>តារាងព័ត៌មានបង់ប្រាក់កម្ចី</span>
                                    <span className="px-2.5 py-0.5 text-indigo-700 bg-indigo-50 border border-indigo-300 rounded-full text-[10px] font-bold">
                                        {contract.contractId}
                                    </span>
                                    {isMasterAdmin && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[9px] font-bold uppercase">
                                            Master Admin Privilege
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    ភ្ញៀវ៖ <span className="text-emerald-700 font-bold">{contract.customerNameKh || contract.customerNameEn}</span> |
                                    ស្នើ៖ <span className="text-indigo-700 font-bold">{contract.duration || '12 Months'}</span> |
                                    ប្រាក់កម្ចីសរុប៖ <span className="text-emerald-700 font-mono font-bold">${formatMoney(contract.amount || contract.totalAmount || 0)}</span>
                                    {contract.interest && <span> | ការប្រាក់៖ <span className="text-violet-700 font-bold">{contract.interest}</span></span>}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {isSetupActivate && (
                                <button
                                    type="button"
                                    onClick={applyCalculateSchedule2}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                                    title={t('automatedFormulas')}
                                >
                                    <FaCalculator size={12} />
                                    <span>{t('calculateSchedule2')}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={downloadingPdf}
                                onClick={handleDirectExportPdf}
                                className={`px-3 py-1.5 ${downloadingPdf ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 cursor-pointer'} text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm`}
                                title="Download Customer Dossier & Repayment Schedule as PDF directly"
                            >
                                <FaFilePdf size={12} className={downloadingPdf ? 'animate-pulse' : ''} />
                                <span>{downloadingPdf ? 'Downloading...' : 'Export PDF'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={applyLatePenaltyToAllRows}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
                            >
                                Auto Penalty
                            </button>
                            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer transition-all flex items-center justify-center">
                                <MdClose size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Schedule Table Container */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto p-2 pb-32 min-h-[350px] space-y-3">
                        {/* Top Prominent Action & Info Banner (Only when in setup & activate mode) */}
                        {isSetupActivate && (
                            <div className="p-2 rounded-[5px] bg-indigo-50 border border-indigo-200 text-slate-800 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-2">
                                    <FaCalendarAlt className="text-indigo-600 text-lg flex-shrink-0" />
                                    <span>
                                        សូមកំណត់កាលបរិច្ឆេទថ្ងៃខែត្រូវបង់ និងទឹកប្រាក់សម្រាប់ខែនីមួយៗ ឬចុចប៊ូតុង <strong>t('calculateSchedule2')</strong> ដើម្បីបំពេញអូតូ រួចចុច <strong>"រក្សាទុក & Activate Contract"</strong>!
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={applyCalculateSchedule2}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[5px] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-md flex-shrink-0"
                                >
                                    <FaCalculator size={13} />
                                    <span>{t('calculateSchedule2')}</span>
                                </button>
                            </div>
                        )}

                        <table className="w-full text-left text-xs whitespace-nowrap border border-slate-200 rounded-[5px] overflow-hidden">
                            <thead className="bg-slate-50 text-indigo-950 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-1 text-center">ខែ/ថ្ងៃ</th>
                                    <th className="px-3 py-1">ថ្ងៃខែត្រូវបង់</th>
                                    <th className="px-3 py-1 font-mono text-emerald-700">Total loan amount</th>
                                    <th className="px-3 py-1 text-violet-700 font-mono font-bold">ការប្រាក់</th>
                                    <th className="px-3 py-1 text-center font-bold text-rose-600">ចំនួនថ្ងៃពិន័យ</th>
                                    <th className="px-3 py-1 text-amber-600 font-bold">ពិន័យ</th>
                                    <th className="px-3 py-1 text-sky-700 font-bold">ត្រូវបង់</th>
                                    <th className="px-3 py-1 text-emerald-700 font-extrabold">Total</th>
                                    <th className="px-3 py-1 text-emerald-800">ភ្ញៀវបានបង់</th>
                                    <th className="px-3 py-1">Comment (Note)</th>
                                    <th className="px-3 py-1 text-purple-700">កាលបរិច្ឆេទបានបង់</th>
                                    <th className="px-3 py-1 text-center text-indigo-600">រូបភាព</th>
                                    {!isReadOnly && !isSetupActivate && <th className="px-3 py-1 text-center">Action ($)</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                {rows.map((row, idx) => {
                                    // Normal user = not master admin and not in setup_activate mode
                                    const isNormalUser = !isMasterAdmin && !isSetupActivate;
                                    const isLocked = (!isMasterAdmin && !isSetupActivate && (row.status === 'Paid' || row.status === 'PayOff' || row.status === 'Settled')) || isReadOnly;
                                    const canEditDueDate = (isMasterAdmin || isSetupActivate) && !isReadOnly;
                                    // Normal user cannot edit scheduledAmount, interest, penalty — only masterAdmin or setup_activate can
                                    const canEditScheduled = (isMasterAdmin || isSetupActivate) && !isReadOnly;
                                    const isCurrentActive = idx === activeRowIdx && !isReadOnly;
                                    const isLastMonth = idx === rows.length - 1;

                                    const displayInterest = row.interest !== undefined && row.interest !== null && row.interest !== ''
                                        ? round2(row.interest)
                                        : round2(Number(row.loanAmount || contract.amount || 0) * (parseFloat(String(contract.interest || '14%').replace(/[^0-9.]/g, '')) || 0) / 100);

                                    return (
                                        <tr
                                            key={idx}
                                            ref={el => rowRefs.current[idx] = el}
                                            className={`transition-colors ${row.status === 'Paid' ? 'bg-emerald-50/50' : row.status === 'PayOff' ? 'bg-indigo-50/50' : isCurrentActive ? 'bg-amber-50/70 border-l-4 border-amber-500' : idx === defaultMonthIdx ? 'bg-indigo-50/50 border-l-4 border-indigo-400' : 'hover:bg-slate-50'}`}>
                                            <td className="px-3 py-2.5 text-center font-bold text-slate-900 font-mono">
                                                {row.labelName || `Month ${row.monthIndex}`}
                                            </td>

                                            {/* Due Date */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {!canEditDueDate ? (
                                                    <span className="font-bold text-slate-900">{row.dueDate || '—'}</span>
                                                ) : (
                                                    <input
                                                        type="date"
                                                        value={row.dueDate || ''}
                                                        onChange={(e) => handleRowChange(idx, 'dueDate', e.target.value)}
                                                        className="px-2 py-1 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg text-slate-900 text-xs outline-none font-mono shadow-2xs"
                                                    />
                                                )}
                                            </td>

                                            {/* Total Loan Amount */}
                                            <td className="px-3 py-2.5 font-mono font-bold text-emerald-700">
                                                ${formatMoney(row.loanAmount || 0)}
                                            </td>

                                            {/* Interest */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {(isLocked || isNormalUser) ? (
                                                    <span className="font-bold text-violet-700">
                                                        ${formatMoney(displayInterest)}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.interest !== undefined && row.interest !== null ? row.interest : ''}
                                                        onChange={(e) => handleRowChange(idx, 'interest', e.target.value)}
                                                        className="w-20 px-2 py-1 bg-white border border-slate-300 focus:border-violet-500 rounded-lg text-violet-700 font-bold font-mono text-xs outline-none shadow-2xs"
                                                        placeholder={String(displayInterest)}
                                                    />
                                                )}
                                            </td>

                                            {/* Late Days / ចំនួនថ្ងៃពិន័យ */}
                                            <td className="px-3 py-2.5 text-center font-mono font-bold">
                                                {(() => {
                                                    const lDays = computeLateDays(row);
                                                    return lDays > 0 ? (
                                                        <span className="text-rose-600 font-khmer px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                                                            {lDays} ថ្ងៃ
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-khmer">0 ថ្ងៃ</span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Penalty */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {(isLocked || isNormalUser) ? (
                                                    <span className="font-bold text-amber-600">${formatMoney(row.penalty || 0)}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.penalty}
                                                        onChange={(e) => handleRowChange(idx, 'penalty', e.target.value)}
                                                        className="w-20 px-2 py-1 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-amber-700 font-bold font-mono text-xs outline-none shadow-2xs"
                                                        placeholder="0"
                                                    />
                                                )}
                                            </td>

                                            {/* Scheduled Monthly Due */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {!canEditScheduled ? (
                                                    <span className="font-bold text-sky-700">${formatMoney(row.scheduledAmount || 0)}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.scheduledAmount}
                                                        onChange={(e) => handleRowChange(idx, 'scheduledAmount', e.target.value)}
                                                        className="w-24 px-2 py-1 bg-white border border-slate-300 focus:border-sky-500 rounded-lg text-sky-700 font-bold font-mono text-xs outline-none shadow-2xs"
                                                        placeholder="0"
                                                    />
                                                )}
                                            </td>

                                            {/* Total (Penalty + Scheduled) */}
                                            <td className="px-3 py-2.5 font-mono font-extrabold text-emerald-700">
                                                ${formatMoney(round2(Number(row.penalty || 0) + Number(row.scheduledAmount || 0)))}
                                            </td>

                                            {/* Paid Amount - normal user CAN edit this */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {isLocked ? (
                                                    <span className="font-bold text-emerald-700">${formatMoney(row.paidAmount || 0)}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.paidAmount}
                                                        onChange={(e) => handleRowChange(idx, 'paidAmount', e.target.value)}
                                                        className="w-24 px-2 py-1 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg text-emerald-700 font-bold font-mono text-xs outline-none shadow-2xs"
                                                        placeholder="0"
                                                    />
                                                )}
                                            </td>

                                            {/* Comment - normal user CAN edit this */}
                                            <td className="px-3 py-2.5">
                                                {isLocked ? (
                                                    <span className="text-slate-500 italic text-[11px]">{row.comment || '—'}</span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={row.comment || ''}
                                                        onChange={(e) => handleRowChange(idx, 'comment', e.target.value)}
                                                        placeholder="Note/comment..."
                                                        className="w-36 px-2 py-1 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg text-slate-800 text-xs outline-none shadow-2xs"
                                                    />
                                                )}
                                            </td>

                                            {/* Paid Date */}
                                            <td className="px-3 py-2.5 font-mono">
                                                {(!isMasterAdmin || isReadOnly) ? (
                                                    <span className="font-bold text-purple-700">{row.paidDate || '—'}</span>
                                                ) : (
                                                    <input
                                                        type="date"
                                                        value={row.paidDate || ''}
                                                        onChange={(e) => handleRowChange(idx, 'paidDate', e.target.value)}
                                                        className="px-2 py-1 bg-white border border-slate-300 focus:border-purple-500 rounded-lg text-purple-700 font-bold font-mono text-xs outline-none shadow-2xs"
                                                    />
                                                )}
                                            </td>

                                            {/* Payment Images column */}
                                            <td className="px-3 py-2.5 text-center">
                                                {(() => {
                                                    const imgs = Array.isArray(row.paymentImages)
                                                        ? row.paymentImages.filter(Boolean)
                                                        : [];
                                                    if (!imgs.length) return <span className="text-slate-300 text-[10px]">—</span>;
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setLightboxImages(imgs); setLightboxIdx(0); }}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                                            title="មើលរូបភាពភស្តុតាង"
                                                        >
                                                            <FaImage size={10} className="text-indigo-500" />
                                                            <span>{imgs.length > 1 ? `${imgs.length}` : 'មើល'}</span>
                                                        </button>
                                                    );
                                                })()}
                                            </td>

                                            {/* Action ($ Dropdown) — hidden in setup_activate mode */}
                                            {!isReadOnly && !isSetupActivate && (
                                                <td className="px-3 py-2.5 text-center">
                                                    {row.status === 'Settled' ? (
                                                        <span className="text-slate-400 italic text-[10px]">Settled</span>
                                                    ) : isCurrentActive || isMasterAdmin ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <div className="relative inline-block text-left">
                                                                <button
                                                                    id={`pay-btn-${idx}`}
                                                                    type="button"
                                                                    onClick={() => setActiveDropdownIdx(activeDropdownIdx === idx ? null : idx)}
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-transform hover:scale-110 cursor-pointer ${row.status === 'Paid' ? 'bg-emerald-600 text-white' : row.status === 'PayOff' ? 'bg-indigo-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-gray-950'}`}
                                                                    title="Payment Options"
                                                                >
                                                                    <FaDollarSign />
                                                                </button>

                                                                {activeDropdownIdx === idx && createPortal(
                                                                    <div
                                                                        ref={dropdownRef}
                                                                        className="fixed w-44 bg-white border border-slate-200 rounded-[5px] shadow-2xl overflow-hidden"
                                                                        style={(() => {
                                                                            const btn = document.getElementById(`pay-btn-${idx}`);
                                                                            if (!btn) return { top: 0, left: 0, zIndex: 999999 };
                                                                            const r = btn.getBoundingClientRect();
                                                                            const spaceBelow = window.innerHeight - r.bottom;
                                                                            const left = Math.min(r.left, window.innerWidth - 184);
                                                                            return spaceBelow < 200
                                                                                ? { bottom: `${window.innerHeight - r.top + 4}px`, left: `${left}px`, zIndex: 999999 }
                                                                                : { top: `${r.bottom + 6}px`, left: `${left}px`, zIndex: 999999 };
                                                                        })()}
                                                                    >
                                                                        <div className="px-2.5 py-1 bg-indigo-50 border-b border-slate-200 text-[9px] font-bold text-indigo-700 uppercase">
                                                                            Payment Options
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSaveRowDraft(idx)}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-emerald-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            <FaSave size={11} /> Save
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { handleRowChange(idx, 'status', 'Pending'); setActiveDropdownIdx(null); }}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-sky-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            <FaEdit size={11} /> Edit
                                                                        </button>

                                                                        {!isLastMonth && row.status !== 'PayOff' && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openPayConfirm(idx, 'Paid')}
                                                                                className="w-full px-3 py-1.5 text-left text-xs font-bold text-amber-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer border-t border-slate-100"
                                                                            >
                                                                                <FaCheckCircle size={11} /> Paid
                                                                            </button>
                                                                        )}

                                                                        {/* Redeem button — only for last month instead of Paid */}
                                                                        {isLastMonth && row.status !== 'PayOff' && row.status !== 'Paid' && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={handleRedeem}
                                                                                className="w-full px-3 py-1.5 text-left text-xs font-bold text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 cursor-pointer border-t border-slate-100"
                                                                            >
                                                                                <MdSwapHoriz size={13} /> Redeem
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openPayConfirm(idx, 'PayOff')}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-indigo-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer border-t border-slate-100"
                                                                        >
                                                                            <FaLock size={11} /> Pay Off
                                                                        </button>

                                                                        {isMasterAdmin && (row.status === 'Paid' || row.status === 'PayOff') && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRevertRow(idx)}
                                                                                className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer border-t border-slate-100"
                                                                            >
                                                                                <FaUndo size={11} /> Revert / Unlock
                                                                            </button>
                                                                        )}
                                                                    </div>,
                                                                    document.body
                                                                )}
                                                            </div>

                                                            {/* Wave Penalty Button - only visible when customer is late (>= 1 day) */}
                                                            {computeLateDays(row) >= 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const lDays = computeLateDays(row);
                                                                        setWaivePenaltyModal({
                                                                            idx,
                                                                            monthLabel: row.labelName || `Month ${row.monthIndex || idx + 1}`,
                                                                            dueDate: row.dueDate || '',
                                                                            lateDays: lDays,
                                                                            currentPenalty: Number(row.penalty || 0),
                                                                            newPenalty: Number(row.penalty || 0)
                                                                        });
                                                                    }}
                                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                                                                    title="Wave Penalty (កំណត់តម្លៃពិន័យ)"
                                                                >
                                                                    <MdMoneyOff size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[10px]">&#8212;</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Buttons */}
                    <div className="px-5 py-1 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all"
                        >
                            {t('close')}
                        </button>

                        {/* Redeem button ONLY visible if payoff exists and NOT in setup_activate */}
                        {!isSetupActivate && mode !== 'setup_activate' && (rows.some(r => r.status === 'PayOff') || contract?.status === 'PayOff' || contract?.status === 'Redeem') && (
                            <button
                                type="button"
                                onClick={handleRedeem}
                                disabled={submitting}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold shadow-md shadow-purple-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
                            >
                                <MdSwapHoriz size={16} />
                                <span>Redeem</span>
                            </button>
                        )}

                        {/* Save Schedule button ONLY visible for master admin or in setup mode */}
                        {!isReadOnly && (isMasterAdmin || isSetupActivate) && (
                            <button
                                type="button"
                                onClick={() => handleSaveSchedule(isSetupActivate ? 'Activated' : null)}
                                disabled={submitting}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
                            >
                                <FaSave size={14} />
                                <span>
                                    {submitting
                                        ? 'កំពុងរក្សាទុក...'
                                        : isSetupActivate
                                            ? 'រក្សាទុក & Activate Contract'
                                            : t('saveSchedule')}
                                </span>
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* ── Image Lightbox (payment proof viewer in schedule table) ────── */}
            {lightboxImages.length > 0 && (
                <ImageGalleryModal
                    images={lightboxImages}
                    index={lightboxIdx}
                    onIndexChange={setLightboxIdx}
                    onClose={() => setLightboxImages([])}
                    title="Payment proof"
                />
            )}

            {/* ── Payment Confirmation Modal ──────────────────────────────────── */}
            {payConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999999] p-2">
                    <div className="bg-white border border-slate-200 rounded-[5px] shadow-2xl w-full max-w-md flex flex-col max-h-[92vh] overflow-hidden">

                        {/* Header */}
                        <div className={`px-5 py-4 flex items-center justify-between flex-shrink-0 ${payConfirm.mode === 'PayOff'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                            : 'bg-gradient-to-r from-amber-500 to-amber-400'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-[5px] bg-white/20 flex items-center justify-center text-white">
                                    {payConfirm.mode === 'PayOff' ? <FaLock size={15} /> : <FaCheckCircle size={15} />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">
                                        {payConfirm.mode === 'PayOff' ? [t('payOff')] : t('markAsPaid')}
                                    </h4>
                                    <p className="text-[11px] text-white/70">{rows[payConfirm.idx]?.labelName || `ខែទី ${payConfirm.idx + 1}`}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPayConfirm(null)}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-colors"
                            >
                                <MdClose size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">

                            {/* Amount */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('amountPaid')} ($)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={payConfirm.amount}
                                    onChange={e => setPayConfirm(prev => ({ ...prev, amount: e.target.value }))}
                                    className="w-full h-10 px-3 bg-emerald-50 border border-emerald-200 focus:border-emerald-500 rounded-[5px] text-emerald-700 font-bold font-mono text-base outline-none shadow-sm"
                                />
                            </div>

                            {/* Paid By — Payment Method Dropdown */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('paidByMethod')}</label>
                                <select
                                    value={payConfirm.paidBy || ''}
                                    onChange={e => setPayConfirm(prev => ({ ...prev, paidBy: e.target.value }))}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 focus:border-indigo-400 rounded-[5px] text-slate-800 text-xs font-semibold outline-none shadow-sm cursor-pointer"
                                >
                                    <option value="">-- ជ្រើសរើសវិធីបង់ប្រាក់ --</option>
                                    {paymentMethods.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('description')}</label>
                                <input
                                    type="text"
                                    value={payConfirm.description}
                                    onChange={e => setPayConfirm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Comment or transaction note..."
                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-[5px] text-slate-800 text-xs outline-none shadow-sm"
                                />
                            </div>

                            <ImageUrlListInput
                                onAddUrls={urls => setPayConfirm(prev => ({
                                    ...prev,
                                    imageUrls: [...new Set([...(prev.imageUrls || []), ...urls])]
                                }))}
                            />
                            {payConfirm.imageUrls?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {payConfirm.imageUrls.map((url, index) => (
                                        <button
                                            key={`${url}-${index}`}
                                            type="button"
                                            onClick={() => setPayConfirm(prev => ({
                                                ...prev,
                                                imageUrls: prev.imageUrls.filter((_, urlIndex) => urlIndex !== index)
                                            }))}
                                            className="max-w-full truncate rounded bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700"
                                            title={`${url} (click to remove)`}
                                        >
                                            {url}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Multi-Image Upload */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t('receiptImages')}</label>
                                    <span className="text-[10px] text-slate-400">{payConfirm.imageItems?.length || 0} files</span>
                                </div>

                                {/* Upload button */}
                                <label className="flex items-center gap-2.5 h-10 px-3 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-[5px] cursor-pointer transition-all group">
                                    <div className="w-5 h-5 rounded-lg bg-slate-200 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                                        <FaDollarSign size={10} className="text-slate-500 group-hover:text-indigo-600" />
                                    </div>
                                    <span className="text-xs text-slate-400 group-hover:text-indigo-600 transition-colors">+ {t('multipleImagesAllowed')}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handlePayConfirmImagesAdd}
                                    />
                                </label>

                                {/* Image Preview Grid */}
                                {payConfirm.imageItems?.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {payConfirm.imageItems.map((item, imgIdx) => (
                                            <div key={imgIdx} className="relative group rounded-[5px] overflow-hidden bg-slate-100 aspect-square border border-slate-200">
                                                <img
                                                    src={item.preview}
                                                    alt={`receipt-${imgIdx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handlePayConfirmRemoveImage(imgIdx)}
                                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                                                >
                                                    ✕
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-0.5 truncate px-1">
                                                    {item.file.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Upload note */}
                            {payConfirm.imageItems?.length > 0 && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    🔄 រូបភាពនឹងត្រូវបំលែងទៅជា Base64 នៅពេល Submit
                                </p>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setPayConfirm(null)}
                                disabled={payConfirmSubmitting}
                                className="flex-1 h-10 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-[5px] text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handlePayConfirmSubmit}
                                disabled={payConfirmSubmitting}
                                className={`flex-1 h-10 text-white rounded-[5px] text-xs font-bold cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 ${payConfirm.mode === 'PayOff'
                                    ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                                    : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'
                                    }`}
                            >
                                {payConfirmSubmitting ? (
                                    <span className="animate-spin text-base">⏳</span>
                                ) : (
                                    <>{payConfirm.mode === 'PayOff' ? <FaLock size={11} /> : <FaCheckCircle size={11} />}
                                        <span>Submit {payConfirm.mode}</span></>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Wave Penalty Modal */}
            {waivePenaltyModal && (
                <div className="fixed inset-0 z-[1000002] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-200">
                                    <MdMoneyOff size={16} />
                                </span>
                                <span>Wave Penalty</span>
                            </h3>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 text-xs border border-slate-200">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">ខែ/ថ្ងៃ៖</span>
                                <span className="font-bold text-slate-800">{waivePenaltyModal.monthLabel}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">ថ្ងៃត្រូវបង់៖</span>
                                <span className="font-mono font-bold text-slate-800">{waivePenaltyModal.dueDate || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">ចំនួនថ្ងៃពិន័យ៖</span>
                                <span className="font-khmer font-bold text-rose-600">{waivePenaltyModal.lateDays} ថ្ងៃ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">ពិន័យបច្ចុប្បន្ន៖</span>
                                <span className="font-mono font-bold text-amber-600">${formatMoney(waivePenaltyModal.currentPenalty)}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                តម្លៃពិន័យថ្មី ($) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={waivePenaltyModal.newPenalty}
                                    onChange={(e) => setWaivePenaltyModal(prev => ({
                                        ...prev,
                                        newPenalty: e.target.value
                                    }))}
                                    placeholder="0.00"
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-lg text-sm font-mono font-bold text-slate-900 outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setWaivePenaltyModal(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const targetIdx = waivePenaltyModal.idx;
                                    const penaltyVal = Math.max(0, Number(waivePenaltyModal.newPenalty) || 0);
                                    const updated = [...rows];
                                    const targetRow = updated[targetIdx];
                                    const schedAmount = Number(targetRow.scheduledAmount || 0);

                                    updated[targetIdx] = {
                                        ...targetRow,
                                        penalty: penaltyVal,
                                        totalAmount: round2(penaltyVal + schedAmount),
                                        isPenaltyWaived: true
                                    };

                                    setRows(updated);
                                    setWaivePenaltyModal(null);
                                    await autoSaveRows(updated);
                                }}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-600/30 cursor-pointer transition-colors"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RepaymentScheduleModal;
