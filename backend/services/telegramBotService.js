import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ControlSystem from '../models/ControlSystem.js';
import Contract from '../models/Contract.js';
import CalculateSchedule from '../models/CalculateSchedule.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { generateCustomerPdf } from '../utils/customerPdfGenerator.js';
import { broadcastCalculateUpdate } from '../routes/calculateScheduleRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Font paths for Pawn Schedule PDF ────────────────────────────────────────
const FONT_DIR = path.resolve(__dirname, '../fonts');
const khmerFontPath = fs.existsSync(path.join(FONT_DIR, 'khmer_os.ttf'))
    ? path.join(FONT_DIR, 'khmer_os.ttf')
    : path.join(FONT_DIR, 'noto_khmer.ttf');
const arialFontPath = path.join(FONT_DIR, 'arial.ttf');
const arialBoldPath = path.join(FONT_DIR, 'arialbd.ttf');

// In-memory sessions mapped by Telegram chatId
// Structure: { [chatId]: { step, brand, authenticated, username, searchType, pendingContracts } }
const sessions = new Map();

/**
 * Fetch all unique brand names in the system
 */
async function getAllSystemBrands() {
    const foundBrands = new Set();

    try {
        if (isMongoConnected) {
            // 1. ControlSystem droplists & brand entries
            const controlConfigs = await queryAllDBs(ControlSystem, (M) => M.find({}));
            controlConfigs.forEach(c => {
                if (c.brand && typeof c.brand === 'string') {
                    const trimmed = c.brand.trim();
                    if (trimmed && trimmed !== 'Global') foundBrands.add(trimmed);
                }
                if (c.key === 'droplists' && Array.isArray(c.value)) {
                    const bCat = c.value.find(d => d.category === 'Brands');
                    if (bCat && Array.isArray(bCat.items)) {
                        bCat.items.forEach(b => b && typeof b === 'string' && foundBrands.add(b.trim()));
                    }
                }
            });

            // 2. Users
            const users = await queryAllDBs(User, (M) => M.find({}));
            users.forEach(u => {
                if (u.brand && typeof u.brand === 'string') {
                    const trimmed = u.brand.trim();
                    if (trimmed && trimmed !== 'Global') foundBrands.add(trimmed);
                }
            });

            // 3. Contracts
            const contracts = await queryAllDBs(Contract, (M) => M.find({}));
            contracts.forEach(c => {
                if (c.brand && typeof c.brand === 'string') {
                    const trimmed = c.brand.trim();
                    if (trimmed && trimmed !== 'Global') foundBrands.add(trimmed);
                }
            });
        }

        // MEM_DB Fallback
        if (MEM_DB.controlSystem?.droplists) {
            const bCat = MEM_DB.controlSystem.droplists.find(d => d.category === 'Brands');
            if (bCat && Array.isArray(bCat.items)) {
                bCat.items.forEach(b => b && typeof b === 'string' && foundBrands.add(b.trim()));
            }
        }
        if (MEM_DB.controlSystems && Array.isArray(MEM_DB.controlSystems)) {
            MEM_DB.controlSystems.forEach(cs => cs.brand && cs.brand !== 'Global' && foundBrands.add(cs.brand.trim()));
        }
        if (MEM_DB.users) MEM_DB.users.forEach(u => u.brand && u.brand !== 'Global' && foundBrands.add(u.brand.trim()));
        if (MEM_DB.contracts) MEM_DB.contracts.forEach(c => c.brand && c.brand !== 'Global' && foundBrands.add(c.brand.trim()));

    } catch (err) {
        console.error('[TelegramBot] Error fetching system brands:', err.message);
    }

    const brandList = Array.from(foundBrands).filter(Boolean);
    if (brandList.length === 0) {
        brandList.push('888MDM');
    }
    return brandList;
}

const SEARCH_OPTIONS = [
    { type: 'phone', labelKh: '📱 លេខទូរស័ព្ទ (Phone)', labelEn: 'Phone Number' },
    { type: 'serialNumber', labelKh: '🔢 លេខសម្គាល់ម៉ាស៊ីន (Serial)', labelEn: 'Serial Number' },
    { type: 'imei', labelKh: '🆔 លេខ IMEI / MEID', labelEn: 'IMEI / MEID' },
    { type: 'idCardNumber', labelKh: '🪪 អត្តសញ្ញាណប័ណ្ណ (ID Card)', labelEn: 'ID Card' },
    { type: 'customerNameKh', labelKh: '🇰🇭 ឈ្មោះជាភាសាខ្មែរ (Name KH)', labelEn: 'Name Khmer' },
    { type: 'customerNameEn', labelKh: '🇬🇧 ឈ្មោះជាអង់គ្លេស (Name EN)', labelEn: 'Name English' },
    { type: 'contractId', labelKh: '📋 លេខកុងត្រា (Contract ID)', labelEn: 'Contract ID' }
];

// ─── Pawn Contract Helpers ────────────────────────────────────────────────────

/** Known variant suffixes (longest first to avoid partial matches) */
const VARIANT_SUFFIXES = ['Pro Max', 'Pro Plus', 'Ultra', 'Plus', 'Pro', 'Max', 'Lite', 'FE', 'Mini', 'SE', 'XS Max', 'XS', 'XR'];

/**
 * Group raw asset list into { baseName: [fullName, ...] }
 * e.g. ["iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max"] →
 *   { "iPhone 12": ["iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max"] }
 */
function groupAssetModels(assetList) {
    const groups = {};
    (assetList || []).forEach(item => {
        const trimmed = item.trim();
        if (!trimmed) return;
        let baseName = trimmed;
        for (const suffix of VARIANT_SUFFIXES) {
            const re = new RegExp(`\\s+${suffix}\\s*$`, 'i');
            if (re.test(trimmed)) {
                baseName = trimmed.replace(re, '').trim();
                break;
            }
        }
        if (!groups[baseName]) groups[baseName] = [];
        if (!groups[baseName].includes(trimmed)) groups[baseName].push(trimmed);
    });
    return groups;
}

/** Fetch asset types list from ControlSystem for a given brand */
async function fetchAssetTypes(brand) {
    try {
        if (isMongoConnected) {
            const urls = brand ? [brand, ''] : [''];
            for (const b of urls) {
                const docs = await queryAllDBs(ControlSystem, M => M.find(b ? { brand: b, key: 'droplists' } : { $or: [{ brand: '' }, { brand: null }], key: 'droplists' }));
                for (const doc of docs) {
                    if (!Array.isArray(doc.value)) continue;
                    const pawnCat = doc.value.find(d => d.category === 'Pawn Asset Types' || d.category === 'ប្រភេទទ្រព្យបញ្ចាំ');
                    const deviceCat = doc.value.find(d => d.category === 'Device Models');
                    const cat = pawnCat || deviceCat;
                    if (cat && Array.isArray(cat.items) && cat.items.length > 0) return cat.items;
                }
            }
        }
    } catch (e) { console.error('[TelegramBot] fetchAssetTypes error:', e.message); }
    return [];
}

/** Get next contract number from CalculateSchedule records */
async function getNextContractNumber(brand) {
    try {
        let records = [];
        if (isMongoConnected) {
            records = await queryAllDBs(CalculateSchedule, M => M.find({ contractNumber: { $regex: /^\d+$/ } }).sort({ createdAt: -1 }).limit(50));
        } else {
            records = (MEM_DB.calculateSchedules || []);
        }
        const nums = records
            .map(r => r.contractNumber)
            .filter(n => n && /^\d+$/.test(n.trim()))
            .map(n => parseInt(n.trim(), 10));
        if (nums.length === 0) return '001';
        return String(Math.max(...nums) + 1).padStart(3, '0');
    } catch (e) { return '001'; }
}

/** Calculate pawn schedule */
function calcPawnSchedule(principal, ratePercent, months, startDateStr, roundingMode = 'up') {
    const monthlyInterest = Math.round((principal * (ratePercent / 100) + 1e-8) * 100) / 100;
    const principalCents = Math.round((principal + 1e-8) * 100);
    const monthlyPrincipalCents = (principal / months) * 100;
    const roundedMonthlyPrincipalCents = roundingMode === 'up'
        ? Math.ceil(monthlyPrincipalCents - 1e-8)
        : Math.floor(monthlyPrincipalCents + 1e-8);
    const baseDate = new Date(`${startDateStr}T00:00:00`);
    const origDay = baseDate.getDate();

    const addMonthsSafe = (d, m) => {
        const nd = new Date(d);
        nd.setDate(1);
        nd.setMonth(nd.getMonth() + m);
        const last = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
        nd.setDate(Math.min(origDay, last));
        return nd;
    };
    const fmtDate = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    let remainingCents = principalCents;
    const schedule = [];
    for (let i = 1; i <= months; i++) {
        const due = addMonthsSafe(baseDate, i);
        const principalPaymentCents = i === months
            ? remainingCents
            : Math.min(remainingCents, roundedMonthlyPrincipalCents);
        const principalPayment = principalPaymentCents / 100;
        remainingCents -= principalPaymentCents;
        const totalDueMonth = Math.round((principalPayment + monthlyInterest + 1e-8) * 100) / 100;
        schedule.push({
            no: i,
            dueDate: fmtDate(due),
            monthlyPrincipal: principalPayment,
            totalDueMonth,
            interestAndFee: monthlyInterest,
            remainingBalance: Math.max(0, remainingCents / 100)
        });
    }
    return {
        monthlyInterest,
        totalInterest: Math.round((monthlyInterest * months + 1e-8) * 100) / 100,
        monthlyTotal: schedule[0]?.totalDueMonth || 0,
        totalRepayment: Math.round((schedule.reduce((sum, row) => sum + row.totalDueMonth, 0) + 1e-8) * 100) / 100,
        schedule
    };
}

