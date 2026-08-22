import React, { useState, useEffect, useRef } from 'react';
import { FaAngleDoubleRight, FaSearch, FaUserCheck } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { useAuth } from '../../../context/AuthContext';
import DocumentScanner from '../../../components/DocumentScanner';

/* ── Autocomplete field with suggestions dropdown ── */
const AutoField = ({ id, label, value, onChange, placeholder, list, onSelect, inputClass = '', font = '' }) => {
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const ref = useRef(null);

    const filtered = list.filter(item => {
        const val = typeof item === 'string' ? item : item[id] || '';
        return val && String(val).toLowerCase().includes(String(value).toLowerCase()) && String(val).toLowerCase() !== String(value).toLowerCase();
    }).slice(0, 8);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const show = focused && filtered.length > 0 && value.length >= 1;

    return (
        <div ref={ref} className="flex flex-col gap-1 relative">
            <label htmlFor={id} className="font-semibold text-gray-400 text-xs">{label}</label>
            <input
                className={`w-full p-2.5 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl text-gray-100 outline-none transition-colors text-xs ${font} ${inputClass}`}
                type="text" id={id} value={value}
                onChange={e => { onChange(e); setOpen(true); }}
                onFocus={() => { setFocused(true); setOpen(true); }}
                onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); }, 200)}
                placeholder={placeholder}
                autoComplete="off"
            />
            {show && (
                <div className="absolute left-0 top-full mt-1 w-full bg-gray-900 border border-indigo-600 rounded-xl shadow-2xl z-[99999] overflow-hidden">
                    <div className="px-3 py-1.5 bg-indigo-950/60 border-b border-indigo-800 flex items-center gap-1.5 text-[10px] text-indigo-300 font-bold uppercase">
                        <FaUserCheck className="text-indigo-400" /> ទិន្នន័យដែលមានស្រាប់ ({filtered.length})
                    </div>
                    <ul className="max-h-44 overflow-y-auto divide-y divide-gray-800/60">
                        {filtered.map((item, i) => {
                            const displayVal = typeof item === 'string' ? item : item[id] || '';
                            const sub = typeof item === 'object' ? [item.customerNameKh, item.phone].filter(Boolean).join(' • ') : '';
                            return (
                                <li key={i}
                                    onMouseDown={() => { onSelect(item); setOpen(false); }}
                                    className="px-3 py-2 hover:bg-indigo-900/50 cursor-pointer transition-colors">
                                    <span className="text-gray-100 font-bold text-xs">{displayVal}</span>
                                    {sub && <span className="text-gray-400 text-[10px] ml-1.5">({sub})</span>}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

/* ── Main CreateApplication ── */
const CreateApplication = ({ open, setOpen, editData, onSaved }) => {
    const { API_BASE, user } = useAuth();

    const emptyForm = {
        inputDate: new Date().toISOString().split('T')[0],
        brand: user?.brand || '',
        customerNameEn: '', customerNameKh: '',
        idCardNumber: '', dob: '', gender: 'male',
        birthAddress: '', currentAddress: '',
        phone: '', relativePhone: '',
        facebookName: '', telegramName: '', urlFb: '', mosyleUrl: '',
        customerPhoto: '', googleDrivePhotoUrl: '',
        model: '', serialNumber: '', imei1: '', imei2: '', color: '', version: '',
        amount: 1000, interest: '14%', adminFee: 20, duration: '12 Months',
        interestType: '14%', monthlyPayment: 100
    };

    const [form, setForm] = useState(emptyForm);
    const [brandsList, setBrandsList] = useState([]);
    const [modelsList, setModelsList] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [allCustomers, setAllCustomers] = useState([]);   // for autocomplete
    const [autoFilled, setAutoFilled] = useState(false);    // flag: record was auto-filled

    // ── Fetch global brands ──
    useEffect(() => {
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d => d.category === 'Brands');
                    if (cat) setBrandsList(cat.items || []);
                }
            } catch { }
        };
        go();
    }, [API_BASE]);

    // ── Fetch existing customers for autocomplete ──
    useEffect(() => {
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE}/contracts?limit=500`);
                if (res.ok) {
                    const data = await res.json();
                    const list = data.data || data.contracts || data || [];
                    // deduplicate by idCardNumber or customerNameEn
                    const seen = new Set();
                    const unique = list.filter(c => {
                        const key = c.idCardNumber || c.customerNameEn || c._id;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                    setAllCustomers(unique);
                }
            } catch { }
        };
        if (open) go();
    }, [API_BASE, open]);

    // ── Live Session & Real-time Scan Listener from Mobile App ──
    useEffect(() => {
        if (!open) return;

        // Register session start on backend
        fetch(`${API_BASE}/phone-app/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
        }).catch(() => {});

        // Poll for real-time document scan pushed from Phone App
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/phone-app/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.latestScannedDoc) {
                        const doc = data.latestScannedDoc;
                        setForm(prev => ({
                            ...prev,
                            customerNameEn: doc.customerNameEn || prev.customerNameEn,
                            customerNameKh: doc.customerNameKh || prev.customerNameKh,
                            idCardNumber: doc.idCardNumber || prev.idCardNumber,
                            dob: doc.dob || prev.dob,
                            gender: doc.gender || prev.gender,
                            birthAddress: doc.birthAddress || prev.birthAddress,
                            currentAddress: doc.currentAddress || prev.currentAddress,
                            deviceModel: doc.modelName || doc.deviceModel || prev.deviceModel,
                            imei1: doc.imei1 || prev.imei1,
                            imei2: doc.imei2 || prev.imei2,
                            brand: doc.brandName || prev.brand
                        }));
                        setAutoFilled(true);

                        // Consume scanned data so it doesn't re-trigger
                        fetch(`${API_BASE}/phone-app/consume-scanned-doc`, { method: 'POST' }).catch(() => {});
                    }
                }
            } catch { }
        }, 1500);

        return () => {
            clearInterval(interval);
            // Notify backend session closed
            fetch(`${API_BASE}/phone-app/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: false })
            }).catch(() => {});
        };
    }, [open, API_BASE]);

    const handleDocumentParsed = (parsed) => {
        if (!parsed) return;
        setForm(prev => ({
            ...prev,
            customerNameEn: parsed.customerNameEn || prev.customerNameEn,
            customerNameKh: parsed.customerNameKh || prev.customerNameKh,
            idCardNumber: parsed.idCardNumber || prev.idCardNumber,
            dob: parsed.dob || prev.dob,
            gender: parsed.gender || prev.gender,
            birthAddress: parsed.birthAddress || prev.birthAddress,
            currentAddress: parsed.currentAddress || prev.currentAddress,
            deviceModel: parsed.modelName || parsed.deviceModel || prev.deviceModel,
            imei1: parsed.imei1 || prev.imei1,
            imei2: parsed.imei2 || prev.imei2,
            brand: parsed.brandName || prev.brand
        }));
        setAutoFilled(true);
    };

    // ── Fetch brand-specific models ──
    useEffect(() => {
        const go = async () => {
            if (!form.brand) return;
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=${form.brand}`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d => d.category === 'Device Models');
                    setModelsList(cat ? cat.items || [] : []);
                }
            } catch { }
        };
        go();
    }, [form.brand, API_BASE]);

    // ── Load editData ──
    useEffect(() => {
        if (editData) {
            setForm({
                inputDate: editData.inputDate || editData.input_date || new Date().toISOString().split('T')[0],
                brand: editData.brand || user?.brand || '',
                customerNameEn: editData.customerNameEn || editData.name_english || '',
                customerNameKh: editData.customerNameKh || editData.name_khmer || '',
                idCardNumber: editData.idCardNumber || editData.id_number || '',
                dob: editData.dob || '',
                gender: editData.gender || 'male',
                birthAddress: editData.birthAddress || editData.birth_address || '',
                currentAddress: editData.currentAddress || editData.current_address || '',
                phone: editData.phone || editData.phone_number || '',
                relativePhone: editData.relativePhone || editData.friend_or_relative_phone_number || '',
                facebookName: editData.facebookName || editData.facebook_name || '',
                telegramName: editData.telegramName || editData.telegram_name || '',
                urlFb: editData.urlFb || editData.url_fb || '',
                mosyleUrl: editData.mosyleUrl || editData.mosyle_url || editData.urlMosyle || editData.mosyleURL || '',
                customerPhoto: editData.customerPhoto || '',
                googleDrivePhotoUrl: editData.googleDrivePhotoUrl || '',
                model: editData.model || editData.device_model || '',
                serialNumber: editData.serialNumber || editData.serial_number || '',
                imei1: editData.imei1 || editData.imei1_number || '',
                imei2: editData.imei2 || editData.imei2_number || '',
                color: editData.color || '',
                version: editData.version || '',
                amount: editData.amount || editData.totalAmount || 1000,
                interest: editData.interest || '14%',
                adminFee: editData.adminFee || 20,
                duration: editData.duration || '12 Months',
                interestType: editData.interestType || '14%',
                monthlyPayment: editData.monthlyPayment || 100
            });
            setAutoFilled(false);
        } else {
            setForm(prev => ({ ...emptyForm, brand: user?.brand || '' }));
            setAutoFilled(false);
        }
    }, [editData, user]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
        if (autoFilled) setAutoFilled(false); // clear badge if user manually edits
    };

    // ── Auto-fill ALL fields from selected existing record ──
    const handleAutoFill = (record) => {
        if (!record || typeof record !== 'object') return;
        setForm({
            inputDate: record.inputDate || record.input_date || new Date().toISOString().split('T')[0],
            brand: record.brand || user?.brand || '',
            customerNameEn: record.customerNameEn || record.name_english || '',
            customerNameKh: record.customerNameKh || record.name_khmer || '',
            idCardNumber: record.idCardNumber || record.id_number || '',
            dob: record.dob || '',
            gender: record.gender || 'male',
            birthAddress: record.birthAddress || record.birth_address || '',
            currentAddress: record.currentAddress || record.current_address || '',
            phone: record.phone || record.phone_number || '',
            relativePhone: record.relativePhone || record.friend_or_relative_phone_number || '',
            facebookName: record.facebookName || record.facebook_name || '',
            telegramName: record.telegramName || record.telegram_name || '',
            urlFb: record.urlFb || record.url_fb || '',
            mosyleUrl: record.mosyleUrl || record.mosyle_url || record.urlMosyle || record.mosyleURL || '',
            customerPhoto: record.customerPhoto || '',
            googleDrivePhotoUrl: record.googleDrivePhotoUrl || '',
            // Device info
            model: record.model || record.device_model || '',
            serialNumber: record.serialNumber || record.serial_number || '',
            imei1: record.imei1 || record.imei1_number || '',
            imei2: record.imei2 || record.imei2_number || '',
            color: record.color || '',
            version: record.version || '',
            // Loan info
            amount: record.amount || record.totalAmount || 1000,
            interest: record.interest || '14%',
            adminFee: record.adminFee || 20,
            duration: record.duration || '12 Months',
            interestType: record.interestType || '14%',
            monthlyPayment: record.monthlyPayment || 100,
        });
        setAutoFilled(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const isAdmin = user?.role === 'Administrator' || user?.username === '@hakyonghouv';
        const payload = {
            ...form,
            customerPhoto: form.googleDrivePhotoUrl || form.customerPhoto,
            mosyleUrl: form.mosyleUrl || '',
            inputDate: form.inputDate || editData?.inputDate || new Date().toISOString().split('T')[0],
            status: editData?.status || 'Application',
            monthlyPayment: Number(form.monthlyPayment) || (Number(form.amount) / 10),
            modifiedByAdmin: isAdmin ? true : Boolean(editData?.modifiedByAdmin),
            lastModifiedBy: isAdmin ? (user?.name || 'Administrator') : (editData?.lastModifiedBy || '')
        };
        try {
            const url = editData ? `${API_BASE}/contracts/${editData._id}` : `${API_BASE}/contracts`;
            const method = editData ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setSubmitting(false);
            if (res.ok) { setOpen(false); if (onSaved) onSaved(); }
            else alert('Failed to save contract');
        } catch (err) {
            setSubmitting(false);
            console.error('Save contract error:', err);
        }
    };

    if (!open) return null;

    return (
        <div className="w-[calc(100%-260px)] h-[88vh] overflow-auto absolute right-0 top-[7vh] bg-gray-900 border border-gray-700 z-[99999] shadow-2xl p-4">
            <form onSubmit={handleSubmit}>
                {/* ── Form Header ── */}
                <div className='flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-t-2xl'>
                    <div>
                        <h3 className='text-base font-bold text-gray-100 flex items-center gap-2'>
                            {editData ? 'Edit Application Contract' : 'Create Application Contract'}
                            {autoFilled && (
                                <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-900/60 border border-indigo-600 text-indigo-300 rounded-full text-[10px] font-bold uppercase">
                                    <FaUserCheck className="text-xs" /> Auto-filled from existing record
                                </span>
                            )}
                        </h3>
                        <p className='text-xs text-gray-400 mt-0.5'>Enter Customer, Device, and Loan Information — ទិន្ន័យត្រូវបានរក្សាទុកក្នុង MongoDB</p>
                    </div>
                    <div className='flex gap-3'>
                        <button type="button" onClick={() => setOpen(false)}
                            className='px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5'>
                            <MdClose /> Cancel
                        </button>
                        <button type="submit" disabled={submitting}
                            className='px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/30 transition-all'>
                            {submitting ? 'Saving...' : 'Submit Contract'}
                        </button>
                    </div>
                </div>

                <div className='p-4 w-full h-[75vh] overflow-y-auto space-y-6 text-xs text-gray-200'>

                    {/* ── Document Scanner (Drag & Drop ID Card / Passport) ── */}
                    <DocumentScanner onParsedData={handleDocumentParsed} />

                    {/* ── Section 1: Customer Information ── */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-indigo-400 mb-2'>
                            <FaAngleDoubleRight /> Customer Information
                            <span className='text-[10px] text-indigo-300 font-normal ml-2 opacity-80'>
                                (វាយឈ្មោះ/លេខទូរស័ព្ទ/ID — វានឹងបង្ហាញការណែនាំ)
                            </span>
                        </h2>
                        <hr className='border-gray-800 mb-4' />

                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>

                            {/* Name EN — with autocomplete */}
                            <AutoField
                                id="customerNameEn" label="Name English *" value={form.customerNameEn}
                                placeholder="Name English"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            {/* Name KH — with autocomplete */}
                            <AutoField
                                id="customerNameKh" label="Name Khmer *" value={form.customerNameKh}
                                placeholder="Name Khmer" font="font-khmer"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            {/* ID Card — with autocomplete */}
                            <AutoField
                                id="idCardNumber" label="ID Number" value={form.idCardNumber}
                                placeholder="ID Number" font="font-mono"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            <div className="flex flex-col gap-1">
                                <label htmlFor="dob" className="font-semibold text-gray-400">Date of Birth</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500"
                                    type="date" id="dob" value={form.dob} onChange={handleChange} />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="gender" className="font-semibold text-gray-400">Gender</label>
                                <select className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none"
                                    id="gender" value={form.gender} onChange={handleChange}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="brand" className="font-semibold text-gray-400">Brand (ម៉ាក)</label>
                                <select id="brand" value={form.brand} onChange={handleChange}
                                    disabled={user?.role !== 'Administrator'}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-semibold text-xs disabled:opacity-60 outline-none">
                                    <option value="">Select Brand</option>
                                    {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="birthAddress" className="font-semibold text-gray-400">Birth Address</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="birthAddress" value={form.birthAddress} onChange={handleChange} placeholder="Birth address" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="currentAddress" className="font-semibold text-gray-400">Current Address</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="currentAddress" value={form.currentAddress} onChange={handleChange} placeholder="Current address" />
                            </div>

                            {/* Phone — with autocomplete */}
                            <AutoField
                                id="phone" label="Phone Number" value={form.phone}
                                placeholder="Phone number" font="font-mono"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            <div className="flex flex-col gap-1">
                                <label htmlFor="relativePhone" className="font-semibold text-gray-400">Relative Phone</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500"
                                    type="text" id="relativePhone" value={form.relativePhone} onChange={handleChange} placeholder="Relative phone" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="facebookName" className="font-semibold text-gray-400">Facebook Name</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="facebookName" value={form.facebookName} onChange={handleChange} placeholder="Facebook Name" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="telegramName" className="font-semibold text-gray-400">Telegram Name</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="telegramName" value={form.telegramName} onChange={handleChange} placeholder="Telegram Name" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="urlFb" className="font-semibold text-gray-400">URL Facebook</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="urlFb" value={form.urlFb} onChange={handleChange} placeholder="URL Facebook" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="mosyleUrl" className="font-semibold text-gray-400">URL Mosyle</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500"
                                    type="text" id="mosyleUrl" value={form.mosyleUrl} onChange={handleChange} placeholder="https://" />
                            </div>

                            <div className="flex flex-col gap-1 col-span-2">
                                <label htmlFor="googleDrivePhotoUrl" className="font-semibold text-amber-400">Photo URL (Google Drive / Image Link)</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-amber-600/50 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-amber-500"
                                    type="text" id="googleDrivePhotoUrl" value={form.googleDrivePhotoUrl} onChange={handleChange}
                                    placeholder="https://drive.google.com/uc?export=view&id=..." />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Device Information ── */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-purple-400 mb-2'>
                            <FaAngleDoubleRight /> Device Information
                        </h2>
                        <hr className='border-gray-800 mb-4' />
                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="model" className="font-semibold text-gray-400">Device Model (ម៉ូដែលទូរស័ព្ទ)</label>
                                <select id="model" value={form.model} onChange={handleChange} required
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-semibold text-xs outline-none">
                                    <option value="">Select Device Model</option>
                                    {modelsList.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                                    {form.model && !modelsList.includes(form.model) && <option value={form.model}>{form.model}</option>}
                                </select>
                            </div>

                            {/* Serial Number — with autocomplete */}
                            <AutoField
                                id="serialNumber" label="Serial Number *" value={form.serialNumber}
                                placeholder="Serial Number" font="font-mono"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            {/* IMEI1 — with autocomplete */}
                            <AutoField
                                id="imei1" label="IMEI1 Number" value={form.imei1}
                                placeholder="IMEI1 Number" font="font-mono"
                                list={allCustomers}
                                onChange={handleChange}
                                onSelect={handleAutoFill}
                            />

                            <div className="flex flex-col gap-1">
                                <label htmlFor="imei2" className="font-semibold text-gray-400">IMEI2 Number</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500"
                                    type="text" id="imei2" value={form.imei2} onChange={handleChange} placeholder="IMEI2 Number" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="color" className="font-semibold text-gray-400">Color</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="color" value={form.color} onChange={handleChange} placeholder="Color" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="version" className="font-semibold text-gray-400">Version</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="version" value={form.version} onChange={handleChange} placeholder="Version" />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 3: Loan & Financial Terms ── */}
                    <div>
                        <h2 className='flex items-center gap-2 text-sm font-bold text-emerald-400 mb-2'>
                            <FaAngleDoubleRight /> Loan & Financial Terms
                        </h2>
                        <hr className='border-gray-800 mb-4' />
                        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="inputDate" className="font-semibold text-indigo-300">កាលបរិច្ឆេទស្នើកម្ចី *</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-indigo-600/70 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500 font-bold"
                                    type="date" id="inputDate" value={form.inputDate} onChange={handleChange} required />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="amount" className="font-semibold text-gray-400">Total Amount</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="number" id="amount" value={form.amount} onChange={handleChange} placeholder="Amount" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="monthlyPayment" className="font-semibold text-gray-400">Customer Received Amount</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="number" id="monthlyPayment" value={form.monthlyPayment} onChange={handleChange} placeholder="Monthly Payment" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="interest" className="font-semibold text-gray-400">Interest Rate</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 font-mono text-xs outline-none focus:border-indigo-500"
                                    type="text" id="interest" value={form.interest} onChange={handleChange} placeholder="Interest" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="duration" className="font-semibold text-gray-400">Duration</label>
                                <input className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-xs outline-none focus:border-indigo-500"
                                    type="text" id="duration" value={form.duration} onChange={handleChange} placeholder="Duration" />
                            </div>
                        </div>
                    </div>

                </div>
            </form>
        </div>
    );
};

export default CreateApplication;
