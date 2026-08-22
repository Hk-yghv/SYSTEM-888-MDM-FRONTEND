import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaCamera, FaImage, FaCheckCircle, FaExclamationTriangle, FaSyncAlt, FaSpinner, FaIdCard, FaLaptop, FaQrcode, FaPlug, FaHourglass, FaPaperPlane } from 'react-icons/fa';

const ScanPage = ({ API_BASE, onUpdateApiUrl }) => {
    const [scanMode, setScanMode] = useState('doc'); // 'doc' (Document Scan) | 'qr' (Live QR System Connect)
    const [createSessionActive, setCreateSessionActive] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected' | 'pending' | 'disconnected'
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [pairMsg, setPairMsg] = useState('');
    const [pairStatus, setPairStatus] = useState('');

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const scannerRef = useRef(null);

    const checkComputerStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/phone-app/status`);
            if (res.ok) {
                const data = await res.json();
                setCreateSessionActive(Boolean(data.createSessionActive));
                if (data.device?.isConnected) {
                    setConnectionStatus('connected');
                } else if (data.device?.isPending) {
                    setConnectionStatus('pending');
                } else {
                    setConnectionStatus('disconnected');
                }
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

    // Send Pairing Request using Target API Base
    const sendPairRequest = async (targetApiBase = API_BASE) => {
        setScanning(true);
        setStatusText('កំពុងផ្ញើសំណើភ្ជាប់ទៅកាន់ Computer System...');
        setPairMsg('');
        setPairStatus('');
        setErrorMessage('');

        try {
            const res = await fetch(`${targetApiBase}/phone-app/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: "PH-" + Math.floor(1000 + Math.random() * 9000),
                    model: "Samsung Galaxy S24 Ultra",
                    brand: "SAMSUNG",
                    osVersion: "Android 14",
                    batteryLevel: 94,
                    ip: "192.168.1.105"
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.status === 'connected') {
                    setPairStatus('connected');
                    setPairMsg('🟢 ទូរស័ព្ទត្រូវបានភ្ជាប់ទៅកាន់ Computer System រួចរាល់!');
                } else {
                    setPairStatus('pending');
                    setPairMsg('⏳ ស្កេនជោគជ័យ! សំណើភ្ជាប់ត្រូវបានផ្ញើទៅ Computer! សូមមើលលើអេក្រង់ Computer ត្រង់ Settings > Phone App រួចចុច "Approve & Connect (អនុម័ត)"');
                }
                checkComputerStatus();
            } else {
                setErrorMessage(data.message || 'មិនអាចផ្ញើសំណើភ្ជាប់បានទេ');
            }
        } catch (err) {
            console.error('QR Pair error:', err);
            setErrorMessage('មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ សូមពិនិត្យមើលអុីនធឺណិត');
        } finally {
            setScanning(false);
        }
    };

    // Live Camera Stream QR Code Reader Callback
    const handleQrDecoded = async (decodedText) => {
        if (!decodedText) return;
        
        let targetApi = API_BASE;
        try {
            // Parse JSON payload from computer QR Code
            if (decodedText.startsWith('{')) {
                const payload = JSON.parse(decodedText);
                if (payload.apiUrl) {
                    targetApi = payload.apiUrl;
                    if (onUpdateApiUrl) {
                        onUpdateApiUrl(targetApi);
                    }
                }
            } else if (decodedText.startsWith('http')) {
                targetApi = decodedText;
                if (onUpdateApiUrl) {
                    onUpdateApiUrl(targetApi);
                }
            }
        } catch { }

        // Send pairing request immediately upon live scan detection
        await sendPairRequest(targetApi);
    };

    // Initialize Real-time Live Video Camera Stream Scanner when QR mode active
    useEffect(() => {
        if (scanMode !== 'qr') return;

        const scanner = new Html5QrcodeScanner(
            "qr-reader-container",
            {
                fps: 15,
                qrbox: { width: 240, height: 240 },
                rememberLastUsedCamera: true,
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                handleQrDecoded(decodedText);
                // Pause or clear scanner after successful scan
                try {
                    scanner.clear();
                } catch { }
            },
            () => {
                // Ignore scanning in progress frames
            }
        );

        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(() => {});
                } catch { }
            }
        };
    }, [scanMode]);

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

        if (connectionStatus !== 'connected') {
            setErrorMessage('ទូរស័ព្ទមិនទាន់ភ្ជាប់ទៅ Computer System ទេ! សូមចុច "Scan QR ភ្ជាប់ System" រួចចុច "ផ្ញើសំណើភ្ជាប់" មុននឹងស្កេន!');
            return;
        }

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
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanMode === 'doc' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaIdCard /> ស្កេនឯកសារ ID / Passport
                </button>
                <button
                    onClick={() => setScanMode('qr')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-khmer flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        scanMode === 'qr' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FaQrcode /> Scan QR ភ្ជាប់ System
                </button>
            </div>

            {/* Connection Status Banner */}
            <div className={`p-3.5 rounded-2xl border transition-all text-xs font-khmer shadow-lg flex items-center justify-between ${
                connectionStatus === 'connected'
                    ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                    : connectionStatus === 'pending'
                    ? 'bg-amber-950/80 border-amber-700/80 text-amber-300 animate-pulse'
                    : 'bg-red-950/80 border-red-800/80 text-red-300'
            }`}>
                <div className="flex items-center gap-2 font-bold text-xs">
                    {connectionStatus === 'connected' ? (
                        <><FaPlug className="text-emerald-400 text-base" /> <span>🟢 បានភ្ជាប់ទៅ Computer រួចរាល់ (Connected)</span></>
                    ) : connectionStatus === 'pending' ? (
                        <><FaHourglass className="text-amber-400 text-base animate-spin" /> <span>⏳ កំពុងរង់ចាំ Admin លើ Computer អនុម័ត...</span></>
                    ) : (
                        <><FaExclamationTriangle className="text-red-400 text-base" /> <span>🔴 មិនទាន់ភ្ជាប់ទៅ Computer ទេ (Disconnected)</span></>
                    )}
                </div>
                <button onClick={checkComputerStatus} className="text-slate-300 hover:text-white p-1">
                    <FaSyncAlt className={loadingStatus ? "animate-spin text-indigo-400" : ""} />
                </button>
            </div>

            {/* Document Scan Mode */}
            {scanMode === 'doc' && (
                <>
                    <div className={`p-3.5 rounded-2xl border transition-all text-xs font-khmer shadow-md ${
                        createSessionActive 
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                        <div className="flex items-center gap-2 font-bold">
                            <FaLaptop className="text-base text-indigo-400" />
                            <span>
                                {createSessionActive 
                                    ? '🟢 ផ្ទាំង Create លើ Computer កំពុងបើកចំហ (Ready to Sync)' 
                                    : '🔴 ផ្ទាំង Create លើ Computer មិនទាន់បើកទេ (Blocked)'}
                            </span>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="p-4 bg-red-950 border border-red-800 text-red-300 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 shadow-xl">
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

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            onClick={() => {
                                if (connectionStatus !== 'connected') {
                                    setErrorMessage('ទូរស័ព្ទមិនទាន់ភ្ជាប់ទៅ Computer System ទេ! សូមចុច "Scan QR ភ្ជាប់ System" រួចចុច "ផ្ញើសំណើភ្ជាប់" មុននឹងស្កេន!');
                                    return;
                                }
                                if (!createSessionActive) { setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!'); return; }
                                cameraInputRef.current?.click();
                            }}
                            className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                                connectionStatus === 'connected' && createSessionActive ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-indigo-500 hover:scale-[1.02]' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                            }`}
                        >
                            <FaCamera className="text-2xl" />
                            <span>ថតតាមកាំមេរ៉ា (Camera)</span>
                        </button>

                        <button
                            onClick={() => {
                                if (connectionStatus !== 'connected') {
                                    setErrorMessage('ទូរស័ព្ទមិនទាន់ភ្ជាប់ទៅ Computer System ទេ! សូមចុច "Scan QR ភ្ជាប់ System" រួចចុច "ផ្ញើសំណើភ្ជាប់" មុននឹងស្កេន!');
                                    return;
                                }
                                if (!createSessionActive) { setErrorMessage('សូមបើកកន្លែង Create លើ Computer សិន ទើបអាចស្កេនបាន!'); return; }
                                galleryInputRef.current?.click();
                            }}
                            className={`p-4 rounded-2xl border font-khmer text-xs font-bold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                                connectionStatus === 'connected' && createSessionActive ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-500 hover:scale-[1.02]' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'
                            }`}
                        >
                            <FaImage className="text-2xl" />
                            <span>ទម្លាក់រូបថតចូល (Gallery)</span>
                        </button>
                    </div>
                </>
            )}

            {/* Real-time Automatic Live Video Camera QR Code Scanner */}
            {scanMode === 'qr' && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 text-center shadow-xl">
                    <div>
                        <h3 className="text-base font-bold text-slate-100 font-khmer flex items-center justify-center gap-2">
                            <FaQrcode className="text-emerald-400" />
                            <span>កាំមេរ៉ាស្កេន QR Code ភ្ជាប់ប្រព័ន្ធ</span>
                        </h3>
                        <p className="text-xs text-slate-400 font-khmer mt-1 leading-relaxed">
                            គ្រាន់តែតម្រង់កាំមេរ៉ាទូរស័ព្ទឱ្យចំ QR Code លើអេក្រង់ Computer ត្រង់ទំព័រ <strong className="text-indigo-400">Settings &rarr; Phone App</strong> នោះប្រព័ន្ធនឹងស្កេន និងផ្ញើសំណើភ្ជាប់អូតូភ្លាមៗ!
                        </p>
                    </div>

                    {pairMsg && (
                        <div className={`p-3.5 rounded-2xl text-xs font-khmer font-bold flex items-center gap-2 text-left border ${
                            pairStatus === 'connected'
                                ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                                : 'bg-amber-950 border-amber-700 text-amber-300 animate-pulse'
                        }`}>
                            <FaCheckCircle className="text-emerald-400 text-xl flex-shrink-0" />
                            <span>{pairMsg}</span>
                        </div>
                    )}

                    {/* Live HTML5 Video Camera Feed Frame Container */}
                    <div className="overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-black min-h-[260px] flex items-center justify-center relative shadow-inner">
                        <div id="qr-reader-container" className="w-full text-slate-100 font-khmer"></div>
                    </div>

                    {/* One-Tap Manual Fallback Pairing Request Button */}
                    <button
                        onClick={() => sendPairRequest()}
                        disabled={scanning}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer font-khmer transition-all active:scale-[0.98]"
                    >
                        <FaPaperPlane className="text-base" />
                        <span>{scanning ? 'កំពុងផ្ញើសំណើ...' : '⚡ ផ្ញើសំណើភ្ជាប់ទៅ Computer (Manual Request)'}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanPage;
