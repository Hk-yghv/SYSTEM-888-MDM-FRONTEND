import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaCamera, FaImage, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaIdCard, FaMobileAlt, FaBuilding, FaMicrochip, FaMemory, FaHdd, FaBarcode } from 'react-icons/fa';

const ScanPage = ({ API_BASE, user }) => {
    const [scanTab, setScanTab] = useState('doc'); // 'doc' (ID/Passport) | 'device' (Phone Specs/IMEI)
    const [scanning, setScanning] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [parsedResult, setParsedResult] = useState(null);

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const convertKhmerNumbers = (str) => {
        const khmerNums = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
        let result = str;
        khmerNums.forEach((kh, i) => {
            result = result.replace(new RegExp(kh, 'g'), i.toString());
        });
        return result;
    };

    const preprocessImageForOCR = (imageFile) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const scale = Math.max(1.5, 1200 / Math.max(img.width, img.height));
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                const contrast = 40;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

                for (let i = 0; i < data.length; i += 4) {
                    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const color = factor * (avg - 128) + 128;
                    const finalColor = color > 140 ? 255 : color < 90 ? 0 : color;

                    data[i] = finalColor;
                    data[i + 1] = finalColor;
                    data[i + 2] = finalColor;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = URL.createObjectURL(imageFile);
        });
    };

    // Parse ID Cards / Passports
    const parseDocData = (text) => {
        const normalizedText = convertKhmerNumbers(text);
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
        const fullText = normalizedText.toUpperCase();

        let parsed = {
            customerNameEn: '',
            customerNameKh: '',
            idCardNumber: '',
            dob: '',
            gender: 'male',
            type: 'doc'
        };

        const idMatches = normalizedText.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/) || 
                          normalizedText.match(/\b(ID|NO|NUM|PASSPORT|លេខ)[:\s]*([A-Z0-9]{7,12})\b/i) ||
                          normalizedText.match(/\b([A-Z]\d{7,8}|\d{9,10})\b/);
        if (idMatches) parsed.idCardNumber = (idMatches[2] || idMatches[1] || idMatches[0]).replace(/\s+/g, '');

        const dobMatch = normalizedText.match(/\b(\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b/);
        if (dobMatch) {
            const rawDate = dobMatch[1].replace(/[\.-]/g, '/');
            const parts = rawDate.split('/');
            if (parts[0].length === 4) parsed.dob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            else if (parts[2].length === 4) parsed.dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        if (fullText.includes('FEMALE') || fullText.includes('SEX: F') || fullText.includes('ស្រី')) parsed.gender = 'female';
        else if (fullText.includes('MALE') || fullText.includes('SEX: M') || fullText.includes('ប្រុស')) parsed.gender = 'male';

        const nameCandidate = lines.find(l => l.length >= 4 && l === l.toUpperCase() && !l.includes('KINGDOM'));
        if (nameCandidate) parsed.customerNameEn = nameCandidate.replace(/[^A-Za-z\s]/g, '').trim();

        const khmerLines = lines.filter(line => /[\u1780-\u17FF]/.test(line));
        const khmerNameLine = khmerLines.find(l => !l.includes('ព្រះរាជាណាចក្រ') && !l.includes('អត្តសញ្ញាណប័ណ្ណ'));
        if (khmerNameLine) parsed.customerNameKh = khmerNameLine.replace(/(ឈ្មោះ|ភេទ|ថ្ងៃកំណើត|សញ្ជាតិ)/g, '').trim();

        return parsed;
    };

    // Parse Device Information / Specs Screenshots
    const parseDeviceData = (text) => {
        const normalizedText = convertKhmerNumbers(text);
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
        const fullText = normalizedText.toUpperCase();

        let parsed = {
            brandName: '',
            modelName: '',
            imei1: '',
            imei2: '',
            ramStorage: '',
            type: 'device'
        };

        const imeiMatches = normalizedText.match(/\b(35\d{13}|86\d{13}|01\d{13}|\d{15})\b/g);
        if (imeiMatches && imeiMatches.length > 0) {
            parsed.imei1 = imeiMatches[0];
            if (imeiMatches.length > 1) parsed.imei2 = imeiMatches[1];
        }

        const brandsList = ['SAMSUNG', 'APPLE', 'IPHONE', 'OPPO', 'VIVO', 'REALME', 'XIAOMI', 'REDMI', 'ONEPLUS', 'GOOGLE', 'PIXEL', 'HONOR', 'HUAWEI'];
        const foundBrand = brandsList.find(b => fullText.includes(b));
        if (foundBrand) {
            parsed.brandName = foundBrand === 'IPHONE' ? 'APPLE' : foundBrand;
        }

        const modelLine = lines.find(l => {
            const up = l.toUpperCase();
            return up.includes('GALAXY') || up.includes('IPHONE') || up.includes('REDMI') || up.includes('POCO') || up.includes('PRO MAX') || up.includes('ULTRA');
        });
        if (modelLine) parsed.modelName = modelLine;

        const ramStorageMatch = normalizedText.match(/\b(\d{1,3}\s?GB|\d{1,3}\s?TB)\b/gi);
        if (ramStorageMatch) {
            parsed.ramStorage = ramStorageMatch.join(' / ');
        }

        return parsed;
    };

    const handleFileScan = async (file) => {
        if (!file) return;

        setErrorMessage('');
        setSyncSuccess(false);
        setParsedResult(null);

        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);

        setScanning(true);
        setStatusText('កំពុងរៀបចំ និង Sharpen រូបភាព (ប្រឆាំងរូបព្រាល)...');

        try {
            const enhancedDataUrl = await preprocessImageForOCR(file);
            setStatusText('កំពុងអានអត្ថបទ (ខ្មែរ + អង់គ្លេស)...');

            let worker;
            try {
                worker = await createWorker(['eng', 'khm']);
            } catch {
                worker = await createWorker('eng');
            }

            const { data } = await worker.recognize(enhancedDataUrl);
            await worker.terminate();

            const parsed = scanTab === 'doc' ? parseDocData(data.text || '') : parseDeviceData(data.text || '');
            setParsedResult(parsed);

            setStatusText('កំពុងបញ្ជូនទិន្នន័យទៅកាន់ Computer System...');

            const payloadKey = scanTab === 'doc' ? { docData: parsed } : { deviceSpecs: parsed };
            const res = await fetch(`${API_BASE}/phone-app/scan-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadKey)
            });

            const resData = await res.json();
            if (res.ok && resData.success) {
                setSyncSuccess(true);
            } else {
                setErrorMessage(resData.message || 'មិនអាចបញ្ជូនទិន្នន័យបានទេ');
            }
        } catch (err) {
            console.error('Scan error:', err);
            setErrorMessage('ការស្កេនមានបញ្ហា សូមព្យាយាមម្តងទៀត');
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="p-4 space-y-5 max-w-md mx-auto select-none font-sans">
            {/* Header Title */}
            <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-slate-100 font-khmer flex items-center justify-center gap-2">
                    <span>SYSTEM MDM Scanner</span>
                </h2>
                <p className="text-xs text-slate-400 font-khmer">
                    ស្កេនអត្តសញ្ញាណប័ណ្ណ ឬ ព័ត៌មានទូរស័ព្ទ (Specs/IMEI)
                </p>
            </div>

            {/* Premium Glassmorphic Tab Switcher */}
            <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-2 shadow-xl backdrop-blur-md">
                <button
                    onClick={() => { setScanTab('doc'); setParsedResult(null); setPreviewUrl(null); setSyncSuccess(false); setErrorMessage(''); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanTab === 'doc' 
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaIdCard className="text-base" />
                    <span>🪪 ស្កេនអត្តសញ្ញាណប័ណ្ណ</span>
                </button>
                <button
                    onClick={() => { setScanTab('device'); setParsedResult(null); setPreviewUrl(null); setSyncSuccess(false); setErrorMessage(''); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanTab === 'device' 
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaMobileAlt className="text-base" />
                    <span>📱 ស្កេន Specs ទូរស័ព្ទ</span>
                </button>
            </div>

            {/* Hidden File Inputs */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])} />

            {/* Error Feedback */}
            {errorMessage && (
                <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-3 shadow-xl animate-shake">
                    <FaExclamationTriangle className="text-xl text-red-400 flex-shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Success Feedback */}
            {syncSuccess && (
                <div className="p-4 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-2xl text-xs font-khmer font-bold flex items-start gap-3 shadow-xl">
                    <FaCheckCircle className="text-2xl text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold font-khmer">ស្កេន និងបញ្ជូនទិន្នន័យជោគជ័យ!</p>
                        <p className="text-[11px] text-emerald-300/90 font-normal font-khmer">
                            {scanTab === 'doc'
                                ? 'ទិន្នន័យអត្តសញ្ញាណប័ណ្ណ ត្រូវបញ្ជូនទៅបំពេញក្នុង Computer Form រួចរាល់។'
                                : 'ទិន្នន័យម៉ូឌែលទូរស័ព្ទ & IMEI ត្រូវបញ្ជូនទៅប្រព័ន្ធ Computer រួចរាល់។'}
                        </p>
                    </div>
                </div>
            )}

            {/* Loading Spinner */}
            {scanning ? (
                <div className="p-8 bg-slate-900/90 border border-indigo-500/40 rounded-3xl text-center space-y-3 backdrop-blur-md shadow-2xl">
                    <FaSpinner className="text-4xl text-indigo-400 animate-spin mx-auto" />
                    <p className="text-xs text-indigo-300 font-khmer animate-pulse">{statusText}</p>
                </div>
            ) : previewUrl ? (
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-3 shadow-xl backdrop-blur-md">
                    <img src={previewUrl} alt="Scanned preview" className="max-h-52 mx-auto rounded-2xl border border-slate-700 shadow-md object-contain" />
                    
                    {parsedResult && (
                        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-1.5 text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-khmer">
                                📊 លទ្ធផលបំបែកទិន្នន័យស្កេន (Parsed Results)
                            </span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {parsedResult.customerNameEn && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">Name EN</span>
                                        <span className="font-bold text-white">{parsedResult.customerNameEn}</span>
                                    </div>
                                )}
                                {parsedResult.customerNameKh && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">ឈ្មោះ ខ្មែរ</span>
                                        <span className="font-bold text-indigo-300 font-khmer">{parsedResult.customerNameKh}</span>
                                    </div>
                                )}
                                {parsedResult.idCardNumber && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">ID Number</span>
                                        <span className="font-mono font-bold text-emerald-400">{parsedResult.idCardNumber}</span>
                                    </div>
                                )}
                                {parsedResult.modelName && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">Model</span>
                                        <span className="font-bold text-amber-300">{parsedResult.modelName}</span>
                                    </div>
                                )}
                                {parsedResult.imei1 && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">IMEI 1</span>
                                        <span className="font-mono font-bold text-sky-400">{parsedResult.imei1}</span>
                                    </div>
                                )}
                                {parsedResult.ramStorage && (
                                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                                        <span className="text-[9px] text-slate-400 block">Storage</span>
                                        <span className="font-bold text-slate-200">{parsedResult.ramStorage}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Scan Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 hover:from-indigo-500 hover:to-indigo-800 text-white font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xl shadow-indigo-600/25 active:scale-[0.98] border border-indigo-500/40"
                >
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white text-2xl shadow-inner">
                        <FaCamera />
                    </div>
                    <span>ថតតាមកាំមេរ៉ា (Camera)</span>
                </button>

                <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 hover:from-emerald-500 hover:to-teal-800 text-white font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xl shadow-emerald-600/25 active:scale-[0.98] border border-emerald-500/40"
                >
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white text-2xl shadow-inner">
                        <FaImage />
                    </div>
                    <span>ទម្លាក់រូបថតចូល (Gallery)</span>
                </button>
            </div>
        </div>
    );
};

export default ScanPage;