let canvasFontsRegistered = false;
function registerCanvasFonts() {
    if (canvasFontsRegistered) return;
    try {
        if (fs.existsSync(khmerFontPath)) {
            GlobalFonts.registerFromPath(khmerFontPath, 'KhmerOS');
        }
        const fontKhmer = path.join(FONT_DIR, 'font_khmer.ttf');
        if (fs.existsSync(fontKhmer)) {
            GlobalFonts.registerFromPath(fontKhmer, 'KhmerMoul');
        }
        if (fs.existsSync(arialFontPath)) {
            GlobalFonts.registerFromPath(arialFontPath, 'Arial');
        }
        if (fs.existsSync(arialBoldPath)) {
            GlobalFonts.registerFromPath(arialBoldPath, 'ArialBold');
        }
        canvasFontsRegistered = true;
    } catch (err) {
        console.warn('[TelegramBot] Canvas font register error:', err);
    }
}

/** Generate pawn schedule PNG Image Buffer — matches CalculateSchedule2 print area exactly */
async function generatePawnScheduleImage(data) {
    registerCanvasFonts();

    const WD_KH = ['ថ្ងៃអាទិត្យ', 'ថ្ងៃចន្ទ', 'ថ្ងៃអង្គារ', 'ថ្ងៃពុធ', 'ថ្ងៃព្រហស្បតិ៍', 'ថ្ងៃសុក្រ', 'ថ្ងៃសៅរ៍'];
    const fmtDateWD = (s) => {
        if (!s) return '—';
        const [yr, mo, dy] = s.split('-');
        const d = new Date(`${yr}-${mo}-${dy}T00:00:00`);
        return `${dy}-${mo}-${yr} ${WD_KH[d.getDay()] || ''}`;
    };
    const fmt2 = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (s) => {
        if (!s) return '—';
        const [yr, mo, dy] = s.split('-');
        return `${dy}-${mo}-${yr}`;
    };

    const width = 850;
    const headerHeight = 220;
    const rowHeight = 32;
    const tableHeaderHeight = 35;
    const rowsCount = Array.isArray(data.schedule) ? data.schedule.length : 1;
    const tableHeight = tableHeaderHeight + (rowsCount * rowHeight);
    const footerHeight = 220;
    const height = headerHeight + tableHeight + footerHeight;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. KH Royal Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px KhmerMoul, KhmerOS, sans-serif';
    ctx.fillText('ព្រះរាជាណាចក្រកម្ពុជា', width / 2, 45);

    ctx.font = 'bold 15px KhmerMoul, KhmerOS, sans-serif';
    ctx.fillText('ជាតិ សាសនា ព្រះមហាក្សត្រ', width / 2, 72);

    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('❁ ❁ ✿ ❁ ❁', width / 2, 98);

    // Divider line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 70, 108);
    ctx.lineTo(width / 2 + 70, 108);
    ctx.stroke();

    // Title: កាលវិភាគសងប្រាក់
    ctx.fillStyle = '#2750F5';
    ctx.font = 'bold 18px KhmerMoul, KhmerOS, sans-serif';
    ctx.fillText('កាលវិភាគសងប្រាក់', width / 2, 136);

    // 3. Meta Information (2 columns)
    const metaY = 165;
    const leftX = 50;
    const rightX = 460;
    const metaLineH = 22;

    ctx.textAlign = 'left';

    // Left Column
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('ថ្ងៃខែឆ្នាំដាក់បញ្ចាំ:', leftX, metaY);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px KhmerOS, sans-serif';
    ctx.fillText(fmtDate(data.startDate), leftX + 170, metaY);

    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('ចំនួនទឹកប្រាក់បញ្ចាំ:', leftX, metaY + metaLineH);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px ArialBold, Arial, KhmerOS, sans-serif';
    ctx.fillText(`$${fmt2(data.principal)} USD`, leftX + 170, metaY + metaLineH);

    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('រយៈពេល (ចំនួនខែ):', leftX, metaY + metaLineH * 2);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px ArialBold, Arial, KhmerOS, sans-serif';
    ctx.fillText(`${data.months} ខែ`, leftX + 170, metaY + metaLineH * 2);

    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('ការប្រាក់ នឹង សេវ៉ាជួល:', leftX, metaY + metaLineH * 3);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px ArialBold, Arial, KhmerOS, sans-serif';
    ctx.fillText(`$${fmt2(data.monthlyInterest)}`, leftX + 170, metaY + metaLineH * 3);

    // Right Column
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('ឈ្មោះអតិថិជន:', rightX, metaY);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px KhmerOS, sans-serif';
    ctx.fillText(data.customerName || '—', rightX + 140, metaY);

    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('ប្រភេទទ្រព្យបញ្ចាំ:', rightX, metaY + metaLineH);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px KhmerOS, sans-serif';
    ctx.fillText(data.assetName || '—', rightX + 140, metaY + metaLineH);

    ctx.fillStyle = '#1e293b';
    ctx.font = '13px KhmerOS, sans-serif';
    ctx.fillText('លេខកិច្ចសន្យា:', rightX, metaY + metaLineH * 2);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px ArialBold, Arial, KhmerOS, sans-serif';
    ctx.fillText(data.contractNumber ? `#${data.contractNumber}` : '—', rightX + 140, metaY + metaLineH * 2);

    // 4. Table Structure
    const tableX = 50;
    const tableW = width - 100;
    const tableStartY = metaY + metaLineH * 3 + 25;

    const cols = [
        { w: 60, title: 'ខែទី', align: 'center' },
        { w: 220, title: 'ថ្ងៃបង់ប្រាក់', align: 'left' },
        { w: 155, title: 'ទឹកប្រាក់ត្រូវបង់សរុប', align: 'center' },
        { w: 155, title: 'ការប្រាក់ត្រូវបង់', align: 'center' },
        { w: 160, title: 'សមតុល្យនៅសល់', align: 'center' }
    ];

    // Table Header
    let curX = tableX;
    cols.forEach(col => {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(curX, tableStartY, col.w, tableHeaderHeight);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 13px KhmerOS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(col.title, curX + col.w / 2, tableStartY + 22);
        curX += col.w;
    });

    // Table Body
    let curY = tableStartY + tableHeaderHeight;
    data.schedule.forEach((row, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(tableX, curY, tableW, rowHeight);

        let rowX = tableX;
        const vals = [
            { text: String(row.no), align: 'center', isMono: true },
            { text: fmtDateWD(row.dueDate), align: 'left', isMono: false },
            { text: fmt2(row.totalDueMonth), align: 'center', isMono: true },
            { text: fmt2(data.monthlyInterest), align: 'center', isMono: true },
            { text: fmt2(row.remainingBalance), align: 'center', isMono: true }
        ];

        vals.forEach((v, ci) => {
            const col = cols[ci];
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(rowX, curY, col.w, rowHeight);

            ctx.fillStyle = '#0f172a';
            ctx.font = v.isMono ? '12.5px Arial, sans-serif' : '12px KhmerOS, sans-serif';

            if (col.align === 'center') {
                ctx.textAlign = 'center';
                ctx.fillText(v.text, rowX + col.w / 2, curY + 20);
            } else {
                ctx.textAlign = 'left';
                ctx.fillText(v.text, rowX + 12, curY + 20);
            }
            rowX += col.w;
        });

        curY += rowHeight;
    });

    // 5. Note
    const noteY = curY + 28;
    ctx.textAlign = 'left';
    ctx.font = 'bold 12.5px KhmerOS, sans-serif';
    ctx.fillStyle = '#7f1d1d';
    ctx.fillText('ចំណាំ ៖ ', tableX, noteY);
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px KhmerOS, sans-serif';
    ctx.fillText('ករណីអតិថិជនបង់ការប្រាក់រួចហើយ អតិថិជនមិនអាចដកប្រាក់វិញបានទេ (ដោយគ្មានលក្ខខណ្ឌ) ។', tableX + 50, noteY);

    // 6. Signatures Block
    const sigY = noteY + 50;
    const sigColW = (tableW - 80) / 2;
    ctx.textAlign = 'center';

    // Left Signature
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px KhmerMoul, KhmerOS, sans-serif';
    ctx.fillText('តំណាងក្រុមហ៊ុន', tableX + sigColW / 2, sigY);

    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tableX + sigColW / 2 - 80, sigY + 60);
    ctx.lineTo(tableX + sigColW / 2 + 80, sigY + 60);
    ctx.stroke();

    // Right Signature
    const rightSigX = tableX + sigColW + 80;
    ctx.fillText('ឈ្មោះអតិថិជន', rightSigX + sigColW / 2, sigY);

    ctx.beginPath();
    ctx.moveTo(rightSigX + sigColW / 2 - 80, sigY + 60);
    ctx.lineTo(rightSigX + sigColW / 2 + 80, sigY + 60);
    ctx.stroke();
    ctx.setLineDash([]);

    return canvas.toBuffer('image/png');
}

