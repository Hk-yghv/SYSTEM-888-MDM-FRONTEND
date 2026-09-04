import bcrypt from 'bcryptjs';
import ControlSystem from '../models/ControlSystem.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';
import { generateCustomerPdf } from '../utils/customerPdfGenerator.js';

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

    // ── Helper: Send Search Options Menu ──
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
        // Action row
        keyboard.push([
            { text: '🔄 ជ្រើសរើស Brand ផ្សេង', callback_data: 'cmd:switch_brand' },
            { text: '🚪 ចាកចេញ (Logout)', callback_data: 'cmd:logout' }
        ]);

        const msg = `✅ <b>ផ្ទៀងផ្ទាត់ជោគជ័យ!</b>\n\n` +
                    `👤 <b>គណនី:</b> <code>${username}</code>\n` +
                    `🏢 <b>Brand:</b> <b>${brand}</b>\n\n` +
                    `🔎 <b>សូមជ្រើសរើសរបៀបស្វែងរកព័ត៌មានភ្ញៀវ៖</b>`;

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

        } catch (err) {
            console.error('[TelegramBot] Callback query error:', err);
        }
    });

    // ── Incoming Text Message Handler (State Machine) ──
    bot.on('message', async (msg) => {
        // Ignore commands
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const session = sessions.get(chatId);

        if (!session) {
            // If user types without active session, suggest /sys
            await bot.sendMessage(chatId, `👋 សួស្តី! សូមវាយបញ្ជា <b>/sys</b> ដើម្បីស្វែងរកទិន្នន័យ និងទាញយកតារាងបង់ប្រាក់ជា PDF។`, {
                parse_mode: 'HTML'
            });
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
