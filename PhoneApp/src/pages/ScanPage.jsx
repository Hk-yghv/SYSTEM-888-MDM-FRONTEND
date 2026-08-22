import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaCamera, FaImage, FaCheckCircle, FaExclamationTriangle, FaSyncAlt, FaSpinner, FaIdCard, FaLaptop } from 'react-icons/fa';

const ScanPage = ({ API_BASE }) => {
    const [createSessionActive, setCreateSessionActive] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    // ── Check Computer System Live Session Active Status ──
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

    // Parse Document Text (ID Card / Passport)
    const parseDoc = (text) => {
        const fullText = text.toUpperCase();
        let parsed = {
            customerNameEn: '',
            customerNameKh: '',
            idCardNumber: '',
            dob: '',
            gender: 'male',
            birthAddress: '',
            currentAddress: ''
        };

        const idMatches = text.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/) || 
                          text.match(/\b(ID|NO|NUM|PASSPORT)[:\s]*([A-Z0-9]{7,12})\b/i) ||
                          text.match(/\b([A-Z]\d{7,8}|\d{9,10})\b/);
        if (idMatches) parsed.idCardNumber = (idMatches[2] || idMatches[1] || idMatches[0]).replace(/\s+/g, '');

        const dobMatch = text.match(/\b(\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b/);
        if (dobMatch) {
            const rawDate = dobMatch[1].replace(/[\.-]/g, '/');
            const parts = rawDate.split('/');
            if (parts[0].length === 4) parsed.dob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            else if (parts[2].length === 4) parsed.dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        if (fullText.includes('FEMALE') || fullText.includes('SEX: F') || fullText.includes('ស្រី')) parsed.gender = 'female';
        else if (fullText.includes('MALE') || fullText.includes('SEX: M') || fullText.includes('ប្រុស')) parsed.gender = 'male';

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const nameCandidate = lines.find(l => l.length >= 4 && l === l.toUpperCase() && !l.includes('KINGDOM'));
        if (nameCandidate) parsed.customerNameEn = nameCandidate.replace(/[^A-Za-z\s]/g, '').trim();

        const khmerCandidate = lines.find(l => /[\u1780-\u17FF]/.test(l));
        if (khmerCandidate) parsed.customerNameKh = khmerCandidate.trim();

        return parsed;
    };

    const handleFileScan = async (file) => {
        if (!file) return;

        // STRICT ENFORCEMENT: Check Computer Create session first!
        if (!createSessionActive) {
            setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!');
            return;
        }

        setErrorMessage('');
        setSyncSuccess(false);

        // Preview Image
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);

        setScanning(true);
        setStatusText('កំពុងអានទិន្នន័យឯកសារ (ID / Passport)...');

        try {
            const worker = await createWorker('eng');
            const { data } = await worker.recognize(file);
            await worker.terminate();

            const parsedData = parseDoc(data.text || '');
            setStatusText('កំពុងផ្ញើទិន្នន័យទៅកាន់ Computer System ក្នុង Real-time...');

            // Submit to Backend Real-Time Scan Sync
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
            
            {/* Header Badge */}
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
                            ស្កេនអត្តសញ្ញាណប័ណ្ណ / Passport ចូល Computer Form
                        </p>
                    </div>
                </div>

                <button onClick={checkComputerStatus} className="text-slate-400 hover:text-white p-2">
                    <FaSyncAlt className={loadingStatus ? "animate-spin text-indigo-400" : ""} />
                </button>
            </div>

            {/* Computer Create Session Status Indicator */}
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
                <p className="text-[11px] mt-1 opacity-90">
                    {createSessionActive
                        ? 'អ្នកអាចស្កេនឥឡូវនេះបាន ទិន្នន័យនឹងរត់ចូល Computer Form ភ្លាមៗ realtime!'
                        : 'សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចអនុញ្ញាតឱ្យស្កេនបាន។'}
                </p>
            </div>

            {/* Error / Warning Alert */}
            {errorMessage && (
                <div className="p-4 bg-red-950 border border-red-800 text-red-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 shadow-xl animate-shake">
                    <FaExclamationTriangle className="text-xl text-red-400 flex-shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Success Sync Alert */}
            {syncSuccess && (
                <div className="p-4 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 shadow-xl">
                    <FaCheckCircle className="text-xl text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold">ស្កេន និងបញ្ជូនទិន្នន័យជោគជ័យ!</p>
                        <p className="text-[11px] opacity-90 font-normal">
                            ទិន្នន័យអត្តសញ្ញាណប័ណ្ណត្រូវបំពេញចូលក្នុង Computer Form អូតូ realtime រួចរាល់។
                        </p>
                    </div>
                </div>
            )}

            {/* Hidden Input Elements */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])}
            />
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])}
            />

            {/* Image Preview / Scan Loading */}
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

            {/* Scan Action Buttons: Camera & Gallery Upload */}
            <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                    onClick={() => {
                        if (!createSessionActive) {
                            setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!');
                            return;
                        }
                        cameraInputRef.current?.click();
                    }}
                    className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                        createSessionActive
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-indigo-500 hover:scale-[1.02]'
                            : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                    }`}
                >
                    <FaCamera className="text-2xl" />
                    <span>ថតតាមកាំមេរ៉ា (Camera)</span>
                </button>

                <button
                    onClick={() => {
                        if (!createSessionActive) {
                            setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!');
                            return;
                        }
                        galleryInputRef.current?.click();
                    }}
                    className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                        createSessionActive
                            ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-500 hover:scale-[1.02]'
                            : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                    }`}
                >
                    <FaImage className="text-2xl" />
                    <span>ទម្លាក់រូបថតចូល (Gallery)</span>
                </button>
            </div>

        </div>
    );
};

export default ScanPage;