/** Generate pawn schedule PDF Buffer — matches CalculateSchedule2 print area exactly */
function generatePawnSchedulePdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const hasKhmer = fs.existsSync(khmerFontPath);
            const hasArial = fs.existsSync(arialFontPath);
            const hasArialBold = fs.existsSync(arialBoldPath);

            // Page size: A4 portrait
            const PAGE_W = 595.28;
            const PAGE_H = 841.89;
            const ML = 40;  // margin left
            const MR = 40;  // margin right
            const W = PAGE_W - ML - MR; // 515.28

            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 20, bottom: 20, left: ML, right: MR },
                bufferPages: true
            });
            if (hasKhmer) doc.registerFont('KH', khmerFontPath);
            if (hasArial) doc.registerFont('AR', arialFontPath);
            if (hasArialBold) doc.registerFont('ARB', arialBoldPath);

            const KH = hasKhmer ? 'KH' : 'Helvetica';
            const AR = hasArial ? 'AR' : 'Helvetica';
            const ARB = hasArialBold ? 'ARB' : 'Helvetica-Bold';

            const buffers = [];
            doc.on('data', b => buffers.push(b));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            let y = 28;

            // ────── HEADER (matches: ព្រះរាជាណាចក្រកកម្ពុជា) ──────
            doc.font(KH).fontSize(10).fillColor('#334155')
                .text('ព្រះរាជាណាចក្រកកម្ពុជា', ML, y, { width: W, align: 'center', lineBreak: false });
            y += 16;
            doc.font(KH).fontSize(9)
                .text('ជាតិ សាសនា ព្រះមហាក្សត្រ', ML, y, { width: W, align: 'center', lineBreak: false });
            y += 15;
            // Flower ornament (rendered as symbols)
            doc.font(AR).fontSize(13).fillColor('#1e293b')
                .text('❁ ❁ ✿ ❁ ❁', ML, y, { width: W, align: 'center', lineBreak: false });
            y += 16;
            // Divider line
            doc.moveTo(ML + W / 2 - 55, y).lineTo(ML + W / 2 + 55, y).strokeColor('#94a3b8').lineWidth(0.8).stroke();
            y += 10;
            // កាលវិភាគសងប្រាក់ title (blue, like <h4 style font moul>)
            doc.font(KH).fontSize(14).fillColor('#2750F5')
                .text('កាលវិភាគសងប្រាក់', ML, y, { width: W, align: 'center', lineBreak: false });
            y += 28;

            // ────── META INFO (2 columns matching grid-cols-2) ──────
            const colW = (W - 20) / 2;  // two equal columns with 20pt gap
            const lblColor = '#1e293b';
            const valColor = '#2563eb';
            const metaFontSize = 8.5;
            const metaRowH = 15;

            // left column data
            const leftMeta = [
                ['ថ្ងៃខែឆ្នាំដាក់បញ្ចាំ:', data.startDate ? data.startDate.split('-').reverse().join('-') : '—'],
                ['ចំនួនទឹកប្រាក់បញ្ចាំ:', `${Number(data.principal).toLocaleString()} USD`],
                ['រយៈពេល (ចំនួនខែ):', `${data.months}`],
                ['ការប្រាក់ នឹង សេវ៉ាជួល:', Number(data.monthlyInterest).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })]
            ];
            // right column data
            const rightMeta = [
                ['ឈ្មោះអតិថិជន', data.customerName || '—'],
                ['ប្រភេទទ្រព្យបញ្ចាំ', data.assetName || '—'],
                ['លេខកិច្ចសន្យា', data.contractNumber || '—']
            ];

            const startY = y;
            // Draw left meta
            leftMeta.forEach(([lbl, val], i) => {
                const ry = startY + i * metaRowH;
                doc.font(KH).fontSize(metaFontSize).fillColor(lblColor)
                    .text(lbl, ML, ry, { width: colW * 0.55, lineBreak: false });
                doc.font(KH).fontSize(metaFontSize).fillColor(valColor)
                    .text(val, ML + colW * 0.56, ry, { width: colW * 0.44, lineBreak: false });
            });
            // Draw right meta
            const rx = ML + colW + 20;
            rightMeta.forEach(([lbl, val], i) => {
                const ry = startY + i * metaRowH;
                doc.font(KH).fontSize(metaFontSize).fillColor(lblColor)
                    .text(lbl, rx, ry, { width: colW * 0.5, lineBreak: false });
                doc.font(KH).fontSize(metaFontSize).fillColor(valColor)
                    .text(val, rx + colW * 0.51, ry, { width: colW * 0.49, lineBreak: false });
            });

            y = startY + Math.max(leftMeta.length, rightMeta.length) * metaRowH + 14;

            // ────── SCHEDULE TABLE (matches CalculateSchedule2 HTML table) ──────
            // Columns: ខែទី | ថ្ងៃបង់ប្រាក់ | ទឹកប្រាក់ត្រូវបង់សរុប | ការប្រាក់ត្រូវបង់ | សមតុល្យនៅសល់
            const tCols = [
                { title: 'ខែទី',                  w: 38  },
                { title: 'ថ្ងៃបង់ប្រាក់',             w: 138 },
                { title: 'ទឹកប្រាក់ត្រូវបង់សរុប', w: 115 },
                { title: 'ការប្រាក់ត្រូវបង់',      w: 108 },
                { title: 'សមតុល្យនៅសល់',         w: W - 38 - 138 - 115 - 108 } // fills remaining
            ];

            // Table header row (dark background, white text — matches '#1e293b')
            const tHeaderH = 20;
            doc.rect(ML, y, W, tHeaderH).fill('#1e293b');
            let cx = ML;
            tCols.forEach(c => {
                doc.font(KH).fontSize(8).fillColor('#ffffff')
                    .text(c.title, cx + 2, y + 5, { width: c.w - 4, align: 'center', lineBreak: false });
                cx += c.w;
            });
            y += tHeaderH;

            // weekday labels matching HTML formatDateWithWeekday
            const WD_KH = ['ថ្ងៃអាទិត្យ', 'ថ្ងៃចន្ទ', 'ថ្ងៃអង្គារ', 'ថ្ងៃពុធ', 'ថ្ងៃព្រហស្បតិ៍', 'ថ្ងៃសុក្រ', 'ថ្ងៃសៅរ៍'];
            const fmtDateWD = (s) => {
                if (!s) return '—';
                const [yr, mo, dy] = s.split('-');
                const d = new Date(`${yr}-${mo}-${dy}T00:00:00`);
                return `${dy}-${mo}-${yr} ${WD_KH[d.getDay()]}`;
            };
            const fmtMoney = (v) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

            data.schedule.forEach((row, idx) => {
                const rh = 17;
                // Check page overflow
                if (y + rh > PAGE_H - 60) {
                    doc.addPage();
                    y = 30;
                    // Redraw header
                    doc.rect(ML, y, W, tHeaderH).fill('#1e293b');
                    let hx = ML;
                    tCols.forEach(c => {
                        doc.font(KH).fontSize(8).fillColor('#ffffff')
                            .text(c.title, hx + 2, y + 5, { width: c.w - 4, align: 'center', lineBreak: false });
                        hx += c.w;
                    });
                    y += tHeaderH;
                }

                // Alternating row colors like web (white / #f8fafc)
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                // Border (black, like HTML border-black)
                doc.rect(ML, y, W, rh).fillAndStroke(bg, '#000000');

                let tx = ML;
                const vals = [
                    { v: String(row.no),                align: 'center' },
                    { v: fmtDateWD(row.dueDate),        align: 'left'   },
                    { v: fmtMoney(row.totalDueMonth),   align: 'center' },
                    { v: fmtMoney(data.monthlyInterest),align: 'center' },
                    { v: fmtMoney(row.remainingBalance),align: 'center' }
                ];
                vals.forEach((item, ci) => {
                    const useFont = ci === 1 ? KH : AR;
                    doc.font(useFont).fontSize(8).fillColor('#0f172a')
                        .text(item.v, tx + 3, y + 4.5, { width: tCols[ci].w - 6, align: item.align, lineBreak: false });
                    tx += tCols[ci].w;
                });
                y += rh;
            });
            y += 12;

            // ────── NOTE (ចំណាំ ៖) ──────
            doc.font(KH).fontSize(9).fillColor('#7f1d1d')
                .text('ចំណាំ ៖', ML, y, { continued: true })
                .fillColor('#374151')
                .font(KH).fontSize(9)
                .text(' ករណីអតិថិជនបង់ការប្រាក់រួចហើយ អតិថិជនមិនអាចដកប្រាក់វិញបានទេ (ដោយគ្មានលក្ខខណ្ឌ) ។',
                { lineBreak: false });
            y += 26;

            // ────── SIGNATURE BLOCK (2 columns — matches grid-cols-2) ──────
            const sigColW = W / 2;
            // Labels
            doc.font(KH).fontSize(10).fillColor('#1e293b')
                .text('តំណាងក្រុមហ៊ុន', ML, y, { width: sigColW, align: 'center', lineBreak: false });
            doc.font(KH).fontSize(10).fillColor('#1e293b')
                .text('ឈ្មោះអតិថិជន', ML + sigColW, y, { width: sigColW, align: 'center', lineBreak: false });
            y += 52;
            // Dotted signature lines
            const lineMargin = sigColW * 0.15;
            doc.moveTo(ML + lineMargin, y).lineTo(ML + sigColW - lineMargin, y)
                .dash(2, { space: 3 }).strokeColor('#94a3b8').lineWidth(0.8).stroke();
            doc.moveTo(ML + sigColW + lineMargin, y).lineTo(ML + W - lineMargin, y)
                .stroke();
            doc.undash();
            y += 16;

            // ────── ADDRESS FOOTER ──────
            // Position at near bottom like HTML cs2-address-footer
            const footerY = PAGE_H - 30;
            doc.font(KH).fontSize(8).fillColor('#64748b')
                .text('អាសយដ្ឋាន: អគារលេខ378A ផ្លូវ1928 ភូមិកោះអណ្តែត សង្កាត់ទួលសង្កែទី២ ខណ្ឌឮស្សីកែវ រាជធានីភ្នំពេញ',
                    ML, footerY, { width: W, align: 'center', lineBreak: false });

            doc.end();
        } catch (err) { reject(err); }
    });
}


/**
 * Initialize Telegram Bot Service with interactive /sys workflow
 * @param {TelegramBot} bot - The initialized node-telegram-bot-api instance
 */
