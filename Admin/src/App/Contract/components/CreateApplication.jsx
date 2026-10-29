import { useLanguage } from '../../../context/LanguageContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaUserCheck, FaUser, FaMobileAlt, FaDollarSign } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { useAuth } from '../../../context/AuthContext';
import ImageUrlListInput from '../../../components/ImageUrlListInput';
import { formatIMEI, formatIMEIInput } from '../../../utils/imeiFormatter';
import { getProxyImageUrl, storeImageFiles } from '../../../utils/mediaUtils';
import ImageStorageSelect from '../../../components/ImageStorageSelect';


/* ── Shared style tokens ── */
const inp = "w-full p-2 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100 text-xs outline-none transition-colors";
const sel = "w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-gray-100 text-xs outline-none";

/* ── Autocomplete field with suggestions dropdown ── */
const AutoField = ({ id, label, value, onChange, placeholder, list = [], onSelect, font = '', numeric = false, formatNumeric }) => {
    const { t } = useLanguage();
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
                type="text" id={id} value={formatNumeric ? formatNumeric(value) : value || ''}
                inputMode={numeric ? 'numeric' : undefined}
                pattern={numeric && !formatNumeric ? '[0-9]*' : undefined}
                onChange={e => {
                    if (numeric) {
                        const input = e.target;
                        const digits = input.value.replace(/\D/g, '').slice(0, 15);
                        const digitsBeforeCursor = input.value.slice(0, input.selectionStart || 0).replace(/\D/g, '').length;
                        onChange({ target: { id, value: digits } });
                        if (formatNumeric) {
                            requestAnimationFrame(() => {
                                const cursorPosition = digitsBeforeCursor + [2, 8, 14].filter(boundary => digitsBeforeCursor >= boundary).length;
                                input.setSelectionRange(cursorPosition, cursorPosition);
                            });
                        }
                    } else {
                        onChange(e);
                    }
                    setOpen(true);
                }}
                onFocus={() => { setFocused(true); setOpen(true); }}
                onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); }, 200)}
                placeholder={placeholder}
                autoComplete="off"
            />
            {show && (
                <div className="absolute left-0 top-full mt-1 w-full bg-gray-900 border border-indigo-600 rounded-[5px] shadow-2xl z-[99999] overflow-hidden">
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
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    const currentYear = new Date().getFullYear();

    const emptyForm = {
        inputDate: new Date().toISOString().split('T')[0],
        brand: user?.brand || '',
        subBrand: '',
        contractSuffix: '000000001',
        customerNameEn: '', customerNameKh: '',
        idCardNumber: '', dob: '', gender: 'male',
        birthAddress: '', currentAddress: '',
        phone: '', relativePhone: '',
        facebookName: '', telegramName: '', urlFb: '', mosyleUrl: '',
        customerPhoto: '', googleDrivePhotoUrl: '', photos: [],
        model: '', serialNumber: '', imei1: '', imei2: '', meid: '', color: '', version: '',
        deviceProblem: '', capacity: '',
        amount: 1000, interest: '14%', adminFee: 20, duration: '12 Months',
        interestType: '14%', monthlyPayment: 1000
    };

    const [form, setForm] = useState(emptyForm);
    const [brandsList, setBrandsList] = useState([]);
    const [brandSubbrands, setBrandSubbrands] = useState({});
    const [modelsList, setModelsList] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [allCustomers, setAllCustomers] = useState([]);
    const [autoFilled, setAutoFilled] = useState(false);
    const [activeTab, setActiveTab] = useState('customer');
    const [photoUploading, setPhotoUploading] = useState(false);
    const [imageStorageType, setImageStorageType] = useState('cloudinary');
    const [capacityUnit, setCapacityUnit] = useState('GB');
    const [interestUnit, setInterestUnit] = useState('%');
    const [durationUnit, setDurationUnit] = useState('Months');
    const [amountsLinked, setAmountsLinked] = useState(true);
    const photoFileRef = useRef(null);

    const getNumericPart = (value) => String(value || '').match(/(?:\d+(?:\.\d*)?|\.\d*)/)?.[0] || '';
    const getVersionNumber = (value) => String(value || '').replace(/[^\d.]/g, '');
    const sanitizePhone = (value) => String(value || '').replace(/[^0-9 /]/g, '');
    const getAmountNumber = (value) => {
        const numeric = String(value ?? '').replace(/[^\d.]/g, '');
        const decimalIndex = numeric.indexOf('.');
        if (decimalIndex === -1) return numeric;
        return `${numeric.slice(0, decimalIndex)}.${numeric.slice(decimalIndex + 1).replace(/\./g, '')}`;
    };

    const computeNextSuffixForBrand = (targetBrand, customersList) => {
        const cleanBrand = (targetBrand || user?.brand || 'M8').trim().toLowerCase();
        const matching = (customersList || []).filter(c => (c.brand || '').trim().toLowerCase() === cleanBrand);
        let maxNum = 0;
        matching.forEach(c => {
            const iid = c.contractIid || c.contractId || '';
            const parts = String(iid).split('-');
            if (parts.length >= 3) {
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextVal = maxNum > 0 ? maxNum + 1 : (matching.length > 0 ? matching.length + 1 : 1);
        return String(nextVal).padStart(9, '0');
    };

    useEffect(() => {
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d => d.category === 'Brands');
                    if (cat) setBrandsList(cat.items || []);
                    if (data.brand_subbrands) setBrandSubbrands(data.brand_subbrands);
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

    // Auto-set subBrand when only 1 option available
    useEffect(() => {
        const availSubs = user?.role === 'Administrator'
            ? (brandSubbrands[form.brand] || [])
            : (Array.isArray(user?.subBrands) ? user.subBrands : []);
        if (availSubs.length === 1 && form.subBrand !== availSubs[0]) {
            setForm(prev => ({ ...prev, subBrand: availSubs[0] }));
        }
    }, [form.brand, brandSubbrands, user?.subBrands, user?.role]);

    useEffect(() => {
        const capacityMatch = String(form.capacity || '').match(/\b(GB|TB)\b/i);
        const interestMatch = String(form.interest || '').match(/(%|\$|USD)/i);
        const durationMatch = String(form.duration || '').match(/\b(day|month|year)s?\b/i);
        if (capacityMatch) setCapacityUnit(capacityMatch[1].toUpperCase());
        if (interestMatch) setInterestUnit(interestMatch[1] === '$' || interestMatch[1].toUpperCase() === 'USD' ? '$' : '%');
        if (durationMatch) {
            const unit = durationMatch[1].toLowerCase();
            setDurationUnit(unit === 'day' ? 'Days' : unit === 'year' ? 'Years' : 'Months');
        }
    }, [form.capacity, form.interest, form.duration]);

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
                            setForm(prev => ({
                                ...prev,
                                ...doc,
                                phone: doc.phone ? sanitizePhone(doc.phone) : prev.phone,
                                relativePhone: doc.relativePhone ? sanitizePhone(doc.relativePhone) : prev.relativePhone
                            }));
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
                let suffix = '';
                const iidSource = editData.contractIid || editData.contractId;
                if (iidSource) {
                    const parts = String(iidSource).split('-');
                    suffix = parts.length >= 3 ? parts.slice(2).join('-') : String(iidSource).replace(/^[^0-9]*/, '');
                }
                setForm({
                    ...emptyForm,
                    ...editData,
                    phone: sanitizePhone(editData.phone),
                    relativePhone: sanitizePhone(editData.relativePhone),
                    contractId: editData.contractId || '',
                    contractIid: editData.contractIid || '',
                    contractSuffix: suffix || '000000001',
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
                const capacityMatch = String(editData.capacity || editData.storage || editData.Storage || '').match(/(\d+(?:\.\d+)?)\s*(GB|TB)?/i);
                const interestMatch = String(editData.interest || editData.interestType || '14%').match(/(\d+(?:\.\d+)?)\s*(%|\$|USD)?/i);
                const durationMatch = String(editData.duration || '12 Months').match(/(\d+)\s*(day|month|year)/i);
                setCapacityUnit(capacityMatch?.[2]?.toUpperCase() || 'GB');
                setInterestUnit(interestMatch?.[2] === '$' || interestMatch?.[2]?.toUpperCase() === 'USD' ? '$' : '%');
                const durationUnitName = durationMatch?.[2]?.toLowerCase();
                setDurationUnit(durationUnitName === 'day' ? 'Days' : durationUnitName === 'year' ? 'Years' : 'Months');
                setAmountsLinked(Number(editData.amount || 0) === Number(editData.monthlyPayment || 0));


            } else {
                const initialBrand = form.brand || user?.brand || (brandsList.length > 0 ? brandsList[0] : 'M8');
                const autoSuffix = computeNextSuffixForBrand(initialBrand, allCustomers);
                const autoContractId = `CT-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;
                // Auto-select subBrand
                const availSubs = user?.role === 'Administrator'
                    ? (brandSubbrands[initialBrand] || [])
                    : (Array.isArray(user?.subBrands) ? user.subBrands : []);
                const autoSubBrand = availSubs.length === 1 ? availSubs[0] : '';
                setForm({
                    ...emptyForm,
                    brand: initialBrand,
                    subBrand: autoSubBrand,
                    contractId: autoContractId,
                    contractSuffix: autoSuffix
                });
                setCapacityUnit('GB');
                setInterestUnit('%');
                setDurationUnit('Months');
                setAmountsLinked(true);
            }
            setAutoFilled(false);
            setActiveTab('customer');
        }
    }, [open, editData, allCustomers.length]);

    const matchedCustomer = useMemo(() => {
        const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        const cardNumber = normalize(form.idCardNumber).replace(/[\s-]/g, '');
        const nameEn = normalize(form.customerNameEn);
        const nameKh = normalize(form.customerNameKh);
        const dob = normalize(form.dob);
        if (!cardNumber && !nameEn && !nameKh) return null;

        return allCustomers.find(customer => {
            const candidateCardNumber = normalize(customer.idCardNumber).replace(/[\s-]/g, '');
            if (cardNumber && candidateCardNumber) return cardNumber === candidateCardNumber;

            const candidateNameEn = normalize(customer.customerNameEn);
            const candidateNameKh = normalize(customer.customerNameKh);
            const matchesName = Boolean(
                (nameEn && candidateNameEn && nameEn === candidateNameEn) ||
                (nameKh && candidateNameKh && nameKh === candidateNameKh)
            );
            if (!matchesName) return false;
            const candidateDob = normalize(customer.dob);
            if (dob && candidateDob && dob !== candidateDob) return false;
            const hasNameConflict =
                (nameEn && candidateNameEn && nameEn !== candidateNameEn) ||
                (nameKh && candidateNameKh && nameKh !== candidateNameKh);
            return !hasNameConflict || Boolean(dob && candidateDob && dob === candidateDob);
        }) || null;
    }, [allCustomers, form.customerNameEn, form.customerNameKh, form.idCardNumber, form.dob]);

    const displayedCustomerId = editData?.customerId || matchedCustomer?.customerId;

    const handleChange = (e) => {
        const { id, value } = e.target;
        const integerFields = new Set(['contractSuffix', 'imei1', 'imei2', 'meid']);
        const decimalFields = new Set(['amount', 'monthlyPayment']);
        const phoneFields = new Set(['phone', 'relativePhone']);
        const normalizedValue = integerFields.has(id)
            ? String(value).replace(/\D/g, '')
            : decimalFields.has(id)
                ? getAmountNumber(value)
                : phoneFields.has(id) ? sanitizePhone(value) : value;
        if (id === 'brand' && !editData) {
            const nextSuffix = computeNextSuffixForBrand(value, allCustomers);
            // Auto-pick subBrand if only 1 available for this brand
            const availSubs = user?.role === 'Administrator'
                ? (brandSubbrands[value] || [])
                : (Array.isArray(user?.subBrands) ? user.subBrands : []);
            const autoSubBrand = availSubs.length === 1 ? availSubs[0] : '';
            setForm(prev => ({ ...prev, [id]: value, contractSuffix: nextSuffix, subBrand: autoSubBrand }));
            return;
        }
        setForm(prev => {
            if (id === 'amount' && amountsLinked) {
                return { ...prev, amount: normalizedValue, monthlyPayment: normalizedValue };
            }
            if (id === 'monthlyPayment' && amountsLinked) {
                return { ...prev, monthlyPayment: normalizedValue, amount: normalizedValue };
            }
            return { ...prev, [id]: normalizedValue };
        });
    };

    const handleCapacityNumberChange = (value) => {
        const numericValue = getAmountNumber(value);
        setForm(prev => ({ ...prev, capacity: numericValue ? `${numericValue} ${capacityUnit}` : '' }));
    };

    const handleCapacityUnitChange = (value) => {
        setCapacityUnit(value);
        setForm(prev => {
            const numericValue = getNumericPart(prev.capacity);
            return { ...prev, capacity: numericValue ? `${numericValue} ${value}` : '' };
        });
    };

    const handleInterestNumberChange = (value) => {
        const numericValue = getAmountNumber(value);
        setForm(prev => ({
            ...prev,
            interest: numericValue ? `${numericValue}${interestUnit}` : '',
            interestType: numericValue ? `${numericValue}${interestUnit}` : ''
        }));
    };

    const handleInterestUnitChange = (value) => {
        setInterestUnit(value);
        setForm(prev => {
            const numericValue = getNumericPart(prev.interest);
            return {
                ...prev,
                interest: numericValue ? `${numericValue}${value}` : '',
                interestType: numericValue ? `${numericValue}${value}` : ''
            };
        });
    };

    const handleDurationNumberChange = (value) => {
        const numericValue = String(value || '').replace(/\D/g, '');
        setForm(prev => ({ ...prev, duration: numericValue ? `${numericValue} ${durationUnit}` : '' }));
    };

    const handleDurationUnitChange = (value) => {
        setDurationUnit(value);
        setForm(prev => {
            const numericValue = getNumericPart(prev.duration);
            return { ...prev, duration: numericValue ? `${numericValue} ${value}` : '' };
        });
    };

    const handleVersionNumberChange = (value) => {
        const numericValue = getVersionNumber(value);
        setForm(prev => ({ ...prev, version: numericValue }));
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
                phone: item.phone ? sanitizePhone(item.phone) : prev.phone,
                relativePhone: item.relativePhone ? sanitizePhone(item.relativePhone) : prev.relativePhone,
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

    const handlePhotoFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setPhotoUploading(true);
        try {
            const uploadedUrls = await storeImageFiles(files, imageStorageType, API_BASE);

            if (uploadedUrls.length > 0) {
                setForm(prev => {
                    const existing = Array.isArray(prev.photos) ? prev.photos : (prev.googleDrivePhotoUrl ? [prev.googleDrivePhotoUrl] : []);
                    const combined = [...existing, ...uploadedUrls];
                    return {
                        ...prev,
                        photos: combined,
                        googleDrivePhotoUrl: combined[0] || '',
                        customerPhoto: combined[0] || ''
                    };
                });
            }
        } catch (err) {
            console.error('File to base64 upload error:', err);
            alert(`Image upload failed: ${err.message}`);
        } finally {
            setPhotoUploading(false);
            if (photoFileRef.current) photoFileRef.current.value = '';
        }
    };

    const handleAddDirectPhotoUrls = (urls) => {
        setForm(prev => {
            const existing = Array.isArray(prev.photos) ? prev.photos : (prev.googleDrivePhotoUrl ? [prev.googleDrivePhotoUrl] : []);
            const combined = [...new Set([...existing, ...urls])];
            return {
                ...prev,
                photos: combined,
                googleDrivePhotoUrl: combined[0] || '',
                customerPhoto: combined[0] || ''
            };
        });
    };

    const handleRemovePhoto = (removeIndex) => {
        setForm(prev => {
            const existing = Array.isArray(prev.photos) ? prev.photos : [];
            const updated = existing.filter((_, idx) => idx !== removeIndex);
            return {
                ...prev,
                photos: updated,
                googleDrivePhotoUrl: updated[0] || '',
                customerPhoto: updated[0] || ''
            };
        });
    };

    const handleDocumentParsed = (parsedData) => {
        if (!parsedData) return;
        setForm(prev => ({
            ...prev,
            customerNameEn: parsedData.customerNameEn || prev.customerNameEn,
            customerNameKh: parsedData.customerNameKh || prev.customerNameKh,
            idCardNumber: parsedData.idCardNumber || prev.idCardNumber,
            dob: parsedData.dob || prev.dob,
            gender: (parsedData.gender || '').toLowerCase() === 'female' ? 'female' : 'male',
            birthAddress: parsedData.birthAddress || prev.birthAddress,
            currentAddress: parsedData.currentAddress || prev.currentAddress,
            model: parsedData.model || prev.model,
            serialNumber: parsedData.serialNumber || prev.serialNumber,
            version: parsedData.version || prev.version,
            capacity: parsedData.capacity || parsedData.storage || prev.capacity,
            imei1: parsedData.imei1 || prev.imei1,
            imei2: parsedData.imei2 || prev.imei2,
            meid: parsedData.meid || prev.meid,
            color: parsedData.color || prev.color,
            brand: parsedData.brand || prev.brand
        }));
        setAutoFilled(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const isAdmin = user?.role === 'Administrator';
        const allPhotos = Array.isArray(form.photos) && form.photos.length > 0
            ? form.photos
            : (form.googleDrivePhotoUrl ? [form.googleDrivePhotoUrl] : (form.customerPhoto ? [form.customerPhoto] : []));
        const primaryPhoto = allPhotos[0] || '';

        const currentBrand = (form.brand || editData?.brand || user?.brand || 'M8').trim();
        const rawSuffix = String(form.contractSuffix || '').trim();
        let cleanSuffix = rawSuffix ? rawSuffix.replace(/[^0-9]/g, '') : '';
        if (cleanSuffix) {
            cleanSuffix = cleanSuffix.padStart(9, '0');
        } else {
            cleanSuffix = '000000001';
        }
        const fullContractIid = `${currentBrand}-${currentYear}-${cleanSuffix}`;
        const fullContractId = editData?.contractId || form.contractId || (`CT-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`);

        const { _id, __v, createdAt, updatedAt, ...cleanFormData } = form;

        const payload = {
            ...cleanFormData,
            contractId: fullContractId,
            contractIid: fullContractIid,
            deviceProblem: form.deviceProblem || '',
            capacity: form.capacity || '',
            photos: allPhotos,
            evidencePhotos: allPhotos,
            customerPhoto: primaryPhoto,
            googleDrivePhotoUrl: primaryPhoto,
            mosyleUrl: form.mosyleUrl || '',
            urlFb: form.urlFb || '',
            inputDate: form.inputDate || editData?.inputDate || new Date().toISOString().split('T')[0],
            version: getVersionNumber(form.version),
            phone: sanitizePhone(form.phone),
            relativePhone: sanitizePhone(form.relativePhone),
            imei1: String(form.imei1 || '').replace(/\D/g, '').slice(0, 15),
            imei2: String(form.imei2 || '').replace(/\D/g, '').slice(0, 15),
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
            else {
                const errData = await res.json().catch(() => ({}));
                alert(`បរាជ័យក្នុងការរក្សាទុក Contract: ${errData.error || res.statusText}`);
            }
        } catch (err) {
            setSubmitting(false);
            console.error('Save contract error:', err);
            alert(`Error: ${err.message}`);
        }
    };

    if (!open) return null;

    const tabs = [
        { id: 'customer', label: t('customerInformation'), icon: <FaUser />, color: 'indigo' },
        { id: 'device', label: t('deviceInformation'), icon: <FaMobileAlt />, color: 'purple' },
        { id: 'loan', label: t('loanTerms'), icon: <FaDollarSign />, color: 'emerald' },
    ];
    const tabCls = {
        indigo: { active: 'bg-indigo-600 text-white border-indigo-500', inactive: 'text-indigo-400 border-gray-700 hover:bg-indigo-900/40' },
        purple: { active: 'bg-purple-600 text-white border-purple-500', inactive: 'text-purple-400 border-gray-700 hover:bg-purple-900/40' },
        emerald: { active: 'bg-emerald-600 text-white border-emerald-500', inactive: 'text-emerald-400 border-gray-700 hover:bg-emerald-900/40' },
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-2 select-none animate-in fade-in duration-150">
            <div className="bg-gray-900 border border-gray-700 rounded-[5px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">

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
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-950/70 border border-indigo-700 rounded-[5px] font-mono font-bold text-indigo-300">
                            <span className="text-[10px] text-indigo-400">{t('customerCuId')}:</span>
                            <span>{displayedCustomerId || 'Auto'}</span>
                        </div>
                        <button type="button" onClick={() => setOpen(false)}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-[5px] text-xs cursor-pointer transition-all flex items-center gap-1.5">
                            <MdClose /> {t('cancel')}
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
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-[5px] border border-b-0 text-xs font-bold transition-all cursor-pointer ${isActive ? c.active : c.inactive}`}>
                                {tab.icon} {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-2 space-y-4 bg-gray-900/50">

                    {/* TAB 1: Customer Info */}
                    {activeTab === 'customer' && (<>
                        <div className="grid grid-cols-4 gap-3">
                            <AutoField id="customerNameEn" label={t('nameEnglish')} value={form.customerNameEn} placeholder={t('customerNameEnglish')} list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="customerNameKh" label={t('nameKhmer')} value={form.customerNameKh} placeholder={t('customerNameKhmer')} font="font-khmer" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="idCardNumber" label={t('idCardNo')} value={form.idCardNumber} placeholder={t('idNumber')} font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                                            <AutoField id="phone" label={t('phone')} value={form.phone} placeholder={t('phone')} font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label={t('dateOfBirth')}><input className={inp} type="date" id="dob" value={form.dob || ''} onChange={handleChange} /></Field>
                            <Field label={t('gender')}>
                                <select className={sel} id="gender" value={form.gender || 'male'} onChange={handleChange}>
                                    <option value="male">{t('male')}</option>
                                    <option value="female">{t('female')}</option>
                                </select>
                            </Field>
                            <Field label={t('brand')}>
                                <select id="brand" value={form.brand || ''} onChange={handleChange} disabled={user?.role !== 'Administrator'} className={`${sel} font-semibold disabled:opacity-60`}>
                                    <option value="">{t('selectBrand')}</option>
                                    {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                                </select>
                            </Field>
                            {(() => {
                                const availSubs = user?.role === 'Administrator'
                                    ? (brandSubbrands[form.brand] || [])
                                    : (Array.isArray(user?.subBrands) ? user.subBrands : []);
                                if (availSubs.length === 0) return null;
                                return (
                                    <Field label={t('subBrand')}>
                                        {availSubs.length === 1 ? (
                                            <div className={`${inp} font-semibold text-indigo-300 flex items-center gap-1.5`}>
                                                <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 rounded-[4px] text-indigo-300 text-[10px] font-bold">{availSubs[0]}</span>
                                                <input type="hidden" id="subBrand" value={availSubs[0]} />
                                            </div>
                                        ) : (
                                            <select id="subBrand" value={form.subBrand || ''} onChange={handleChange} className={`${sel} font-semibold`}>
                                                <option value="">{t('selectSubBrand')}</option>
                                                {availSubs.map((sb, idx) => <option key={idx} value={sb}>{sb}</option>)}
                                            </select>
                                        )}
                                    </Field>
                                );
                            })()}
                            <Field label="Relative Phone"><input className={`${inp} font-mono`} type="text" id="relativePhone" value={form.relativePhone || ''} onChange={handleChange} placeholder={t('customerRelativePhone')} /></Field>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="Birth Address"><input className={inp} type="text" id="birthAddress" value={form.birthAddress || ''} onChange={handleChange} placeholder={t('customerBirthAddress')} /></Field>
                            <Field label="Current Address"><input className={inp} type="text" id="currentAddress" value={form.currentAddress || ''} onChange={handleChange} placeholder={t('customerCurrentAddress')} /></Field>
                            <Field label="Facebook Name"><input className={inp} type="text" id="facebookName" value={form.facebookName || ''} onChange={handleChange} placeholder={t('customerFacebookName')} /></Field>
                            <Field label="Telegram Name"><input className={inp} type="text" id="telegramName" value={form.telegramName || ''} onChange={handleChange} placeholder={t('customerTelegramName')} /></Field>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Field label={t('facebookUrl')}><input className={inp} type="text" id="urlFb" value={form.urlFb || ''} onChange={handleChange} placeholder={t('facebookUrl')} /></Field>
                            <Field label={t('mosyleUrl')}><input className={`${inp} font-mono`} type="text" id="mosyleUrl" value={form.mosyleUrl || ''} onChange={handleChange} placeholder="https://" /></Field>
                            <Field label={t('evidencePhotos')} accent>
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-col gap-2">
                                        <ImageUrlListInput onAddUrls={handleAddDirectPhotoUrls} />
                                        <ImageStorageSelect value={imageStorageType} onChange={setImageStorageType} disabled={photoUploading} />
                                        <button
                                            type="button"
                                            onClick={() => photoFileRef.current?.click()}
                                            disabled={photoUploading}
                                            className="px-2.5 py-2 bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white rounded-[5px] text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition-all"
                                        >
                                            {photoUploading ? t('uploading') : t('uploadFiles')}
                                        </button>
                                        <input
                                            ref={photoFileRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={handlePhotoFileUpload}
                                        />
                                    </div>

                                    {/* Multi-Photo Thumbnail Grid */}
                                    {((form.photos && form.photos.length > 0) || form.googleDrivePhotoUrl) && (
                                        <div className="p-2 bg-gray-800/90 border border-amber-600/30 rounded-[5px]">
                                            <div className="text-[10px] text-amber-300 font-bold mb-1.5 flex items-center justify-between">
                                                <span>រូបភាពភស្តុតាងបានភ្ជាប់ ({form.photos?.length || 1} រូប)</span>
                                                <span className="text-[9px] text-gray-400 font-normal">{t('uploadMorePhotosHint')}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap max-h-36 overflow-y-auto p-2">
                                                {(Array.isArray(form.photos) && form.photos.length > 0 ? form.photos : [form.googleDrivePhotoUrl]).filter(Boolean).map((imgUrl, pIdx) => (
                                                    <div key={pIdx} className="relative group border-2 border-amber-600/40 rounded-lg overflow-hidden bg-gray-900 p-0.5 shadow-sm">
                                                        <img
                                                            src={imgUrl}
                                                            alt={`Evidence ${pIdx + 1}`}
                                                            className="w-14 h-14 object-cover rounded-md"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(pIdx)}
                                                            className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-rose-500 cursor-pointer shadow-md opacity-90 group-hover:opacity-100"
                                                            title={t('removePhoto')}
                                                        >
                                                            ✕
                                                        </button>
                                                        <span className="absolute bottom-0 left-0 text-[8px] bg-black/70 text-amber-300 px-1 rounded-tr font-mono">
                                                            #{pIdx + 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
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
                                    <option value="">{t('selectDeviceModel')}</option>
                                    {modelsList.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                                    {form.model && !modelsList.includes(form.model) && <option value={form.model}>{form.model}</option>}
                                </select>
                            </Field>
                            <AutoField id="serialNumber" label="Serial Number" value={form.serialNumber} placeholder={t('serialNumber')} font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} />
                            <AutoField id="imei1" label="IMEI 1" value={form.imei1} placeholder={t('imei1')} font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} numeric formatNumeric={formatIMEIInput} />
                            <AutoField id="imei2" label="IMEI 2" value={form.imei2} placeholder={t('imei2')} font="font-mono" list={allCustomers} onChange={handleChange} onSelect={handleAutoFill} numeric formatNumeric={formatIMEIInput} />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Field label="MEID Number">
                                <input className={`${inp} font-mono text-pink-400`} type="text" inputMode="numeric" pattern="[0-9]*" id="meid" value={form.meid || ''} onChange={handleChange} placeholder="e.g. 35173227736075" />
                            </Field>
                            <Field label="Version">
                                <input className={`${inp} text-indigo-300 font-semibold`} type="text" inputMode="text" value={getVersionNumber(form.version)} onChange={event => handleVersionNumberChange(event.target.value)} placeholder="18.1.1" />
                            </Field>
                            <Field label={t('color')}><input className={inp} type="text" id="color" value={form.color || ''} onChange={handleChange} placeholder={t('deviceColorPlaceholder')} /></Field>
                            <Field label={t('capacityStorage')}>
                                <div className="flex">
                                    <input className={`${inp} rounded-r-none`} type="text" inputMode="decimal" pattern="[0-9.]*" value={getNumericPart(form.capacity)} onChange={event => handleCapacityNumberChange(event.target.value)} placeholder="128" />
                                    <select value={capacityUnit} onChange={event => handleCapacityUnitChange(event.target.value)} className={`${sel} w-20 rounded-l-none`}>
                                        <option value="GB">GB</option>
                                        <option value="TB">TB</option>
                                    </select>
                                </div>
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <Field label="Device Problem">
                                <textarea
                                    id="deviceProblem"
                                    value={form.deviceProblem || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder={t('deviceIssuesPlaceholder')}
                                    className={`${inp} resize-none text-amber-300 font-medium`}
                                />
                            </Field>
                        </div>
                        {(form.model || form.serialNumber || form.imei1) && (
                            <div className="p-2 bg-purple-900/20 border border-purple-700/40 rounded-[5px] flex items-center gap-4">
                                <FaMobileAlt className="text-purple-400 text-3xl flex-shrink-0" />
                                <div className="grid grid-cols-4 gap-x-4 gap-y-2 w-full text-xs">
                                    <div><span className="text-gray-500 block text-[10px]">{t('model')}</span><span className="text-purple-300 font-bold">{form.model || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('serialNumber')}</span><span className="text-gray-100 font-mono font-bold">{form.serialNumber || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('imei1')}</span><span className="text-gray-100 font-mono font-bold">{formatIMEI(form.imei1)}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('imei2')}</span><span className="text-gray-100 font-mono font-bold">{formatIMEI(form.imei2)}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('deviceMeid')}</span><span className="text-pink-400 font-mono font-semibold">{form.meid || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('deviceVersionOs')}</span><span className="text-indigo-300 font-bold">{form.version || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('deviceColor')}</span><span className="text-gray-100">{form.color || '—'}</span></div>
                                    <div><span className="text-gray-500 block text-[10px]">{t('brand')}</span><span className="text-gray-100 font-semibold">{form.brand || '—'}</span></div>
                                    {form.deviceProblem && (
                                        <div className="col-span-4 p-2 bg-amber-900/20 border border-amber-700/40 rounded-[5px]">
                                            <span className="text-amber-400 block text-[10px] font-bold mb-0.5">{t('deviceProblem')}</span>
                                            <span className="text-amber-300 text-[11px] font-medium">{form.deviceProblem}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>)}


                    {/* TAB 3: Loan Terms */}
                    {activeTab === 'loan' && (<>
                        <div className="grid grid-cols-6 gap-3">
                            <Field label={`Contract IID (${(form.brand || user?.brand || 'M8').trim()}-${currentYear}-...)`}>
                                <div className="flex items-center">
                                    <span className="px-2.5 py-2 bg-indigo-950/80 border border-r-0 border-indigo-700/80 rounded-l-[5px] text-indigo-300 font-mono font-bold text-xs select-none whitespace-nowrap">
                                        {(form.brand || user?.brand || 'M8').trim()}-{currentYear}-
                                    </span>
                                    <input
                                        className="w-full p-2 bg-gray-800/80 border border-indigo-700/80 focus:border-indigo-400 rounded-r-[5px] text-indigo-200 font-mono font-bold text-xs outline-none transition-colors"
                                        type="text"
                                        id="contractSuffix"
                                        value={form.contractSuffix || ''}
                                        onChange={handleChange}
                                        placeholder="000000001"
                                    />
                                </div>
                            </Field>
                            <Field label="Loan Date">
                                <input className="w-full p-2 bg-gray-800/80 border border-indigo-600/70 rounded-[5px] text-gray-100 font-mono text-xs outline-none focus:border-indigo-500 font-bold"
                                    type="date" id="inputDate" value={form.inputDate || ''} onChange={handleChange} required />
                            </Field>
                            <Field label="Total Loan Amount ($)">
                                <input className="w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="text" inputMode="decimal" pattern="[0-9.]*" id="amount" value={form.amount ?? ''} onChange={handleChange} placeholder={t('amount')} />
                            </Field>
                            <Field label="Customer Received ($)">
                                <input className="w-full p-2 bg-gray-800/80 border border-gray-700 rounded-[5px] text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                                    type="text" inputMode="decimal" pattern="[0-9.]*" id="monthlyPayment" value={form.monthlyPayment ?? ''} onChange={handleChange} placeholder={t('monthlyPayment')} disabled={amountsLinked} />
                            </Field>
                            <Field label={t('interestRate')}>
                                <div className="flex">
                                    <input className={`${inp} font-mono rounded-r-none`} type="text" inputMode="decimal" pattern="[0-9.]*" value={getNumericPart(form.interest)} onChange={event => handleInterestNumberChange(event.target.value)} placeholder="14" />
                                    <select value={interestUnit} onChange={event => handleInterestUnitChange(event.target.value)} className={`${sel} w-20 rounded-l-none`}>
                                        <option value="%">%</option>
                                        <option value="$">$</option>
                                    </select>
                                </div>
                            </Field>
                            <Field label={t('duration')}>
                                <div className="flex">
                                    <input className={`${inp} rounded-r-none`} type="text" inputMode="numeric" pattern="[0-9]*" value={getNumericPart(form.duration)} onChange={event => handleDurationNumberChange(event.target.value)} placeholder="12" />
                                    <select value={durationUnit} onChange={event => handleDurationUnitChange(event.target.value)} className={`${sel} w-24 rounded-l-none`}>
                                        <option value="Days">Days</option>
                                        <option value="Months">Months</option>
                                        <option value="Years">Years</option>
                                    </select>
                                </div>
                            </Field>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                role="switch"
                                aria-label={t('matchLoanCustomer')}
                                aria-checked={amountsLinked}
                                onClick={() => {
                                    if (!amountsLinked) {
                                        setForm(prev => ({ ...prev, monthlyPayment: prev.amount }));
                                    }
                                    setAmountsLinked(!amountsLinked);
                                }}
                                className={`flex h-9 w-14 items-center rounded-full border px-1 transition-colors ${amountsLinked ? 'justify-start border-emerald-600 bg-emerald-950/60' : 'justify-end border-indigo-500 bg-indigo-950/60'}`}
                            >
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white transition-colors ${amountsLinked ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                                    ↔
                                </span>
                            </button>
                        </div>
                        <div className="p-2 bg-emerald-900/20 border border-emerald-700/40 rounded-[5px]">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase mb-3">{t('loanSummaryPreview')}</p>
                            <div className="grid grid-cols-5 gap-3 text-xs mb-3">
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">{t('contractIidManual')}</span>
                                    <span className="text-indigo-400 font-mono font-bold text-sm">
                                        {(form.brand || user?.brand || 'M8').trim()}-{currentYear}-{String(form.contractSuffix || '1').replace(/[^0-9]/g, '').padStart(9, '0')}
                                    </span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">{t('contractIdAuto')}</span>
                                    <span className="text-amber-300 font-mono font-bold text-sm">
                                        {form.contractId || `CT-${currentYear}-...`}
                                    </span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">{t('customerTotalLoanAmount')}</span>
                                    <span className="text-emerald-400 font-mono font-bold text-base">${Number(form.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">{t('ctmReceived')}</span>
                                    <span className="text-emerald-400 font-mono font-bold text-base">${Number(form.monthlyPayment || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 block text-[10px] mb-1">{t('interestDuration')}</span>
                                    <span className="text-gray-200 font-bold">{form.interest || '14%'} · {form.duration || '12 Mo'}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 text-[10px] block">{t('customerLabel')}</span>
                                    <span className="text-gray-100 font-semibold">{form.customerNameEn || '—'}{form.customerNameKh ? ` (${form.customerNameKh})` : ''}</span>
                                </div>
                                <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800">
                                    <span className="text-gray-500 text-[10px] block">{t('deviceLabel')}</span>
                                    <span className="text-gray-100 font-semibold">{form.model || '—'}{form.serialNumber ? ` · ${form.serialNumber}` : ''}</span>
                                </div>
                            </div>
                        </div>
                    </>)}
                </div>

            </form>
        </div>
    </div>
);
};

export default CreateApplication;
