import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaIdCard, FaCloudUploadAlt, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaMobileAlt } from 'react-icons/fa';
import { MdOutlineCleaningServices } from 'react-icons/md';

const DocumentScanner = ({ onParsedData }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [extractedFields, setExtractedFields] = useState(null);
    const fileInputRef = useRef(null);

    // Convert Khmer numbers ០១២៣៤៥៦៧៨៩ to 0123456789
    const convertKhmerNumbers = (str) => {
        const khmerNums = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
        let result = str;
        khmerNums.forEach((kh, i) => {
            result = result.replace(new RegExp(kh, 'g'), i.toString());
        });
        return result;
    };

    // Canvas Image Pre-processing for Blurry / Low Contrast Images
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

    // Smart parser supporting ID Cards, Passports AND Phone Specs Screenshots
    const parseDocumentText = (rawText) => {
        const normalizedText = convertKhmerNumbers(rawText);
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
        const fullText = normalizedText.toUpperCase();

        let parsed = {
            customerNameEn: '',
            customerNameKh: '',
            idCardNumber: '',
            dob: '',
            gender: 'male',
            birthAddress: '',
            currentAddress: '',
            // Device Specs Fields
            brandName: '',
            modelName: '',
            imei1: '',
            imei2: '',
            ramStorage: ''
        };

        // ── Device Specs Parsing (Phone Screenshots / Specs photos) ──
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

        // ── Customer Document Parsing (ID Cards / Passports) ──
        const idMatches = normalizedText.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/) || 
                          normalizedText.match(/\b(ID|NO|NUM|PASSPORT|លេខ)[:\s]*([A-Z0-9]{7,12})\b/i) ||
                          normalizedText.match(/\b([A-Z]\d{7,8}|\d{9,10})\b/);
        if (idMatches) {
            parsed.idCardNumber = (idMatches[2] || idMatches[1] || idMatches[0]).replace(/\s+/g, '');
        }

        const dobMatch = normalizedText.match(/\b(\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b/);
        if (dobMatch) {
            const rawDate = dobMatch[1].replace(/[\.-]/g, '/');
            const parts = rawDate.split('/');
            if (parts[0].length === 4) {
                parsed.dob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                parsed.dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        if (fullText.includes('FEMALE') || fullText.includes('SEX: F') || fullText.includes('ស្រី') || fullText.includes('ភេទ ស្រី')) {
            parsed.gender = 'female';
        } else if (fullText.includes('MALE') || fullText.includes('SEX: M') || fullText.includes('ប្រុស') || fullText.includes('ភេទ ប្រុស')) {
            parsed.gender = 'male';
        }

        const nameCandidates = lines.filter(line => {
            const clean = line.replace(/[^A-Z\s]/g, '').trim();
            return clean.length >= 3 && clean === line.toUpperCase() && !clean.includes('KINGDOM') && !clean.includes('NATIONAL') && strokeCount(clean) === 0;
        });
        if (nameCandidates.length > 0) {
            parsed.customerNameEn = nameCandidates[0].replace(/[^A-Za-z\s]/g, '').trim();
        }

        const khmerLines = lines.filter(line => /[\u1780-\u17FF]/.test(line));
        const khmerNameLine = khmerLines.find(l => !l.includes('ព្រះរាជាណាចក្រ') && !l.includes('អត្តសញ្ញាណប័ណ្ណ') && !l.includes('សញ្ជាតិ'));
        if (khmerNameLine) {
            parsed.customerNameKh = khmerNameLine.replace(/(ឈ្មោះ|ភេទ|ថ្ងៃកំណើត|សញ្ជាតិ)/g, '').trim();
        }

        return parsed;
    };

    function strokeCount(str) {
        return (str.match(/[^A-Za-z\s]/g) || []).length;
    }

    const processImageFile = async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            alert('សូមជ្រើសរើសរូបភាពដែលត្រឹមត្រូវ (JPG, PNG, WEBP)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);

        setProcessing(true);
        setProgress(15);
        setStatusText('កំពុងរៀបចំ និង Sharpen រូបភាព (ប្រឆាំងរូបព្រាល)...');

        try {
            const enhancedImageDataUrl = await preprocessImageForOCR(file);
            setProgress(35);
            setStatusText('កំពុងអានអត្ថបទ (ខ្មែរ + អង់គ្លេស)...');

            let worker;
            try {
                worker = await createWorker(['eng', 'khm']);
            } catch {
                worker = await createWorker('eng');
            }

            setProgress(65);
            setStatusText('កំពុងស្កេន និងបំបែកព័ត៌មានឯកសារ / ព័ត៌មានទូរស័ព្ទ...');

            const { data } = await worker.recognize(enhancedImageDataUrl);
            setProgress(85);
            setStatusText('កំពុងបំពេញចូលក្នុង Form អូតូ...');

            const parsed = parseDocumentText(data.text || '');
            await worker.terminate();

            setProgress(100);
            setExtractedFields(parsed);

            if (onParsedData) {
                onParsedData(parsed);
            }
        } catch (err) {
            console.error('OCR Error:', err);
            setStatusText('ការស្កេនបរាជ័យ សូមព្យាយាមទម្លាក់រូបភាពម្តងទៀត');
        } finally {
            setTimeout(() => setProcessing(false), 500);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleClear = () => {
        setImagePreview(null);
        setExtractedFields(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-xl mb-4 relative overflow-hidden">
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                        <FaIdCard className="text-lg" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Universal OCR Scanner</span>
                            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600 text-emerald-400 text-[9px] rounded-full font-khmer">
                                🪪 អត្តសញ្ញាណប័ណ្ណ / Passport + 📱 ព័ត៌មានទូរស័ព្ទ (Specs/IMEI)
                            </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-khmer">
                            ទម្លាក់រូបភាពអត្តសញ្ញាណប័ណ្ណ ឬ រូបថត/Screenshot ព័ត៌មានទូរស័ព្ទ (Specs/IMEI) ចូលដើម្បីអានទិន្នន័យអូតូ
                        </p>
                    </div>
                </div>

                {imagePreview && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    >
                        <MdOutlineCleaningServices /> Clear Scanner
                    </button>
                )}
            </div>

            {/* Drop Zone Area */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !processing && fileInputRef.current?.click()}
                className={`w-full min-h-[120px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 cursor-pointer relative overflow-hidden ${
                    isDragging
                        ? 'border-indigo-400 bg-indigo-950/50 scale-[1.01]'
                        : imagePreview
                        ? 'border-indigo-600/50 bg-slate-950/70'
                        : 'border-slate-700 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-900/60'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && processImageFile(e.target.files[0])}
                />

                {processing ? (
                    <div className="w-full flex flex-col items-center py-3 space-y-3">
                        <FaSpinner className="text-3xl text-indigo-400 animate-spin" />
                        <div className="w-full max-w-xs bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                            <div
                                className="bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-300 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs font-khmer text-indigo-300 animate-pulse">{statusText}</p>
                    </div>
                ) : imagePreview ? (
                    <div className="w-full flex flex-col md:flex-row items-center gap-4">
                        <img
                            src={imagePreview}
                            alt="Scanned Document"
                            className="h-28 object-contain rounded-lg border border-indigo-500/40 shadow-lg"
                        />
                        <div className="flex-1 w-full text-left space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                                <FaCheckCircle /> Document & Phone Specs Scanned Successfully!
                            </div>
                            {extractedFields && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] pt-1">
                                    {extractedFields.customerNameEn && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">ឈ្មោះ អង់គ្លេស</span>
                                            <span className="font-bold text-white">{extractedFields.customerNameEn}</span>
                                        </div>
                                    )}
                                    {extractedFields.customerNameKh && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">ឈ្មោះ ខ្មែរ</span>
                                            <span className="font-bold text-indigo-300 font-khmer">{extractedFields.customerNameKh}</span>
                                        </div>
                                    )}
                                    {extractedFields.idCardNumber && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">ID / Passport No</span>
                                            <span className="font-mono font-bold text-emerald-400">{extractedFields.idCardNumber}</span>
                                        </div>
                                    )}
                                    {extractedFields.modelName && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">ម៉ូឌែលទូរស័ព្ទ (Model)</span>
                                            <span className="font-bold text-amber-300">{extractedFields.modelName}</span>
                                        </div>
                                    )}
                                    {extractedFields.imei1 && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">IMEI 1</span>
                                            <span className="font-mono font-bold text-sky-400">{extractedFields.imei1}</span>
                                        </div>
                                    )}
                                    {extractedFields.ramStorage && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">RAM & Storage</span>
                                            <span className="font-bold text-slate-200">{extractedFields.ramStorage}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shadow-inner">
                            <FaCloudUploadAlt className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-200 font-khmer">
                                ទម្លាក់រូបភាពអត្តសញ្ញាណប័ណ្ណខ្មែរ / Passport ឬ រូបថតព័ត៌មានទូរស័ព្ទ (Specs/IMEI) ទីនេះ
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Drag & Drop Document / Phone Specs Image Here or <span className="text-indigo-400 underline font-semibold">Browse File</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentScanner;