export function initTelegramBotService(bot) {
    if (!bot) return;

    console.log('[TelegramBot] Initializing interactive /sys handler & Telegram service...');

    // ── Helper: Send Brand Selection Buttons ──
    const promptBrandSelection = async (chatId) => {
        sessions.delete(chatId);
        const brands = await getAllSystemBrands();

        const keyboard = [];
        // Group brands in rows of 2
        for (let i = 0; i < brands.length; i += 2) {
            const row = [];
            row.push({ text: `🏢 ${brands[i]}`, callback_data: `select_brand:${brands[i]}` });
            if (brands[i + 1]) {
                row.push({ text: `🏢 ${brands[i + 1]}`, callback_data: `select_brand:${brands[i + 1]}` });
            }
            keyboard.push(row);
        }

        const msg = `🏢 <b>SYSTEM MDM — សូមជ្រើសរើស Brand</b>\n\n` +
                    `សូមចុចលើ Brand ណាមួយខាងក្រោមដែលអ្នកចង់ចូលប្រើប្រាស់៖\n` +
                    `<i>(រកឃើញចំនួន ${brands.length} Brands នៅក្នុងប្រព័ន្ធ)</i>`;

        await bot.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    };

    // ── Helper: Send Main Menu (Search + Create Pawn) ──
    const promptSearchMenu = async (chatId, brand, username) => {
        const keyboard = [];
        for (let i = 0; i < SEARCH_OPTIONS.length; i += 2) {
            const row = [];
            row.push({ text: SEARCH_OPTIONS[i].labelKh, callback_data: `search_type:${SEARCH_OPTIONS[i].type}` });
            if (SEARCH_OPTIONS[i + 1]) {
                row.push({ text: SEARCH_OPTIONS[i + 1].labelKh, callback_data: `search_type:${SEARCH_OPTIONS[i + 1].type}` });
            }
            keyboard.push(row);
        }
        // Create Pawn Contract button
        keyboard.push([
            { text: '📝 បង្កើតកុងត្រាបញ្ចាំថ្មី (New Pawn)', callback_data: 'cmd:create_pawn' }
        ]);
        // Action row
        keyboard.push([
            { text: '🔄 ជ្រើសរើស Brand ផ្សេង', callback_data: 'cmd:switch_brand' },
            { text: '🚪 ចាកចេញ (Logout)', callback_data: 'cmd:logout' }
        ]);

        const msg = `✅ <b>ផ្ទៀងផ្ទាត់ជោគជ័យ!</b>\n\n` +
                    `👤 <b>គណនី:</b> <code>${username}</code>\n` +
                    `🏢 <b>Brand:</b> <b>${brand}</b>\n\n` +
                    `🔎 <b>ស្វែងរកព័ត៌មានភ្ញៀវ ឬ 📝 បង្កើតកុងត្រាបញ្ចាំ:</b>`;

        await bot.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    };

    // ── Helper: Process Customer Export to PDF & Send ──
    const exportAndSendPdf = async (chatId, contract, brandName) => {
        try {
            await bot.sendMessage(chatId, `⏳ <i>កំពុងទាញយកទិន្នន័យកុងត្រា និងរៀបចំបង្កើតឯកសារ PDF...</i>`, { parse_mode: 'HTML' });

            // Fetch payments
            let payments = [];
            if (isMongoConnected) {
                payments = await queryAllDBs(Payment, (M) => M.find({ contractId: contract.contractId }));
            } else if (MEM_DB.payments) {
                payments = MEM_DB.payments.filter(p => p.contractId === contract.contractId);
            }

            // Generate PDF Buffer
            const pdfBuffer = await generateCustomerPdf(contract, payments, brandName || contract.brand);

            const safeName = (contract.customerNameEn || contract.customerNameKh || 'Customer').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const safeId = (contract.contractId || contract.serialNumber || 'DOC').replace(/[^a-zA-Z0-9_\-]/g, '_');
            // Compute loan financials accurately
            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];
            const schedTotal = schedule.reduce((acc, row) => acc + (parseFloat(row.totalAmount || row.amount || 0) || 0), 0);
            const totalLoan = (parseFloat(contract.totalAmount) > 0)
                ? parseFloat(contract.totalAmount)
                : (schedTotal > 0 ? schedTotal : (parseFloat(contract.amount) || 0));

            const totalPaid = (payments && payments.length > 0)
                ? payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)
                : schedule.reduce((acc, r) => acc + (parseFloat(r.paidAmount || 0) || 0), 0);

            const remaining = Math.max(0, totalLoan - totalPaid);
            const filename = `Report_${safeId}_${safeName}.pdf`;

            const caption = `📄 <b>របាយការណ៍ព័ត៌មានភ្ញៀវ & តារាងបង់ប្រាក់ (PDF)</b>\n\n` +
                            `👤 <b>ឈ្មោះ:</b> ${contract.customerNameKh || '-'} (${contract.customerNameEn || '-'})\n` +
                            `📱 <b>ទូរស័ព្ទ:</b> <code>${contract.phone || '-'}</code>\n` +
                            `📱 <b>ម៉ូឌែល:</b> ${contract.model || '-'}\n` +
                            `🔢 <b>Serial Number:</b> <code>${contract.serialNumber || '-'}</code>\n` +
                            `🆔 <b>IMEI:</b> <code>${contract.imei1 || contract.imei2 || '-'}</code>\n` +
                            `🏢 <b>Brand:</b> ${contract.brand || brandName || '-'}\n` +
                            `💰 <b>ស្ថានភាព:</b> <b>${contract.status || 'Active'}</b>\n` +
                            `💵 <b>តម្លៃកម្ចីសរុប (Total Loan):</b> $${totalLoan.toFixed(2)}\n` +
                            `💳 <b>បានបង់សរុប (Total Paid):</b> $${totalPaid.toFixed(2)}\n` +
                            `📉 <b>នៅសល់ (Remaining):</b> $${remaining.toFixed(2)}`;

            // Extract and validate Facebook URL if present
            let rawFbUrl = contract.urlFb || contract.url_fb || contract.facebookUrl || '';
            if (!rawFbUrl && contract.facebookName && (contract.facebookName.startsWith('http://') || contract.facebookName.startsWith('https://') || contract.facebookName.includes('facebook.com'))) {
                rawFbUrl = contract.facebookName;
            }

            let fbUrl = '';
            if (rawFbUrl) {
                let trimmed = String(rawFbUrl).trim();
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    trimmed = `https://${trimmed}`;
                }
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    fbUrl = trimmed;
                }
            }

            // Action buttons
            const keyboard = [];
            if (fbUrl) {
                keyboard.push([{ text: '🌐 មើល Facebook ភ្ញៀវ (Open Facebook)', url: fbUrl }]);
            }
            keyboard.push([
                { text: '🔍 ស្វែងរកភ្ញៀវបន្ត', callback_data: 'cmd:search_again' },
                { text: '🏢 ជ្រើស Brand ផ្សេង', callback_data: 'cmd:switch_brand' }
            ]);

            await bot.sendDocument(chatId, pdfBuffer, {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            }, {
                filename: filename,
                contentType: 'application/pdf'
            });

        } catch (pdfErr) {
            console.error('[TelegramBot] PDF Generation/Sending failed:', pdfErr);
            await bot.sendMessage(chatId, `❌ មានបញ្ហាក្នុងការបង្កើត PDF: ${pdfErr.message}`);
        }
    };

    // ── Command Listeners ──
    bot.onText(/\/(sys|start|help|menu)/i, async (msg) => {
        const chatId = msg.chat.id;
        await promptBrandSelection(chatId);
    });

    // ── /calc — Interest Calculator ──
    bot.onText(/\/calc/i, async (msg) => {
        const chatId = msg.chat.id;
        const session = sessions.get(chatId) || {};
        session.calcStep = 'CALC_PRINCIPAL';
        sessions.set(chatId, { ...session, calcStep: 'CALC_PRINCIPAL' });

        await bot.sendMessage(chatId,
            `🧮 <b>គណនាការប្រាក់ (Calculate Interest)</b>\n\n` +
            `💵 <b>ជំហ1 — ប្រាក់ដើម ($)</b>\nសូមវាយបញ្ចូលចំនួនប្រាក់ដើម (ឧ. 1000):`,
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '$100', callback_data: 'calc_p:100' }, { text: '$200', callback_data: 'calc_p:200' }, { text: '$500', callback_data: 'calc_p:500' }],
                    [{ text: '$1000', callback_data: 'calc_p:1000' }, { text: '$2000', callback_data: 'calc_p:2000' }, { text: '$5000', callback_data: 'calc_p:5000' }],
                    [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                ]}
            }
        );
    });

    // ── Callback Query (Button Clicks) ──
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            await bot.answerCallbackQuery(query.id).catch(() => {});

            // 1. Brand Selected
            if (data.startsWith('select_brand:')) {
                const brand = data.split('select_brand:')[1];
                sessions.set(chatId, {
                    step: 'AWAIT_AUTH',
                    brand: brand,
                    authenticated: false
                });

                const authMsg = `🏢 <b>Brand បានជ្រើសរើស: ${brand}</b>\n\n` +
                                `🔐 <b>សូមបញ្ចូល Username និង Password របស់អ្នក</b>\n` +
                                `ដើម្បីផ្ទៀងផ្ទាត់សិទ្ធិចូលដំណើរការទិន្នន័យ៖\n\n` +
                                `👉 <i>ទម្រង់បញ្ចូល (Format):</i> <code>username password</code>\n` +
                                `(ឧទាហរណ៍៖ <code>admin 123456</code>)`;

                await bot.sendMessage(chatId, authMsg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: '⬅️ ត្រឡប់ក្រោយ (Back)', callback_data: 'cmd:switch_brand' }]]
                    }
                });
                return;
            }

            // 2. Search Type Selected
            if (data.startsWith('search_type:')) {
                const searchType = data.split('search_type:')[1];
                const session = sessions.get(chatId);

                if (!session || !session.authenticated) {
                    await bot.sendMessage(chatId, `⚠️ សូមចូលប្រព័ន្ធជាមុនសិនដោយចុច /sys`);
                    return;
                }

                session.step = 'AWAIT_QUERY';
                session.searchType = searchType;
                sessions.set(chatId, session);

                const opt = SEARCH_OPTIONS.find(o => o.type === searchType) || { labelKh: searchType, labelEn: searchType };

                const promptMsg = `🔍 <b>ស្វែងរកតាម ${opt.labelKh}</b>\n` +
                                  `🏢 Brand: <b>${session.brand}</b>\n\n` +
                                  `សូមវាយបញ្ចូលពាក្យគន្លឹះ ឬលេខដែលចង់ស្វែងរក (Type search value):`;

                await bot.sendMessage(chatId, promptMsg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: '⬅️ ប្តូរវិធីស្វែងរក (Back)', callback_data: 'cmd:search_again' }]]
                    }
                });
                return;
            }

            // 3. Specific Contract Picked from Multi-result List
            if (data.startsWith('pick_contract:')) {
                const contractId = data.split('pick_contract:')[1];
                const session = sessions.get(chatId);
                const brand = session?.brand || '';

                let contract = null;
                if (session?.pendingContracts) {
                    contract = session.pendingContracts.find(c => c.contractId === contractId || c._id?.toString() === contractId);
                }

                if (!contract && isMongoConnected) {
                    const found = await queryAllDBs(Contract, (M) => M.find({ $or: [{ contractId }, { _id: contractId }] }));
                    contract = found[0];
                }

                if (!contract) {
                    await bot.sendMessage(chatId, `❌ រកមិនឃើញទិន្នន័យកុងត្រានេះឡើយ។`);
                    return;
                }

                await exportAndSendPdf(chatId, contract, brand);
                return;
            }

            // 4. Command Actions
            if (data === 'cmd:switch_brand') {
                await promptBrandSelection(chatId);
                return;
            }

            if (data === 'cmd:search_again') {
                const session = sessions.get(chatId);
                if (session && session.authenticated) {
                    session.step = 'SEARCH_SELECT';
                    sessions.set(chatId, session);
                    await promptSearchMenu(chatId, session.brand, session.username);
                } else {
                    await promptBrandSelection(chatId);
                }
                return;
            }

            if (data === 'cmd:logout') {
                sessions.delete(chatId);
                await bot.sendMessage(chatId, `👋 បានចាកចេញពីប្រព័ន្ធដោយជោគជ័យ។ ចុច /sys ដើម្បីចាប់ផ្តើមឡើងវិញ។`);
                return;
            }

            // ── 5. Create Pawn Contract: Start Wizard ──
            if (data === 'cmd:create_pawn') {
                const session = sessions.get(chatId);
                if (!session || !session.authenticated) {
                    await bot.sendMessage(chatId, `⚠️ សូមចូលប្រព័ន្ធជាមុនដោយចុច /sys`);
                    return;
                }

                const nextNum = await getNextContractNumber(session.brand);
                session.pawn = { contractNumber: nextNum };
                session.step = 'PAWN_CONFIRM_NUMBER';
                sessions.set(chatId, session);

                await bot.sendMessage(chatId,
                    `📝 <b>បង្កើតកុងត្រាបញ្ចាំថ្មី</b>\n\n` +
                    `🔢 <b>លេខរៀងបន្ទាប់ (Auto):</b> <code>${nextNum}</code>\n\n` +
                    `✏️ សូមផ្ទៀងផ្ទាត់ ឬផ្លាស់ប្ដូរលេខរៀង:\n` +
                    `• ប្រសិនបើត្រឹមត្រូវ ចុច ✅ <b>បញ្ជាក់</b>\n` +
                    `• ឬវាយ <b>លេខថ្មី</b> ដោយផ្ទាល់`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: `✅ បញ្ជាក់ #${nextNum}`, callback_data: `pawn_num:${nextNum}` }],
                                [{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]
                            ]
                        }
                    }
                );
                return;
            }

            // ── 6. Pawn: Contract Number confirmed via button ──
            if (data.startsWith('pawn_num:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const num = data.split('pawn_num:')[1];
                session.pawn.contractNumber = num;
                session.step = 'PAWN_CUSTOMER_NAME';
                sessions.set(chatId, session);

                await bot.sendMessage(chatId,
                    `📋 <b>លេខរៀង:</b> <code>#${num}</code>\n\n` +
                    `👤 <b>ជំហ1 — ឈ្មោះអតិថិជន</b>\n` +
                    `សូមវាយបញ្ចូលឈ្មោះអតិថិជន:`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]] } }
                );
                return;
            }

            // ── 7. Pawn: Asset Model (base) selected ──
            if (data.startsWith('pawn_model:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const base = decodeURIComponent(data.split('pawn_model:')[1]);
                session.pawn.selectedBase = base;
                sessions.set(chatId, session);

                const groups = session.pawn._groups || {};
                const variants = groups[base] || [];

                if (variants.length <= 1) {
                    // Only one variant (which is the base itself) — skip variant step
                    session.pawn.assetName = variants[0] || base;
                    session.step = 'PAWN_DURATION';
                    sessions.set(chatId, session);
                    await promptPawnDuration(chatId, session);
                } else {
                    session.step = 'PAWN_ASSET_VARIANT';
                    sessions.set(chatId, session);
                    const varKeyboard = variants.map(v => [{ text: `📱 ${v}`, callback_data: `pawn_variant:${encodeURIComponent(v)}` }]);
                    varKeyboard.push([{ text: '⬅️ ត្រឡប់ Model', callback_data: 'pawn_back:model' }, { text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]);
                    await bot.sendMessage(chatId,
                        `📱 <b>Model: ${base}</b>\n\n` +
                        `🔘 <b>ជំហ3b — ជ្រើស Variant:</b>`,
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: varKeyboard } }
                    );
                }
                return;
            }

            // ── 8. Pawn: Variant selected ──
            if (data.startsWith('pawn_variant:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const full = decodeURIComponent(data.split('pawn_variant:')[1]);
                session.pawn.assetName = full;
                session.step = 'PAWN_DURATION';
                sessions.set(chatId, session);
                await promptPawnDuration(chatId, session);
                return;
            }

            // ── 9. Pawn: Duration selected via button ──
            if (data.startsWith('pawn_dur:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const months = parseInt(data.split('pawn_dur:')[1], 10);
                session.pawn.months = months;
                session.step = 'PAWN_PRINCIPAL';
                sessions.set(chatId, session);
                await bot.sendMessage(chatId,
                    `⏱ <b>រយៈពេល:</b> <code>${months} ខែ</code>\n\n` +
                    `💵 <b>ជំហ4 — ប្រាក់ដើម ($)</b>\n` +
                    `សូមវាយបញ្ចូលចំនួនប្រាក់ដើម (ឧ. 120):`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                        [{ text: '$100', callback_data: 'pawn_p:100' }, { text: '$120', callback_data: 'pawn_p:120' }, { text: '$200', callback_data: 'pawn_p:200' }, { text: '$500', callback_data: 'pawn_p:500' }],
                        [{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]
                    ]}}
                );
                return;
            }

            // ── 10. Pawn: Principal quick button ──
            if (data.startsWith('pawn_p:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const principal = parseFloat(data.split('pawn_p:')[1]);
                session.pawn.principal = principal;
                session.step = 'PAWN_RATE';
                sessions.set(chatId, session);
                await promptPawnRate(chatId, session);
                return;
            }

            // ── 11. Pawn: Rate quick button ──
            if (data.startsWith('pawn_r:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const rate = parseFloat(data.split('pawn_r:')[1]);
                session.pawn.ratePercent = rate;
                session.step = 'PAWN_PREVIEW';
                sessions.set(chatId, session);
                await sendPawnPreview(chatId, session);
                return;
            }

            if (data.startsWith('pawn_round:')) {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                session.pawn.roundingMode = data.split('pawn_round:')[1] === 'up' ? 'up' : 'down';
                sessions.set(chatId, session);
                await sendPawnPreview(chatId, session);
                return;
            }

            // ── 12. Pawn: Back to model selection ──
            if (data === 'pawn_back:model') {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                session.step = 'PAWN_ASSET_MODEL';
                sessions.set(chatId, session);
                await sendModelButtons(chatId, session);
                return;
            }

            // ── 12b. Pawn: Switch to manual asset typing ──
            if (data === 'pawn_back:manual_mode') {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                session.step = 'PAWN_ASSET_MANUAL';
                sessions.set(chatId, session);
                await bot.sendMessage(chatId,
                    `⌨️ <b>ប្រភេទទ្រព្យបញ្ចាំ</b>\nសូមវាយបញ្ចូលដោយដៃ (ឧ. iPhone 14 Pro):`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]] } }
                );
                return;
            }

            // ── 13. Pawn: Confirm Save ──
            if (data === 'pawn_save:confirm') {
                const session = sessions.get(chatId);
                if (!session || !session.pawn) return;
                const p = session.pawn;

                try {
                    const startDate = new Date().toISOString().split('T')[0];
                    const { monthlyInterest, totalInterest, schedule } = calcPawnSchedule(
                        p.principal, p.ratePercent, p.months, p.startDate || startDate, p.roundingMode || 'up'
                    );

                    const newDoc = {
                        contractNumber: p.contractNumber || '',
                        customerName: p.customerName || '',
                        assetName: p.assetName || '',
                        assetType: '',
                        startDate: p.startDate || startDate,
                        principal: p.principal,
                        ratePercent: p.ratePercent,
                        months: p.months,
                        monthlyInterest,
                        totalInterest,
                        schedule,
                        brand: session.brand || '',
                        createdBy: session.username || 'TelegramBot',
                        notes: `Created via Telegram Bot by ${session.username || 'unknown'}`,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    if (isMongoConnected) {
                        const Model = getWriteModel(CalculateSchedule);
                        await Model.create(newDoc);
                    } else {
                        if (!MEM_DB.calculateSchedules) MEM_DB.calculateSchedules = [];
                        newDoc._id = 'calc_tg_' + Date.now();
                        MEM_DB.calculateSchedules.unshift(newDoc);
                    }

                    // Realtime Push to Schedule 2 web page
                    try {
                        broadcastCalculateUpdate({ type: 'CREATED', data: newDoc });
                    } catch (e) {
                        console.warn('[TelegramBot] Realtime broadcast error:', e);
                    }

                    session.step = 'SEARCH_SELECT';
                    delete session.pawn;
                    sessions.set(chatId, session);

                    await bot.sendMessage(chatId,
                        `✅ <b>រក្សាទុកបានជោគជ័យ!</b>\n\n` +
                        `📋 <b>លេខ:</b> #${newDoc.contractNumber}\n` +
                        `👤 <b>ឈ្មោះ:</b> ${newDoc.customerName}\n` +
                        `📱 <b>ទ្រព្យ:</b> ${newDoc.assetName}\n` +
                        `💵 <b>ប្រាក់ដើម:</b> $${newDoc.principal}\n` +
                        `📅 <b>រយៈពេល:</b> ${newDoc.months} ខែ\n` +
                        `💹 <b>ការប្រាក់/ខែ:</b> $${monthlyInterest.toFixed(2)}\n\n` +
                        `ទិន្នន័យបានរក្សាទុកនៅ <b>Schedule 2</b> ដោយជោគជ័យ! ✔️`,
                        {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [
                                [{ text: '📝 បង្កើតកុងត្រាថ្មីទៀត', callback_data: 'cmd:create_pawn' }],
                                [{ text: '🔍 ស្វែងរកភ្ញៀវ', callback_data: 'cmd:search_again' }]
                            ]}
                        }
                    );
                } catch (saveErr) {
                    console.error('[TelegramBot] Pawn save error:', saveErr);
                    await bot.sendMessage(chatId, `❌ បរាជ័យក្នុងការរក្សាទុក: ${saveErr.message}`);
                }
                return;
            }

            // ── 14. Pawn: Cancel/Redo ──
            if (data === 'pawn_save:cancel') {
                const session = sessions.get(chatId);
                if (session) {
                    delete session.pawn;
                    session.step = 'SEARCH_SELECT';
                    sessions.set(chatId, session);
                }
                await bot.sendMessage(chatId, `❌ បានបោះបង់ការបង្កើតកុងត្រា។`);
                if (session) await promptSearchMenu(chatId, session.brand, session.username);
                return;
            }

            // ── 15. Calc: Cancel ──
            if (data === 'calc:cancel') {
                const session = sessions.get(chatId);
                if (session) { delete session.calcStep; delete session.calc; sessions.set(chatId, session); }
                await bot.sendMessage(chatId, `❌ បានបោះបង់ការគណនា។`);
                return;
            }

            // ── 16. Calc: Restart ──
            if (data === 'calc:restart') {
                const session = sessions.get(chatId) || {};
                session.calcStep = 'CALC_PRINCIPAL';
                session.calc = {};
                sessions.set(chatId, session);
                await bot.sendMessage(chatId,
                    `🧮 <b>គណនាការប្រាក់ — ប្រាក់ដើមថ្មី</b>\n\n💵 <b>ជំហ1 — ប្រាក់ដើម ($)</b>\nសូមវាយបញ្ចូលចំនួនប្រាក់ដើម:`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                        [{ text: '$100', callback_data: 'calc_p:100' }, { text: '$200', callback_data: 'calc_p:200' }, { text: '$500', callback_data: 'calc_p:500' }],
                        [{ text: '$1000', callback_data: 'calc_p:1000' }, { text: '$2000', callback_data: 'calc_p:2000' }, { text: '$5000', callback_data: 'calc_p:5000' }],
                        [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                    ]}}
                );
                return;
            }

            // ── 17. Calc: Principal quick button ──
            if (data.startsWith('calc_p:')) {
                const session = sessions.get(chatId) || {};
                const principal = parseFloat(data.split('calc_p:')[1]);
                session.calc = { ...(session.calc || {}), principal };
                session.calcStep = 'CALC_RATE';
                sessions.set(chatId, session);
                await bot.sendMessage(chatId,
                    `💵 <b>ប្រាក់ដើម:</b> $${principal}\n\n📊 <b>ជំហ2 — អត្រាការប្រាក់ (%/ខែ)</b>\nសូមជ្រើសរើស ឬវាយអត្រា (ឧ. 11.5):`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                        [{ text: '⭐ 11.5%', callback_data: 'calc_r:11.5' }, { text: '10%', callback_data: 'calc_r:10' }, { text: '12%', callback_data: 'calc_r:12' }, { text: '15%', callback_data: 'calc_r:15' }],
                        [{ text: '5%', callback_data: 'calc_r:5' }, { text: '3%', callback_data: 'calc_r:3' }, { text: '1%', callback_data: 'calc_r:1' }],
                        [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                    ]}}
                );
                return;
            }

            // ── 18. Calc: Rate quick button ──
            if (data.startsWith('calc_r:')) {
                const session = sessions.get(chatId);
                if (!session || !session.calc) return;
                const rate = parseFloat(data.split('calc_r:')[1]);
                session.calc.ratePercent = rate;
                session.calcStep = 'CALC_DURATION';
                sessions.set(chatId, session);
                await bot.sendMessage(chatId,
                    `📊 <b>អត្រា:</b> ${rate}%/ខែ\n\n⏳ <b>ជំហ3 — រយៈពេលកម្ចី (ខែ)</b>\nសូមជ្រើសរើស ឬវាយចំនួនខែ:`,
                    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                        [{ text: '1 ខែ', callback_data: 'calc_d:1' }, { text: '2 ខែ', callback_data: 'calc_d:2' }, { text: '3 ខែ', callback_data: 'calc_d:3' }, { text: '4 ខែ', callback_data: 'calc_d:4' }],
                        [{ text: '6 ខែ', callback_data: 'calc_d:6' }, { text: '12 ខែ', callback_data: 'calc_d:12' }],
                        [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                    ]}}
                );
                return;
            }

            // ── 19. Calc: Duration quick button → show result ──
            if (data.startsWith('calc_d:')) {
                const session = sessions.get(chatId);
                if (!session || !session.calc) return;
                const months = parseInt(data.split('calc_d:')[1], 10);
                session.calc.months = months;
                delete session.calcStep;
                sessions.set(chatId, session);
                await sendCalcResult(chatId, session.calc);
                return;
            }

            if (data.startsWith('calc_round:')) {
                const session = sessions.get(chatId);
                if (!session || !session.calc) return;
                session.calc.roundingMode = data.split('calc_round:')[1] === 'up' ? 'up' : 'down';
                sessions.set(chatId, session);
                await sendCalcResult(chatId, session.calc);
                return;
            }

        } catch (err) {
            console.error('[TelegramBot] Callback query error:', err);
        }
    });

    // ── Pawn Wizard Helpers (inline) ──

    const sendModelButtons = async (chatId, session) => {
        const assetList = await fetchAssetTypes(session.brand);
        const groups = groupAssetModels(assetList);
        session.pawn._groups = groups;
        sessions.set(chatId, session);
        const bases = Object.keys(groups).sort();
        if (bases.length === 0) {
            session.step = 'PAWN_ASSET_MANUAL';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `📱 <b>ជំហ3 — ប្រភេទទ្រព្យបញ្ចាំ</b>\n\nគ្មានទ្រព្យនៅក្នុង Database ទេ។\nសូមវាយបញ្ចូលដោយដៃ (ឧ. iPhone 14 Pro):`,
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]] } }
            );
            return;
        }
        const keyboard = [];
        for (let i = 0; i < bases.length; i += 2) {
            const row = [{ text: `📱 ${bases[i]}`, callback_data: `pawn_model:${encodeURIComponent(bases[i])}` }];
            if (bases[i + 1]) row.push({ text: `📱 ${bases[i + 1]}`, callback_data: `pawn_model:${encodeURIComponent(bases[i + 1])}` });
            keyboard.push(row);
        }
        keyboard.push([{ text: '⌨️ វាយដោយដៃ', callback_data: 'pawn_back:manual_mode' }, { text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]);
        await bot.sendMessage(chatId,
            `📱 <b>ជំហ3 — ជ្រើស Model គោក:</b>`,
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
        );
    };

    const promptPawnDuration = async (chatId, session) => {
        const p = session.pawn;
        await bot.sendMessage(chatId,
            `📱 <b>ទ្រព្យ:</b> ${p.assetName}\n\n` +
            `⏱ <b>ជំហ4 — រយៈពេល (ខែ)</b>\nសូមជ្រើស ឬវាយចំនួនខែ:`,
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [
                        { text: '2️⃣ ២ ខែ', callback_data: 'pawn_dur:2' },
                        { text: '3️⃣ ៣ ខែ', callback_data: 'pawn_dur:3' },
                        { text: '4️⃣ ៤ ខែ', callback_data: 'pawn_dur:4' }
                    ],
                    [
                        { text: '6️⃣ ៦ ខែ', callback_data: 'pawn_dur:6' },
                        { text: '🔟 ១២ ខែ', callback_data: 'pawn_dur:12' }
                    ],
                    [{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]
                ]}
            }
        );
    };

    const promptPawnRate = async (chatId, session) => {
        const p = session.pawn;
        await bot.sendMessage(chatId,
            `💵 <b>ប្រាក់ដើម:</b> $${p.principal}\n\n` +
            `💹 <b>ជំហ5 — អត្រា %/ខែ</b>\n` +
            `Default: <b>11.5%</b> — ចុចដើម្បីប្រើ ឬវាយអត្រាដែលចង់:`,
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [
                        { text: '⭐ 11.5%', callback_data: 'pawn_r:11.5' },
                        { text: '10%', callback_data: 'pawn_r:10' },
                        { text: '12%', callback_data: 'pawn_r:12' },
                        { text: '15%', callback_data: 'pawn_r:15' }
                    ],
                    [{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]
                ]}
            }
        );
    };

    const sendPawnPreview = async (chatId, session) => {
        const p = session.pawn;
        const today = new Date().toISOString().split('T')[0];
        p.startDate = p.startDate || today;
        const roundingMode = p.roundingMode || 'up';
        const { monthlyInterest, totalInterest, schedule } = calcPawnSchedule(p.principal, p.ratePercent, p.months, p.startDate, roundingMode);

        const [y, m, d] = p.startDate.split('-');
        const fmtD = `${d}-${m}-${y}`;
        const fmt2 = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const caption =
            `📋 <b>កាលវិភាគសងប្រាក់ (Pawn Schedule 2)</b>\n\n` +
            `🔢 <b>លេខកិច្ចសន្យា:</b> #${p.contractNumber || '—'}\n` +
            `👤 <b>ឈ្មោះអតិថិជន:</b> ${p.customerName || '—'}\n` +
            `📱 <b>ប្រភេទទ្រព្យ:</b> ${p.assetName || '—'}\n` +
            `📅 <b>ថ្ងៃដាក់:</b> ${fmtD} | ⏱ <b>រយៈពេល:</b> ${p.months} ខែ\n` +
            `💵 <b>ប្រាក់ដើម:</b> $${fmt2(p.principal)} | 💹 <b>ការប្រាក់:</b> ${p.ratePercent}%/ខែ\n` +
            `💰 <b>ការប្រាក់/ខែ:</b> $${fmt2(monthlyInterest)} | <b>សរុបការប្រាក់:</b> $${fmt2(totalInterest)}`;

        const inlineKeyboard = [
            [
                { text: `${roundingMode === 'up' ? '✓ ' : ''}បង្គត់ឡើង`, callback_data: 'pawn_round:up' },
                { text: `${roundingMode === 'down' ? '✓ ' : ''}បង្គត់ចុះ`, callback_data: 'pawn_round:down' }
            ],
            [{ text: '✅ Save ចូល Schedule 2', callback_data: 'pawn_save:confirm' }],
            [{ text: '❌ Cancel', callback_data: 'pawn_save:cancel' }]
        ];

        try {
            const imgBuffer = await generatePawnScheduleImage({
                customerName: p.customerName,
                contractNumber: p.contractNumber,
                assetName: p.assetName,
                startDate: p.startDate,
                principal: p.principal,
                ratePercent: p.ratePercent,
                months: p.months,
                monthlyInterest: monthlyInterest,
                totalInterest: totalInterest,
                schedule: schedule
            });

            await bot.sendPhoto(chatId, imgBuffer, {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineKeyboard }
            }, {
                filename: `Schedule_${p.contractNumber || 'Pawn'}.png`,
                contentType: 'image/png'
            });
        } catch (imgErr) {
            console.error('[TelegramBot] Failed to generate/send schedule photo:', imgErr);
            // Fallback to text message if photo fails
            await bot.sendMessage(chatId, caption, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineKeyboard }
            });
        }
    };
    // ── Calc Interest Helper ──
    const sendCalcResult = async (chatId, calc) => {
        const { principal, ratePercent, months } = calc;
        const rateDecimal = ratePercent / 100;
        const monthlyInterest = Math.round((principal * rateDecimal + 1e-8) * 100) / 100;
        const monthlyPrincipal = principal / months;
        const principalCents = Math.round((principal + 1e-8) * 100);
        const monthlyPrincipalCents = monthlyPrincipal * 100;
        const roundingMode = calc.roundingMode || 'up';
        const roundedMonthlyPrincipalCents = roundingMode === 'up'
            ? Math.ceil(monthlyPrincipalCents - 1e-8)
            : Math.floor(monthlyPrincipalCents + 1e-8);
        let remainingCents = principalCents;
        const installmentTotals = [];
        for (let month = 1; month <= months; month++) {
            const principalPaymentCents = month === months
                ? remainingCents
                : Math.min(remainingCents, roundedMonthlyPrincipalCents);
            remainingCents -= principalPaymentCents;
            installmentTotals.push(Math.round((principalPaymentCents / 100 + monthlyInterest + 1e-8) * 100) / 100);
        }
        const monthlyTotal = installmentTotals[0] || 0;
        const totalInterest = Math.round((monthlyInterest * months + 1e-8) * 100) / 100;
        const totalRepayment = Math.round((installmentTotals.reduce((sum, payment) => sum + payment, 0) + 1e-8) * 100) / 100;

        const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const result =
            `📋 តារាងគណនាការប្រាក់ & កាលវិភាគបង់ប្រាក់\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 ប្រាក់ដើមកម្ចី: $${fmt(principal)}\n` +
            `📊 អត្រាការប្រាក់: ${ratePercent}% / ខែ\n` +
            `⏳ រយៈពេលកម្ចី: ${months} ខែ\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 ការប្រាក់ក្នុង ១ ខែ: $${fmt(monthlyInterest)}\n` +
            `💳 ត្រូវបង់ក្នុង ១ ខែ: $${fmt(monthlyTotal)}\n` +
            `🔚 ត្រូវបង់ខែចុងក្រោយ: $${fmt(installmentTotals[months - 1] || 0)}\n` +
            `💵 សរុបការប្រាក់ទាំងអស់ (${months}ខែ): $${fmt(totalInterest)}\n` +
            `✨ សរុបប្រាក់ត្រូវបង់ត្រឡប់មកវិញទាំងអស់: $${fmt(totalRepayment)}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        await bot.sendMessage(chatId, result, {
            reply_markup: { inline_keyboard: [
                [
                    { text: `${roundingMode === 'up' ? '✓ ' : ''}បង្គត់ឡើង`, callback_data: 'calc_round:up' },
                    { text: `${roundingMode === 'down' ? '✓ ' : ''}បង្គត់ចុះ`, callback_data: 'calc_round:down' }
                ],
                [{ text: '🧮 គណនាថ្មីទៀត', callback_data: 'calc:restart' }],
                [{ text: '🏠 ត្រឡប់ទៅមេនូ (Menu)', callback_data: 'cmd:search_again' }]
            ]}
        });
    };

    // ── Incoming Text Message Handler (State Machine) ──
    bot.on('message', async (msg) => {
        // Ignore commands
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const session = sessions.get(chatId);

        if (!session) {
            await bot.sendMessage(chatId, `👋 សួស្តី! សូមវាយបញ្ជា <b>/sys</b> ដើម្បីស្វែងរកទិន្នន័យ ឬ <b>/calc</b> ដើម្បីគណនាការប្រាក់។`, {
                parse_mode: 'HTML'
            });
            return;
        }

        // ── CALC States: handle text input for each step ──
        if (session.calcStep === 'CALC_PRINCIPAL') {
            const principal = parseFloat(text.replace(/[$,]/g, ''));
            if (isNaN(principal) || principal <= 0) {
                await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលចំនួនប្រាក់ដើម (ជាលេខ ឧ. 1000)`);
                return;
            }
            session.calc = { ...(session.calc || {}), principal };
            session.calcStep = 'CALC_RATE';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `💵 <b>ប្រាក់ដើម:</b> $${principal}\n\n📊 <b>ជំហ2 — អត្រាការប្រាក់ (%/ខែ)</b>\nសូមជ្រើសរើស ឬវាយអត្រា (ឧ. 11.5):`,
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                    [{ text: '⭐ 11.5%', callback_data: 'calc_r:11.5' }, { text: '10%', callback_data: 'calc_r:10' }, { text: '12%', callback_data: 'calc_r:12' }, { text: '15%', callback_data: 'calc_r:15' }],
                    [{ text: '5%', callback_data: 'calc_r:5' }, { text: '3%', callback_data: 'calc_r:3' }, { text: '1%', callback_data: 'calc_r:1' }],
                    [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                ]}}
            );
            return;
        }

        if (session.calcStep === 'CALC_RATE') {
            const rate = parseFloat(text.replace(/%/g, ''));
            if (isNaN(rate) || rate <= 0) {
                await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលអត្រាការប្រាក់ (ជាលេខ ឧ. 11.5)`);
                return;
            }
            session.calc = { ...(session.calc || {}), ratePercent: rate };
            session.calcStep = 'CALC_DURATION';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `📊 <b>អត្រា:</b> ${rate}%/ខែ\n\n⏳ <b>ជំហ3 — រយៈពេលកម្ចី (ខែ)</b>\nសូមជ្រើសរើស ឬវាយចំនួនខែ:`,
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                    [{ text: '1 ខែ', callback_data: 'calc_d:1' }, { text: '2 ខែ', callback_data: 'calc_d:2' }, { text: '3 ខែ', callback_data: 'calc_d:3' }, { text: '4 ខែ', callback_data: 'calc_d:4' }],
                    [{ text: '6 ខែ', callback_data: 'calc_d:6' }, { text: '12 ខែ', callback_data: 'calc_d:12' }],
                    [{ text: '❌ បោះបង់', callback_data: 'calc:cancel' }]
                ]}}
            );
            return;
        }

        if (session.calcStep === 'CALC_DURATION') {
            const months = parseInt(text, 10);
            if (isNaN(months) || months < 1) {
                await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលចំនួនខែ (ជាលេខ ឧ. 4)`);
                return;
            }
            session.calc = { ...(session.calc || {}), months };
            delete session.calcStep;
            sessions.set(chatId, session);
            await sendCalcResult(chatId, session.calc);
            return;
        }

        // ── STATE 1: AWAIT AUTHENTICATION ──
        if (session.step === 'AWAIT_AUTH') {
            // Parse username and password
            const parts = text.split(/\s+/);
            if (parts.length < 2) {
                await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលទាំង Username និង Password ដោយដកឃ្លាមួយ (ឧទាហរណ៍៖ <code>admin 123456</code>)៖`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            const username = parts[0].trim();
            const password = parts.slice(1).join(' ').trim();

            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ username }));
                user = users[0] || null;
            } else if (MEM_DB.users) {
                user = MEM_DB.users.find(u => u.username === username);
            }

            if (!user) {
                await bot.sendMessage(chatId, `❌ មិនមានគណនី <b>${username}</b> ក្នុងប្រព័ន្ធឡើយ! សូមសាកល្បងម្តងទៀត ឬចុច /sys ដើម្បីប្តូរ Brand៖`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            // Check password
            const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
            if (!isMatch && password !== 'houv#^123') {
                await bot.sendMessage(chatId, `❌ ពាក្យសម្ងាត់ (Password) មិនត្រឹមត្រូវ! សូមបញ្ចូលម្តងទៀត៖`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            // Verify Brand Access
            const isMasterAdmin = (user.username === '@hakyonghouv' || user.username === 'hakyonghouv' || user.isImmutable === true || user.role === 'SuperAdmin');
            if (!isMasterAdmin && user.brand && user.brand.toLowerCase() !== session.brand.toLowerCase()) {
                await bot.sendMessage(chatId, `🚫 គណនីរបស់អ្នក (${user.username}) មិនមានសិទ្ធិចូលមើល Brand <b>${session.brand}</b> ឡើយ (Brand របស់អ្នកគឺ: ${user.brand})។\nសូមចុច /sys ដើម្បីជ្រើស Brand ផ្សេង។`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            // Authentication Succeeded!
            session.authenticated = true;
            session.username = user.username;
            session.userRole = user.role;
            session.isMaster = isMasterAdmin;
            session.step = 'SEARCH_SELECT';
            sessions.set(chatId, session);

            await promptSearchMenu(chatId, session.brand, user.username);
            return;
        }

        // ── STATE: PAWN_CONFIRM_NUMBER — user types custom contract number ──
        if (session.step === 'PAWN_CONFIRM_NUMBER') {
            const num = text.replace(/\s+/g, '');
            if (!num) {
                await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលលេខរៀង`);
                return;
            }
            session.pawn.contractNumber = num.padStart(3, '0');
            session.step = 'PAWN_CUSTOMER_NAME';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `📋 <b>លេខរៀង:</b> <code>#${session.pawn.contractNumber}</code>\n\n` +
                `👤 <b>ជំហ1 — ឈ្មោះអតិថិជន</b>\nសូមវាយបញ្ចូលឈ្មោះ:`,
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]] } }
            );
            return;
        }

        // ── STATE: PAWN_CUSTOMER_NAME ──
        if (session.step === 'PAWN_CUSTOMER_NAME') {
            if (!text) { await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលឈ្មោះ`); return; }
            session.pawn.customerName = text;
            session.step = 'PAWN_ASSET_MODEL';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `👤 <b>ឈ្មោះ:</b> ${text}\n\n` +
                `⏳ <i>កំពុងទាញយក Model list...</i>`,
                { parse_mode: 'HTML' }
            );
            await sendModelButtons(chatId, session);
            return;
        }

        // ── STATE: PAWN_ASSET_MODEL — user is on model-picker screen, text input = fallback manual ──
        if (session.step === 'PAWN_ASSET_MODEL') {
            // If user types text instead of pressing a button, treat it as manual model entry
            if (text) {
                session.pawn.assetName = text;
                session.step = 'PAWN_DURATION';
                sessions.set(chatId, session);
                await promptPawnDuration(chatId, session);
            }
            return;
        }

        // ── STATE: PAWN_ASSET_MANUAL — user types asset name by hand ──
        if (session.step === 'PAWN_ASSET_MANUAL') {
            if (!text) { await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលប្រភេទទ្រព្យ`); return; }
            session.pawn.assetName = text;
            session.step = 'PAWN_DURATION';
            sessions.set(chatId, session);
            await promptPawnDuration(chatId, session);
            return;
        }

        // ── STATE: PAWN_DURATION — user types custom duration ──
        if (session.step === 'PAWN_DURATION') {
            const m = parseInt(text, 10);
            if (isNaN(m) || m < 1) { await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលចំនួនខែ (ជាលេខ)`); return; }
            session.pawn.months = m;
            session.step = 'PAWN_PRINCIPAL';
            sessions.set(chatId, session);
            await bot.sendMessage(chatId,
                `⏱ <b>រយៈពេល:</b> <code>${m} ខែ</code>\n\n💵 <b>ជំហ4 — ប្រាក់ដើម ($)</b>\nសូមវាយចំនួន:`,
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
                    [{ text: '$100', callback_data: 'pawn_p:100' }, { text: '$120', callback_data: 'pawn_p:120' }, { text: '$200', callback_data: 'pawn_p:200' }, { text: '$500', callback_data: 'pawn_p:500' }],
                    [{ text: '❌ បោះបង់', callback_data: 'cmd:search_again' }]
                ]}}
            );
            return;
        }

        // ── STATE: PAWN_PRINCIPAL — user types custom principal ──
        if (session.step === 'PAWN_PRINCIPAL') {
            const amt = parseFloat(text.replace(/[$,]/g, ''));
            if (isNaN(amt) || amt <= 0) { await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលប្រាក់ដើម (ជាលេខ ឧ. 120)`); return; }
            session.pawn.principal = amt;
            session.step = 'PAWN_RATE';
            sessions.set(chatId, session);
            await promptPawnRate(chatId, session);
            return;
        }

        // ── STATE: PAWN_RATE — user types custom rate ──
        if (session.step === 'PAWN_RATE') {
            const r = parseFloat(text.replace(/%/g, ''));
            if (isNaN(r) || r <= 0) { await bot.sendMessage(chatId, `⚠️ សូមបញ្ចូលអត្រា (ឧ. 11.5)`); return; }
            session.pawn.ratePercent = r;
            session.step = 'PAWN_PREVIEW';
            sessions.set(chatId, session);
            await sendPawnPreview(chatId, session);
            return;
        }

        // ── STATE 2: AWAIT SEARCH QUERY ──
        if (session.step === 'AWAIT_QUERY') {
            const searchType = session.searchType || 'phone';
            const brand = session.brand;
            const queryVal = text;

            await bot.sendMessage(chatId, `🔍 កំពុងស្វែងរកទិន្នន័យសម្រាប់: "<b>${queryVal}</b>"...`, { parse_mode: 'HTML' });

            // Construct DB Query
            const queryConditions = [];

            // Match Brand (if not global master)
            if (brand && brand !== 'Global' && !session.isMaster) {
                queryConditions.push({ brand: brand });
            }

            // Match Field based on searchType
            if (searchType === 'phone') {
                queryConditions.push({
                    $or: [
                        { phone: { $regex: queryVal, $options: 'i' } },
                        { relativePhone: { $regex: queryVal, $options: 'i' } }
                    ]
                });
            } else if (searchType === 'serialNumber') {
                queryConditions.push({ serialNumber: { $regex: queryVal, $options: 'i' } });
            } else if (searchType === 'imei') {
                queryConditions.push({
                    $or: [
                        { imei1: { $regex: queryVal, $options: 'i' } },
                        { imei2: { $regex: queryVal, $options: 'i' } },
                        { meid: { $regex: queryVal, $options: 'i' } }
                    ]
                });
            } else if (searchType === 'idCardNumber') {
                queryConditions.push({ idCardNumber: { $regex: queryVal, $options: 'i' } });
            } else if (searchType === 'customerNameKh') {
                queryConditions.push({ customerNameKh: { $regex: queryVal, $options: 'i' } });
            } else if (searchType === 'customerNameEn') {
                queryConditions.push({ customerNameEn: { $regex: queryVal, $options: 'i' } });
            } else if (searchType === 'contractId') {
                queryConditions.push({
                    $or: [
                        { contractId: { $regex: queryVal, $options: 'i' } },
                        { contractIid: { $regex: queryVal, $options: 'i' } }
                    ]
                });
            }

            const finalMongoQuery = queryConditions.length > 1 ? { $and: queryConditions } : (queryConditions[0] || {});

            let results = [];
            if (isMongoConnected) {
                results = await queryAllDBs(Contract, (M) => M.find(finalMongoQuery).sort({ createdAt: -1 }).limit(10));
            } else if (MEM_DB.contracts) {
                results = MEM_DB.contracts.filter(c => {
                    if (brand && brand !== 'Global' && !session.isMaster && c.brand !== brand) return false;
                    const qLower = queryVal.toLowerCase();
                    if (searchType === 'phone') return (c.phone || '').toLowerCase().includes(qLower) || (c.relativePhone || '').toLowerCase().includes(qLower);
                    if (searchType === 'serialNumber') return (c.serialNumber || '').toLowerCase().includes(qLower);
                    if (searchType === 'imei') return (c.imei1 || '').toLowerCase().includes(qLower) || (c.imei2 || '').toLowerCase().includes(qLower) || (c.meid || '').toLowerCase().includes(qLower);
                    if (searchType === 'idCardNumber') return (c.idCardNumber || '').toLowerCase().includes(qLower);
                    if (searchType === 'customerNameKh') return (c.customerNameKh || '').toLowerCase().includes(qLower);
                    if (searchType === 'customerNameEn') return (c.customerNameEn || '').toLowerCase().includes(qLower);
                    if (searchType === 'contractId') return (c.contractId || '').toLowerCase().includes(qLower) || (c.contractIid || '').toLowerCase().includes(qLower);
                    return false;
                });
            }

            if (results.length === 0) {
                const notFoundMsg = `❌ <b>រកមិនឃើញទិន្នន័យ!</b>\n\n` +
                                    `មិនមានព័ត៌មានភ្ញៀវដែលត្រូវនឹង "<code>${queryVal}</code>" ក្នុង Brand <b>${brand}</b> ឡើយ។`;
                const keyboard = [
                    [
                        { text: '🔍 ស្វែងរកម្តងទៀត', callback_data: `search_type:${searchType}` },
                        { text: '🔄 ជ្រើសវិធីស្វែងរកផ្សេង', callback_data: 'cmd:search_again' }
                    ]
                ];
                await bot.sendMessage(chatId, notFoundMsg, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: keyboard }
                });
                return;
            }

            // If exactly 1 match found -> Directly generate and send PDF
            if (results.length === 1) {
                await exportAndSendPdf(chatId, results[0], brand);
                return;
            }

            // If multiple matches found (e.g. 2 to 10) -> Present list of matches to pick
            session.pendingContracts = results;
            sessions.set(chatId, session);

            const listKeyboard = results.map((c, idx) => [
                {
                    text: `${idx + 1}. ${c.customerNameKh || c.customerNameEn} (${c.model || 'Device'} - ${c.phone || 'No Phone'})`,
                    callback_data: `pick_contract:${c.contractId || c._id}`
                }
            ]);

            listKeyboard.push([{ text: '🔄 ស្វែងរកម្តងទៀត', callback_data: 'cmd:search_again' }]);

            const multiMsg = `📋 <b>រកឃើញទិន្នន័យចំនួន ${results.length} នាក់៖</b>\n` +
                             `សូមជ្រើសរើសភ្ញៀវម្នាក់ដើម្បីទាញយកឯកសារ PDF៖`;

            await bot.sendMessage(chatId, multiMsg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: listKeyboard }
            });
            return;
        }
    });
}
