import React, { useState, useEffect, useRef } from 'react';
import { FaUserCheck, FaUser, FaMobileAlt, FaDollarSign } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { useAuth } from '../../../context/AuthContext';
import DocumentScanner from '../../../components/DocumentScanner';
import { formatIMEI } from '../../../utils/imeiFormatter';


/* ── Shared style tokens ── */
const inp = "w-full p-2 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100 text-xs outline-none transition-colors";
const sel = "w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-gray-100 text-xs outline-none";

/* ── Autocomplete field with suggestions dropdown ── */
const AutoField = ({ id, label, value, onChange, placeholder, list = [], onSelect, font = '' }) => {
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const ref = useRef(null);

    const filtered = (list || []).filter(item => {
        const val = typeof item === 'string' ? item : item[id] || '';
        return val && String(val).toLowerCase().includes(String(value || '').toLowerCase()) && String(val).toLowerCase() !== String(value || '').toLowerCase();
    }).slice(0, 8);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const show = focused && filtered.length > 0 && (value || '').length >= 1;

    return (
        <div ref={ref} className="flex flex-col gap-1 relative">
            <label htmlFor={id} className="font-semibold text-gray-400 text-[11px]">{label}</label>
            <input
                className={`${inp} ${font}`}
                type="text" id={id} value={value || ''}
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
                    <ul className="max-h-40 overflow-y-auto divide-y divide-gray-800/60">
                        {filtered.map((item, i) => {
                            const displayVal = typeof item === 'string' ? item : item[id] || '';
                            const sub = typeof item === 'object' ? [item.customerNameKh, item.phone].filter(Boolean).join(' • ') : '';
                            return (
                                <li key={i} onMouseDown={() => { onSelect(item); setOpen(false); }}
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

/* ── Field wrapper ── */
const Field = ({ label, children, accent = false }) => (
    <div className="flex flex-col gap-1">
        <label className={`font-semibold text-[11px] ${accent ? 'text-amber-400' : 'text-gray-400'}`}>{label}</label>
        {children}
    </div>
);

/* ══════════════════════════════════════════
   Main CreateApplication Component
══════════════════════════════════════════ */
const CreateApplication = ({ open, setOpen, editData, onSaved }) => {
    const { API_BASE, API_BASE1, user } = useAuth();

    const emptyForm = {
        inputDate: new Date().toISOString().split('T')[0],
        brand: user?.brand || '',
        customerNameEn: '', customerNameKh: '',
        idCardNumber: '', dob: '', gender: 'male',
        birthAddress: '', currentAddress: '',
        phone: '', relativePhone: '',
        facebookName: '', telegramName: '', urlFb: '', mosyleUrl: '',
        customerPhoto: '', googleDrivePhotoUrl: '',
        model: '', serialNumber: '', imei1: '', imei2: '', meid: '', color: '', version: '',
        deviceProblem: '', capacity: '',
        amount: 1000, interest: '14%', adminFee: 20, duration: '12 Months',
        interestType: '14%', monthlyPayment: 100
    };

    const [form, setForm] = useState(emptyForm);
    const [brandsList, setBrandsList] = useState([]);
    const [modelsList, setModelsList] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [allCustomers, setAllCustomers] = useState([]);
    const [autoFilled, setAutoFilled] = useState(false);
    const [activeTab, setActiveTab] = useState('customer');
    const [photoUploading, setPhotoUploading] = useState(false);
    const photoFileRef = useRef(null);

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

    useEffect(() => {
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE1}/contracts?limit=500`);
                if (res.ok) {
                    const data = await res.json();
                    const list = data.data || data.contracts || data || [];
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
        go();
    }, [API_BASE1]);

    useEffect(() => {
        const go = async () => {
            try {
                const targetBrand = form.brand || user?.brand || '';
                const res = await fetch(`${API_BASE}/controlsystem?brand=${targetBrand}`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d =>
                        d.category === 'Device Models' ||
                        d.category === 'Devices' ||
                        d.category === 'Models'
                    );
                    if (cat && Array.isArray(cat.items) && cat.items.length > 0) {
                        setModelsList(cat.items);
                        return;
                    }
                }

                // Fallback to Global models if brand has no custom models
                const globalRes = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (globalRes.ok) {
                    const gData = await globalRes.json();
                    const gCat = gData.droplists?.find(d =>
                        d.category === 'Device Models' ||
                        d.category === 'Devices' ||
                        d.category === 'Models'
                    );
                    if (gCat && Array.isArray(gCat.items)) {
                        setModelsList(gCat.items);
                    }
                }
            } catch (err) {
                console.error('Fetch device models error:', err);
            }
        };
        go();
    }, [form.brand, user?.brand, API_BASE]);


    useEffect(() => {
        if (!open) return;
        fetch(`${API_BASE}/phone-app/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
        }).catch(() => { });

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/phone-app/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.scannedDoc && typeof data.scannedDoc === 'object') {
                        const doc = data.scannedDoc;
                        if (doc.customerNameEn || doc.idCardNumber) {
                            setForm(prev => ({ ...prev, ...doc }));
                            setAutoFilled(true);
                            fetch(`${API_BASE}/phone-app/consume-scanned-doc`, { method: 'POST' }).catch(() => { });
                        }
                    }
                }
            } catch { }
        }, 3000);

        return () => {
            clearInterval(interval);
            fetch(`${API_BASE}/phone-app/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: false })
            }).catch(() => { });
        };
    }, [open, API_BASE]);

    useEffect(() => {
        if (open) {
            if (editData) {
                setForm({
                    ...emptyForm,
                    ...editData,
                    deviceProblem: editData.deviceProblem || editData.device_problem || editData.Device_Problem || '',
                    capacity: editData.capacity || editData.storage || editData.Storage || '',
                    urlFb: editData.urlFb || editData.url_fb || editData.facebookUrl || '',
                    mosyleUrl: editData.mosyleUrl || editData.mosyle_url || editData.urlMosyle || '',
                    googleDrivePhotoUrl: editData.googleDrivePhotoUrl || editData.customerPhoto || editData.photoUrl || editData.photo_url || '',
                    customerPhoto: editData.customerPhoto || editData.googleDrivePhotoUrl || editData.photoUrl || '',
                    color: editData.color || '',
                    version: editData.version || '',
                    meid: editData.meid || '',
                });
            } else {
                setForm({ ...emptyForm, brand: user?.brand || '' });
            }
            setAutoFilled(false);
            setActiveTab('customer');
        }
    }, [open, editData]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
    };

    const handleAutoFill = (item) => {
        if (typeof item === 'object') {
            setForm(prev => ({
                ...prev,
                customerNameEn: item.customerNameEn || prev.customerNameEn,
                customerNameKh: item.customerNameKh || prev.customerNameKh,
                idCardNumber: item.idCardNumber || prev.idCardNumber,
                dob: item.dob || prev.dob,
                gender: item.gender || prev.gender,
                birthAddress: item.birthAddress || prev.birthAddress,
                currentAddress: item.currentAddress || prev.currentAddress,
                phone: item.phone || prev.phone,
                relativePhone: item.relativePhone || prev.relativePhone,
                facebookName: item.facebookName || prev.facebookName,
                telegramName: item.telegramName || prev.telegramName,
                urlFb: item.urlFb || item.url_fb || prev.urlFb,
                mosyleUrl: item.mosyleUrl || item.mosyle_url || prev.mosyleUrl,
                googleDrivePhotoUrl: item.googleDrivePhotoUrl || item.customerPhoto || prev.googleDrivePhotoUrl,
                customerPhoto: item.customerPhoto || item.googleDrivePhotoUrl || prev.customerPhoto,
                model: item.model || prev.model,
                serialNumber: item.serialNumber || prev.serialNumber,
                imei1: item.imei1 || prev.imei1,
                imei2: item.imei2 || prev.imei2,
                meid: item.meid || prev.meid,
                color: item.color || prev.color,
                version: item.version || prev.version,
                deviceProblem: item.deviceProblem || item.device_problem || prev.deviceProblem,
                capacity: item.capacity || item.storage || prev.capacity,
            }));
            setAutoFilled(true);
        }
    };

    // Cloudinary photo upload with Base64 fallback
    const handlePhotoFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoUploading(true);
        try {
            const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD || 'demo';
            const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || 'ml_default';
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setForm(prev => ({ ...prev, googleDrivePhotoUrl: data.secure_url, customerPhoto: data.secure_url }));
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setForm(prev => ({ ...prev, googleDrivePhotoUrl: reader.result, customerPhoto: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        } catch (err) {
            console.error('Cloudinary upload error:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, googleDrivePhotoUrl: reader.result, customerPhoto: reader.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setPhotoUploading(false);
            if (photoFileRef.current) photoFileRef.current.value = '';
        }
    };

    const handleDocumentParsed = (parsedData) => {
        setForm(prev => ({ ...prev, ...parsedData }));
        setAutoFilled(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const isAdmin = user?.role === 'Administrator';
        const photo = form.googleDrivePhotoUrl || form.customerPhoto || '';
        const payload = {
            ...form,
            deviceProblem: form.deviceProblem || '',
            capacity: form.capacity || '',
            customerPhoto: photo,
            googleDrivePhotoUrl: photo,
            mosyleUrl: form.mosyleUrl || '',
            urlFb: form.urlFb || '',
            inputDate: form.inputDate || editData?.inputDate || new Date().toISOString().split('T')[0],
            status: editData?.status || 'Application',
            monthlyPayment: Number(form.monthlyPayment) || (Number(form.amount) / 10),
            modifiedByAdmin: isAdmin ? true : Boolean(editData?.modifiedByAdmin),
            lastModifiedBy: isAdmin ? (user?.name || 'Administrator') : (editData?.lastModifiedBy || '')
        };
        try {
            const url = editData ? `${API_BASE1}/contracts/${editData._id}` : `${API_BASE1}/contracts`;
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

    const tabs = [
        { id: 'customer', label: 'Customer Info', icon: <FaUser />, color: 'indigo' },
        { id: 'device', label: 'Device Info', icon: <FaMobileAlt />, color: 'purple' },
        { id: 'loan', label: 'Loan Terms', icon: <FaDollarSign />, color: 'emerald' },
    ];
    const tabCls = {
        indigo: { active: 'bg-indigo-600 text-white border-indigo-500', inactive: 'text-indigo-400 border-gray-700 hover:bg-indigo-900/40' },
        purple: { active: 'bg-purple-600 text-white border-purple-500', inactive: 'text-purple-400 border-gray-700 hover:bg-purple-900/40' },
        emerald: { active: 'bg-emerald-600 text-white border-emerald-500', inactive: 'text-emerald-400 border-gray-700 hover:bg-emerald-900/40' },
    };

    return (
        <div className="w-[calc(100%-260px)] h-[82vh] overflow-hidden absolute right-0 top-[8vh] bg-gray-900 border border-gray-700 z-[99999] shadow-2xl flex flex-col rounded-xl">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-800 flex-shrink-0">
                    <div>
                        <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                            {editData ? 'Edit Application Contract' : 'Create Application Contract'}
                            {autoFilled && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/60 border border-indigo-600 text-indigo-300 rounded-full text-[10px] font-bold uppercase">
                                    <FaUserCheck className="text-xs" /> Auto-filled
                                </span>
                            )}
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setOpen(false)}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-[5px] text-xs cursor-pointer transition-all flex items-center gap-1.5">
                            <MdClose /> Cancel
                        </button>
                        <button type="submit" disabled={submitting}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-lg shadow-emerald-600/30 transition-all">
                            {submitting ? 'Saving...' : 'Submit Contract'}
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1.5 px-4 pt-2.5 pb-0 border-b border-gray-700/60 flex-shrink-0 bg-gray-900">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const c = tabCls[tab.color];
                        return (
                            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl border border-b-0 text-xs font-bold transition-all cursor-pointer ${isActive ? c.active : c.inactive}`}>
                                {tab.icon} {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">

                    {/* TAB 1: Customer Info */}
                    {activeTab === 'customer' && (<>
                        <DocumentScanner onParsedData={handleDocumentParsed} />
                        <div className="grid grid-cols-4 gap-3">
                            <AutoField id="customerNameEn" label="Name English" value={form.customerNameEn} placeholder="Name English" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="customerNameKh" label="Name Khmer" value={form.customerNameKh} placeholder="Name Khmer" font="font-khmer" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="idCardNumber" label="ID Card Number" value={form.idCardNumber} placeholder="ID Number" font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="phone" label="Phone Number" value={form.phone} placeholder="Phone" font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="Date of Birth"><input className={inp} type="date" id="dob" value={form.dob || ''} onChange={handleChange} /></Field>
                            <Field label="Gender">
                                <select className={sel} id="gender" value={form.gender || 'male'} onChange={handleChange}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </Field>
                            <Field label="Brand (ម៉ាក)">
                                <select id="brand" value={form.brand || ''} onChange={handleChange} disabled={user?.role !== 'Administrator'} className={`${sel} font-semibold disabled:opacity-60`}>
                                    <option value="">Select Brand</option>
                                    {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                                </select>
                            </Field>
                            <Field label="Relative Phone"><input className={`${inp} font-mono`} type="text" id="relativePhone" value={form.relativePhone || ''} onChange={handleChange} placeholder="Relative phone" /></Field>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="Birth Address"><input className={inp} type="text" id="birthAddress" value={form.birthAddress || ''} onChange={handleChange} placeholder="Birth address" /></Field>
                            <Field label="Current Address"><input className={inp} type="text" id="currentAddress" value={form.currentAddress || ''} onChange={handleChange} placeholder="Current address" /></Field>
                            <Field label="Facebook Name"><input className={inp} type="text" id="facebookName" value={form.facebookName || ''} onChange={handleChange} placeholder="Facebook Name" /></Field>
                            <Field label="Telegram Name"><input className={inp} type="text" id="telegramName" value={form.telegramName || ''} onChange={handleChange} placeholder="Telegram Name" /></Field>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="URL Facebook"><input className={inp} type="text" id="urlFb" value={form.urlFb || ''} onChange={handleChange} placeholder="URL Facebook" /></Field>
                            <Field label="URL Mosyle"><input className={`${inp} font-mono`} type="text" id="mosyleUrl" value={form.mosyleUrl || ''} onChange={handleChange} placeholder="https://" /></Field>
                            <Field label="Photo" accent>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            className="flex-1 p-2 bg-gray-800/80 border border-amber-600/50 focus:border-amber-500 rounded-[5px] text-gray-100 font-mono text-xs outline-none transition-colors"
                                            type="text" id="googleDrivePhotoUrl" value={form.googleDrivePhotoUrl || ''} onChange={handleChange} placeholder="https://... or upload file" />
                                        <button
                                            type="button"
                                            onClick={() => photoFileRef.current?.click()}
                                            disabled={photoUploading}
                                            className="px-2.5 py-2 bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white rounded-[5px] text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition-all"
                                        >
                                            {photoUploading ? 'Uploading...' : 'Upload'}
                                        </button>
                                        <input
                                            ref={photoFileRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoFileUpload}
                                        />
                                    </div>
                                    {form.googleDrivePhotoUrl && (
                                        <img
                                            src={form.googleDrivePhotoUrl}
                                            alt="Preview"
                                            className="w-16 h-16 object-cover rounded-xl border border-amber-600/40"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    )}
                                </div>
                            </Field>
                        </div>
                    </>)}

                    {/* TAB 2: Device Info */}
                    {activeTab === 'device' && (<>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="Device Model">
                                <select id="model" value={form.model || ''} onChange={handleChange} required className={`${sel} font-semibold`}>
                                    <option value="">Select Device Model</option>
                                    {modelsList.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                                    {form.model && !modelsList.includes(form.model) && <option value={form.model}>{form.model}</option>}
                                </select>
                            </Field>
                            <AutoField id="serialNumber" label="Serial Number" value={form.serialNumber} placeholder="Serial Number" font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="imei1" label="IMEI 1" value={form.imei1} placeholder="IMEI 1" font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <Field label="IMEI 2"><input className={`${inp} font-mono`} type="text" id="imei2" value={form.imei2 || ''} onChange={handleChange} placeholder="IMEI 2" /></Field>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="MEID Number">
                                <input className={`${inp} font-mono text-pink-400`} type="text" id="meid" value={form.meid || ''} onChange={handleChange} placeholder="e.g. 35173227736075" />
                            </Field>
                            <Field label="Version">
                                <input className={`${inp} text-indigo-300 font-semibold`} type="text" id="version" value={form.version || ''} onChange={handleChange} placeholder="e.g. Android 14 / iOS 18" />
                            </Field>
                            <Field label="Color"><input className={inp} type="text" id="color" value={form.color || ''} onChange={handleChange} placeholder="e.g. Midnight Black" /></Field>
                            <Field label="Capacity / Storage"><input className={inp} type="text" id="capacity" value={form.capacity || ''} onChange={handleChange} placeholder="e.g. 128 GB / 256 GB" /></Field>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <Field label="Device Problem">
                                <textarea
                                    id="deviceProblem"
                                    value={form.deviceProblem || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Describe any device issues, damages, or notes... (e.g. Screen cracked, battery weak, speaker not working)"
                                    className={`${inp} resize-none text-amber-300 font-medium`}
                                />
                            </Field>
                        </div>
                        {(form.model || form.serialNumber || form.imei1) && (
                            <div className="p-3.5 bg-purple-900/20 border border-purple-700/40 rounded-xl flex items-center gap-4">
                                <FaMobileAlt className="text-purple-400 text-3xl flex-shrink-0" />
                                <div className="grid grid-cols-4 gap-x-4 gap-y-2 w-full text-xs">
                                    <div><span className="text-gray-500 block text-[10px]">Model</span><span className="text-purple-300 font-bold">{form.model || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">Serial No.</span><span className="text-gray-100 font-mono font-bold">{form.serialNumber || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">IMEI 1</span><span className="text-gray-100 font-mono font-bold">{formatIMEI(form.imei1)}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">IMEI 2</span><span className="text-gray-100 font-mono font-bold">{formatIMEI(form.imei2)}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">MEID</span><span className="text-pink-400 font-mono font-semibold">{form.meid || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">Version / OS</span><span className="text-indigo-300 font-bold">{form.version || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">Color</span><span className="text-gray-100">{form.color || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">Brand</span><span className="text-gray-100 font-semibold">{form.brand || '—'}</span></div>
                                    {form.deviceProblem && (
                                        <div className="col-span-4 p-2 bg-amber-900/20 border border-amber-700/40 rounded-[5px]">
                                            <span className="text-amber-400 block text-[10px] font-bold mb-0.5">Device Problem</span>
                                            <span className="text-amber-300 text-[11px] font-medium">{form.deviceProblem}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>)}


                    {/* TAB 3: Loan Terms */}
                    {activeTab === 'loan' && (<>
                        <div className="grid grid-cols-5 gap-3">
                            <Field label="Loan Date">
                                <input className="w-full p-2 bg-gray-800/80 border border-indigo-600/70 rounded-[5px] text-gray-100 font-mono text-xs outline-none focus:border-indigo-500 font-bold"
                                    type="date" id="inputDate" value={form.inputDate || ''} onChange={handleChange} required />
                            </Field>
                            <Field label="Total Loan Amount ($)">
                                <input className="w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="number" id="amount" value={form.amount || ''} onChange={handleChange} placeholder="Amount" />
                            </Field>
                            <Field label="Customer Received ($)">
                                <input className="w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="number" id="monthlyPayment" value={form.monthlyPayment || ''} onChange={handleChange} placeholder="Monthly Payment" />
                            </Field>
                            <Field label="Interest Rate"><input className={`${inp} font-mono`} type="text" id="interest" value={form.interest || ''} onChange={handleChange} placeholder="e.g. 14%" /></Field>
                            <Field label="Duration"><input className={inp} type="text" id="duration" value={form.duration || ''} onChange={handleChange} placeholder="e.g. 12 Months" /></Field>
                        </div>
                        <div className="p-4 bg-emerald-900/20 border border-emerald-700/40 rounded-xl">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase mb-3">Loan Summary Preview</p>
                            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">Total Loan Amount</span>
                                    <span className="text-emerald-400 font-mono font-bold text-base">${Number(form.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">Customer Received</span>
                                    <span className="text-emerald-400 font-mono font-bold text-base">${Number(form.monthlyPayment || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">Interest · Duration</span>
                                    <span className="text-gray-200 font-bold">{form.interest || '14%'} · {form.duration || '12 Mo'}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 text-[10px] block">Customer</span>
                                    <span className="text-gray-100 font-semibold">{form.customerNameEn || '—'}{form.customerNameKh ? ` (${form.customerNameKh})` : ''}</span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 text-[10px] block">Device</span>
                                    <span className="text-gray-100 font-semibold">{form.model || '—'}{form.serialNumber ? ` · ${form.serialNumber}` : ''}</span>
                                </div>
                            </div>
                        </div>
                    </>)}
                </div>

            </form>
        </div>
    );
};

export default CreateApplication;
