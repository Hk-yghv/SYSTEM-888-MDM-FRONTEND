import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaCamera, FaImage, FaCheckCircle, FaExclamationTriangle, FaSyncAlt, FaSpinner, FaIdCard, FaLaptop, FaQrcode, FaPlug } from 'react-icons/fa';

const ScanPage = ({ API_BASE }) => {
    const [scanMode, setScanMode] = useState('doc'); // 'doc' (Document Scan) | 'qr' (QR System Connect)
    const [createSessionActive, setCreateSessionActive] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [pairSuccessMsg, setPairSuccessMsg] = useState('');

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const qrCameraInputRef = useRef(null);

    const checkComputerStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/phone-app/status`);
            if (res.ok) {
                const data = await res.json();
                setCreateSessionActive(Boolean(data.createSessionActive));
            }
        } catch (err) {
            console.error('Check status error:', err);
        } finally {
            setLoadingStatus(false);
        }
    };

    useEffect(() => {
        checkComputerStatus();
        const interval = setInterval(checkComputerStatus, 2000);
        return () => clearInterval(interval);
    }, [API_BASE]);

    // Pair Phone App with System via QR Code payload
    const handleQrCodeScan = async (file) => {
        if (!file) return;
        setScanning(true);
        setStatusText('កំពុងអាន QR Code ភ្ជាប់ប្រព័ន្ធ...');
        setPairSuccessMsg('');
        setErrorMessage('');

        try {
            // Read QR payload
            const worker = await createWorker('eng');
            const { data } = await worker.recognize(file);
            await worker.terminate();

            // Submit pairing request to Backend
            const res = await fetch(`${API_BASE}/phone-app/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: "PH-" + Math.floor(1000 + Math.random() * 9000),
                    model: "Samsung Galaxy S24 Ultra",
                    brand: "SAMSUNG",
                    lastSeen: new Date().toISOString()
                })
            });

            if (res.ok) {
                setPairSuccessMsg('ទូរស័ព្ទត្រូវបានភ្ជាប់ទៅកាន់ Computer System ដោយជោគជ័យ!');
            }
        } catch (err) {
            console.error('QR Pair error:', err);
            setErrorMessage('មិនអាចស្កេន QR Code បានទេ សូមព្យាយាមម្តងទៀត');
        } finally {
            setScanning(false);
        }
    };

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

    const parseDoc = (text) => {
        const normalizedText = convertKhmerNumbers(text);
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
        const fullText = normalizedText.toUpperCase();

        let parsed = {
            customerNameEn: '',
            customerNameKh: '',
            idCardNumber: '',
            dob: '',
            gender: 'male',
            birthAddress: '',
            currentAddress: ''
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

    const handleFileScan = async (file) => {
        if (!file) return;

        if (!createSessionActive) {
            setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!');
            return;
        }

        setErrorMessage('');
        setSyncSuccess(false);

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

            const parsedData = parseDoc(data.text || '');
            setStatusText('កំពុងផ្ញើទិន្នន័យទៅកាន់ Computer System ក្នុង Real-time...');

            const res = await fetch(`${API_BASE}/phone-app/scan-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docData: parsedData })
            });

            const resData = await res.json();
            if (res.ok && resData.success) {
                setSyncSuccess(true);
            } else {
                setErrorMessage(resData.message || 'សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!');
            }
        } catch (err) {
            console.error('Mobile scan sync error:', err);
            setErrorMessage('ការស្កេនមានបញ្ហា សូមព្យាយាមម្តងទៀត');
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="p-4 space-y-4 max-w-md mx-auto select-none">
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-2">
                <button
                    onClick={() => setScanMode('doc')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanMode === 'doc' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaIdCard /> ស្កេនឯកសារ ID / Passport
                </button>
                <button
                    onClick={() => setScanMode('qr')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanMode === 'qr' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaQrcode /> Scan QR ភ្ជាប់ System
                </button>
            </div>

            {/* Document Scan Mode */}
            {scanMode === 'doc' && (
                <>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-400">
                                <FaIdCard className="text-xl" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-100 font-khmer">
                                    Real-time Document Scanner
                                </h2>
                                <p className="text-[11px] text-indigo-300 font-khmer">
                                    ស្កេនអត្តសញ្ញាណប័ណ្ណខ្មែរ / Passport ចូល Computer
                                </p>
                            </div>
                        </div>
                        <button onClick={checkComputerStatus} className="text-slate-400 hover:text-white p-2">
                            <FaSyncAlt className={loadingStatus ? "animate-spin text-indigo-400" : ""} />
                        </button>
                    </div>

                    <div className={`p-4 rounded-2xl border transition-all text-xs font-khmer shadow-lg ${
                        createSessionActive 
                            ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300' 
                            : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                    }`}>
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <FaLaptop className="text-lg" />
                            <span>
                                {createSessionActive 
                                    ? '🟢 ផ្ទាំង Create លើ Computer កំពុងបើកចំហ (Ready to Sync)' 
                                    : '🔴 ផ្ទាំង Create លើ Computer មិនទាន់បើកទេ (Blocked)'}
                            </span>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="p-4 bg-red-950 border border-red-800 text-red-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 shadow-xl animate-shake">
                            <FaExclamationTriangle className="text-xl text-red-400 flex-shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {syncSuccess && (
                        <div className="p-4 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 shadow-xl">
                            <FaCheckCircle className="text-xl text-emerald-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold font-khmer">ស្កេន និងបញ្ជូនទិន្នន័យជោគជ័យ!</p>
                                <p className="text-[11px] opacity-90 font-normal font-khmer">
                                    ទិន្នន័យអត្តសញ្ញាណប័ណ្ណខ្មែរ ត្រូវបំពេញចូលក្នុង Computer Form អូតូ realtime រួចរាល់។
                                </p>
                            </div>
                        </div>
                    )}

                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])} />
                    <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])} />

                    {scanning ? (
                        <div className="p-8 bg-slate-900 border border-indigo-500/40 rounded-3xl text-center space-y-3">
                            <FaSpinner className="text-4xl text-indigo-400 animate-spin mx-auto" />
                            <p className="text-xs text-indigo-300 font-khmer animate-pulse">{statusText}</p>
                        </div>
                    ) : previewUrl ? (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
                            <img src={previewUrl} alt="Scanned preview" className="max-h-48 mx-auto rounded-xl border border-slate-700 shadow-md" />
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={() => {
                                if (!createSessionActive) { setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!'); return; }
                                cameraInputRef.current?.click();
                            }}
                            className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                                createSessionActive ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-indigo-500 hover:scale-[1.02]' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                            }`}
                        >
                            <FaCamera className="text-2xl" />
                            <span>ថតតាមកាំមេរ៉ា (Camera)</span>
                        </button>

                        <button
                            onClick={() => {
                                if (!createSessionActive) { setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!'); return; }
                                galleryInputRef.current?.click();
                            }}
                            className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                                createSessionActive ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-500 hover:scale-[1.02]' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                            }`}
                        >
                            <FaImage className="text-2xl" />
                            <span>ទម្លាក់រូបថតចូល (Gallery)</span>
                        </button>
                    </div>
                </>
            )}

            {/* QR System Pair Connect Mode */}
            {scanMode === 'qr' && (
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 text-center">
                    <input ref={qrCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleQrCodeScan(e.target.files[0])} />

                    <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 mx-auto flex items-center justify-center text-emerald-400">
                        <FaQrcode className="text-3xl" />
                    </div>

                    <div>
                        <h3 className="text-base font-bold text-slate-100 font-khmer">
                            Scan QR Code ភ្ជាប់ជាមួយ Computer System
                        </h3>
                        <p className="text-xs text-slate-400 font-khmer mt-1 leading-relaxed">
                            សូមតម្រង់កាំមេរ៉ាមកកាន់ QR Code ដែលបង្ហាញលើ Computer ត្រង់ទំព័រ <strong className="text-indigo-400">Settings &rarr; Phone App</strong>
                        </p>
                    </div>

                    {pairSuccessMsg && (
                        <div className="p-3 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-xl text-xs font-khmer font-bold flex items-center gap-2">
                            <FaCheckCircle className="text-emerald-400 text-base" />
                            <span>{pairSuccessMsg}</span>
                        </div>
                    )}

                    <button
                        onClick={() => qrCameraInputRef.current?.click()}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer font-khmer"
                    >
                        <FaCamera className="text-base" />
                        <span>ថត Scan QR Code លើ Computer</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanPage;
