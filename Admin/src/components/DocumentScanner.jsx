import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaIdCard, FaCloudUploadAlt, FaSpinner, FaCheckCircle, FaMobileAlt, FaImages, FaTrashAlt } from 'react-icons/fa';
import { MdOutlineCleaningServices } from 'react-icons/md';

const DocumentScanner = ({ onParsedData }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [imagePreviews, setImagePreviews] = useState([]);
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

    // Smart parser supporting ID Cards, Passports, and iOS / Android "About" screenshots
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
            brand: '',
            model: '',
            serialNumber: '',
            imei1: '',
            imei2: '',
            meid: '',
            version: '',
            color: ''
        };

        // ── 1. iOS "About" screen parsing (Key: Value structures) ──
        // Model Name (e.g. Model Name: iPhone 12 Pro Max)
        const modelNameMatch = normalizedText.match(/Model\s*Name[\s:\t]+([^\n\r]+)/i) ||
                               normalizedText.match(/\b(iPhone\s+[0-9]{1,2}(?:\s*(?:Pro\s*Max|Pro|Plus|Mini))?)\b/i) ||
                               normalizedText.match(/\b(Samsung\s+Galaxy\s+[^\n\r]+)/i);
        if (modelNameMatch) {
            parsed.model = (modelNameMatch[1] || modelNameMatch[0]).replace(/[\>\:\;]/g, '').trim();
            if (/iphone/i.test(parsed.model)) parsed.brand = 'Apple';
            else if (/samsung|galaxy/i.test(parsed.model)) parsed.brand = 'Samsung';
        }

        // Serial Number (e.g. Serial Number: F2LF96PN0D42 or G6TY82...)
        const serialMatch = normalizedText.match(/Serial\s*Number[\s:\t]+([A-Z0-9]{8,14})/i) ||
                            normalizedText.match(/\b([A-Z0-9]{10,12})\b/);
        if (serialMatch && !/AVAILABLE|CAPACITY|BLUETOOTH/i.test(serialMatch[1])) {
            parsed.serialNumber = serialMatch[1].trim();
        }

        // MEID (e.g. MEID: 35173227736075)
        const meidMatch = normalizedText.match(/MEID[\s:\t]+([0-9\s]{14,18})/i);
        if (meidMatch) {
            parsed.meid = meidMatch[1].replace(/\s+/g, '').trim();
        }

        // IMEI 1 & IMEI 2
        const imeiLabelMatch = normalizedText.match(/(?:^|\n)IMEI[\s:\t]+([0-9\s]{14,20})/i);
        const imei2LabelMatch = normalizedText.match(/IMEI2[\s:\t]+([0-9\s]{14,20})/i);

        if (imeiLabelMatch) {
            parsed.imei1 = imeiLabelMatch[1].replace(/\s+/g, '').trim();
        }
        if (imei2LabelMatch) {
            parsed.imei2 = imei2LabelMatch[1].replace(/\s+/g, '').trim();
        }

        if (!parsed.imei1) {
            const allImeiMatches = normalizedText.match(/\b(35\d{13}|86\d{13}|01\d{13}|\d{15})\b/g);
            if (allImeiMatches && allImeiMatches.length > 0) {
                parsed.imei1 = allImeiMatches[0];
                if (allImeiMatches.length > 1 && !parsed.imei2) {
                    parsed.imei2 = allImeiMatches[1];
                }
            }
        }

        // Capacity / Storage (e.g. Capacity: 128 GB)
        const capacityMatch = normalizedText.match(/Capacity[\s:\t]+([0-9]{1,4}\s*(?:GB|TB))/i) ||
                              normalizedText.match(/\b([0-9]{2,4}\s*(?:GB|TB))\b/i);
        if (capacityMatch) {
            parsed.version = capacityMatch[1].trim();
        }

        const brandsList = ['APPLE', 'SAMSUNG', 'OPPO', 'VIVO', 'REALME', 'XIAOMI', 'REDMI', 'ONEPLUS', 'GOOGLE', 'HONOR', 'HUAWEI'];
        const foundBrand = brandsList.find(b => fullText.includes(b));
        if (foundBrand && !parsed.brand) {
            parsed.brand = foundBrand === 'APPLE' ? 'Apple' : foundBrand;
        }

        // iOS Owner Name (e.g. Name: Chet Vandeth)
        const iosNameMatch = normalizedText.match(/Name[\s:\t]+([A-Za-z\s]{3,30})(?:\n|\>|$)/i);
        if (iosNameMatch && !/ABOUT|SETTINGS|GENERAL|WIFI|BLUETOOTH|CARRIER/i.test(iosNameMatch[1])) {
            parsed.customerNameEn = iosNameMatch[1].replace(/[\>]/g, '').trim();
        }

        // ── 2. Customer Document Parsing (ID Cards / Passports) ──
        const idMatches = normalizedText.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/) || 
                          normalizedText.match(/\b(ID|NO|NUM|PASSPORT|លេខ)[:\s]*([A-Z0-9]{7,12})\b/i) ||
                          normalizedText.match(/\b([A-Z]\d{7,8}|\d{9,10})\b/);
        if (idMatches && !/IMEI|MEID|ICCID/i.test(idMatches[0])) {
            const rawId = (idMatches[2] || idMatches[1] || idMatches[0]).replace(/\s+/g, '');
            if (rawId.length >= 7 && rawId.length <= 12) {
                parsed.idCardNumber = rawId;
            }
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

        if (!parsed.customerNameEn) {
            const nameCandidates = lines.filter(line => {
                const clean = line.replace(/[^A-Z\s]/g, '').trim();
                return clean.length >= 3 && clean === line.toUpperCase() && !clean.includes('KINGDOM') && !clean.includes('NATIONAL') && !clean.includes('ABOUT') && !clean.includes('CARRIER') && !clean.includes('NETWORK');
            });
            if (nameCandidates.length > 0) {
                parsed.customerNameEn = nameCandidates[0].replace(/[^A-Za-z\s]/g, '').trim();
            }
        }

        const khmerLines = lines.filter(line => /[\u1780-\u17FF]/.test(line));
        const khmerNameLine = khmerLines.find(l => !l.includes('ព្រះរាជាណាចក្រ') && !l.includes('អត្តសញ្ញាណប័ណ្ណ') && !l.includes('សញ្ជាតិ'));
        if (khmerNameLine) {
            parsed.customerNameKh = khmerNameLine.replace(/(ឈ្មោះ|ភេទ|ថ្ងៃកំណើត|សញ្ជាតិ)/g, '').trim();
        }

        return parsed;
    };

    const processFiles = async (files) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('សូមជ្រើសរើសរូបភាព (JPG, PNG, WEBP)');
            return;
        }

        const newPreviews = imageFiles.map(f => URL.createObjectURL(f));
        setImagePreviews(newPreviews);

        setProcessing(true);
        setProgress(10);
        setStatusText(`កំពុងដំណើរការ OCR លើរូបភាពចំនួន ${imageFiles.length}...`);

        let combinedParsed = {
            customerNameEn: '', customerNameKh: '', idCardNumber: '', dob: '', gender: 'male',
            birthAddress: '', currentAddress: '', brand: '', model: '', serialNumber: '',
            imei1: '', imei2: '', meid: '', version: '', color: ''
        };

        try {
            let worker;
            try {
                worker = await createWorker(['eng', 'khm']);
            } catch {
                worker = await createWorker('eng');
            }

            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const pct = Math.round(15 + ((i + 1) / imageFiles.length) * 70);
                setProgress(pct);
                setStatusText(`កំពុងស្កេនរូបភាពទី ${i + 1}/${imageFiles.length}...`);

                const enhancedDataUrl = await preprocessImageForOCR(file);
                const { data } = await worker.recognize(enhancedDataUrl);
                const result = parseDocumentText(data.text || '');

                Object.keys(result).forEach(key => {
                    if (result[key] && (!combinedParsed[key] || combinedParsed[key] === 'male')) {
                        combinedParsed[key] = result[key];
                    }
                });
            }

            await worker.terminate();

            setProgress(100);
            setStatusText('ស្កេនជោគជ័យ! បំពេញទិន្នន័យចូល Form រួចរាល់។');
            setExtractedFields(combinedParsed);

            if (onParsedData) {
                onParsedData(combinedParsed);
            }
        } catch (err) {
            console.error('OCR Error:', err);
            setStatusText('ការស្កេនមានបញ្ហា សូមព្យាយាមម្តងទៀត');
        } finally {
            setTimeout(() => setProcessing(false), 500);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
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
        setImagePreviews([]);
        setExtractedFields(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-3 shadow-xl mb-3 relative overflow-hidden">
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                        <FaImages className="text-sm" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Smart Multi-Image OCR Scanner</span>
                            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600 text-emerald-400 text-[9px] rounded-full font-khmer">
                                🪪 ID Card / Passport + 📱 iOS/Android Specs & MEID/IMEI
                            </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-khmer">
                            អាចទម្លាក់រូបភាពច្រើនក្នុងពេលតែមួយ (រូប ID Card + Screenshot About Part 1 & Part 2) ដើម្បីអានបំពេញម្តងទាំងអស់
                        </p>
                    </div>
                </div>

                {imagePreviews.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    >
                        <MdOutlineCleaningServices /> Reset
                    </button>
                )}
            </div>

            {/* Drop Zone Area */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !processing && fileInputRef.current?.click()}
                className={`w-full min-h-[90px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-3 cursor-pointer relative overflow-hidden ${
                    isDragging
                        ? 'border-indigo-400 bg-indigo-950/50 scale-[1.01]'
                        : imagePreviews.length > 0
                        ? 'border-indigo-600/50 bg-slate-950/70'
                        : 'border-slate-700 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-900/60'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && e.target.files.length > 0 && processFiles(e.target.files)}
                />

                {processing ? (
                    <div className="w-full flex flex-col items-center py-2 space-y-2">
                        <FaSpinner className="text-2xl text-indigo-400 animate-spin" />
                        <div className="w-full max-w-xs bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                            <div
                                className="bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-300 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs font-khmer text-indigo-300 animate-pulse">{statusText}</p>
                    </div>
                ) : imagePreviews.length > 0 ? (
                    <div className="w-full flex flex-col md:flex-row items-center gap-3">
                        <div className="flex gap-2 overflow-x-auto max-w-full pb-1">
                            {imagePreviews.map((src, i) => (
                                <img
                                    key={i}
                                    src={src}
                                    alt={`Scanned preview ${i + 1}`}
                                    className="h-20 w-auto object-contain rounded-lg border border-indigo-500/40 shadow-lg bg-black flex-shrink-0"
                                />
                            ))}
                        </div>
                        <div className="flex-1 w-full text-left space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                                <FaCheckCircle /> {imagePreviews.length} Image(s) Scanned Successfully!
                            </div>
                            {extractedFields && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] pt-1">
                                    {extractedFields.customerNameEn && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">Name EN</span>
                                            <span className="font-bold text-white truncate block">{extractedFields.customerNameEn}</span>
                                        </div>
                                    )}
                                    {extractedFields.idCardNumber && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">ID Card</span>
                                            <span className="font-mono font-bold text-emerald-400">{extractedFields.idCardNumber}</span>
                                        </div>
                                    )}
                                    {extractedFields.model && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">Model</span>
                                            <span className="font-bold text-amber-300 truncate block">{extractedFields.model}</span>
                                        </div>
                                    )}
                                    {extractedFields.serialNumber && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">Serial No.</span>
                                            <span className="font-mono font-bold text-purple-300 truncate block">{extractedFields.serialNumber}</span>
                                        </div>
                                    )}
                                    {extractedFields.imei1 && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">IMEI 1</span>
                                            <span className="font-mono font-bold text-sky-400">{extractedFields.imei1}</span>
                                        </div>
                                    )}
                                    {extractedFields.imei2 && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">IMEI 2</span>
                                            <span className="font-mono font-bold text-sky-300">{extractedFields.imei2}</span>
                                        </div>
                                    )}
                                    {extractedFields.meid && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">MEID</span>
                                            <span className="font-mono font-bold text-pink-400">{extractedFields.meid}</span>
                                        </div>
                                    )}
                                    {extractedFields.version && (
                                        <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                            <span className="text-slate-400 block text-[9px]">Storage / Version</span>
                                            <span className="font-bold text-slate-200">{extractedFields.version}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-1.5">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shadow-inner">
                            <FaCloudUploadAlt className="text-xl" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-200 font-khmer">
                                ទម្លាក់រូបភាពអត្តសញ្ញាណប័ណ្ណខ្មែរ / Passport ឬ Screenshots Specs/IMEI/MEID ទីនេះ (អាចជ្រើសរើសរូបភាពច្រើន)
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Select or Drop Multiple Images (ID Card + iOS/Android About Screenshots) or <span className="text-indigo-400 underline font-semibold">Browse Files</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentScanner;

