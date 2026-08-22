import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { FaIdCard, FaCloudUploadAlt, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaMagic } from 'react-icons/fa';
import { MdOutlineCleaningServices } from 'react-icons/md';

const DocumentScanner = ({ onParsedData }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [extractedFields, setExtractedFields] = useState(null);
    const fileInputRef = useRef(null);

    // Smart regex parser for ID cards, Passports, and document text
    const parseDocumentText = (rawText) => {
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const fullText = rawText.toUpperCase();

        let parsed = {
            customerNameEn: '',
            customerNameKh: '',
            idCardNumber: '',
            dob: '',
            gender: 'male',
            birthAddress: '',
            currentAddress: ''
        };

        // 1. Parse ID Card Number or Passport Number
        // ID card: e.g. 010293847 or 010 293 847 or ID: 123456789
        const idMatches = rawText.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/) || 
                          rawText.match(/\b(ID|NO|NUM|PASSPORT)[:\s]*([A-Z0-9]{7,12})\b/i) ||
                          rawText.match(/\b([A-Z]\d{7,8}|\d{9,10})\b/);
        if (idMatches) {
            parsed.idCardNumber = (idMatches[2] || idMatches[1] || idMatches[0]).replace(/\s+/g, '');
        }

        // 2. Parse Date of Birth (DOB) - DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
        const dobMatch = rawText.match(/\b(\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b/);
        if (dobMatch) {
            const rawDate = dobMatch[1].replace(/[\.-]/g, '/');
            const parts = rawDate.split('/');
            if (parts[0].length === 4) {
                parsed.dob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                parsed.dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        // 3. Gender Detection
        if (fullText.includes('FEMALE') || fullText.includes('SEX: F') || fullText.includes('/F') || fullText.includes('ស្រី')) {
            parsed.gender = 'female';
        } else if (fullText.includes('MALE') || fullText.includes('SEX: M') || fullText.includes('/M') || fullText.includes('ប្រុស')) {
            parsed.gender = 'male';
        }

        // 4. Name extraction
        // Look for English Name lines (all caps words)
        const nameCandidates = lines.filter(line => {
            const clean = line.replace(/[^A-Z\s]/g, '').trim();
            return clean.length >= 3 && clean === line.toUpperCase() && !clean.includes('KINGDOM') && !clean.includes('NATIONAL') && strokeCount(clean) === 0;
        });

        if (nameCandidates.length > 0) {
            parsed.customerNameEn = nameCandidates[0].replace(/[^A-Za-z\s]/g, '').trim();
        }

        // Look for Khmer Name lines (non-ASCII characters)
        const khmerLine = lines.find(line => /[\u1780-\u17FF]/.test(line));
        if (khmerLine) {
            parsed.customerNameKh = khmerLine.trim();
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

        // Set image preview
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);

        setProcessing(true);
        setProgress(10);
        setStatusText('កំពុងរៀបចំឧបករណ៍ OCR Scanner...');

        try {
            const worker = await createWorker('eng');
            setProgress(40);
            setStatusText('កំពុងស្កេន និងអានអត្ថបទចេញពីរូបភាព...');

            const { data } = await worker.recognize(file);
            setProgress(85);
            setStatusText('កំពុងបំបែកព័ត៌មាន (Name, ID, DOB, Gender)...');

            const parsed = parseDocumentText(data.text || '');
            await worker.terminate();

            setProgress(100);
            setExtractedFields(parsed);

            // Pass parsed data back to parent modal form
            if (onParsedData) {
                onParsedData(parsed);
            }
        } catch (err) {
            console.error('OCR Error:', err);
            setStatusText('ការស្កេនបរាជ័យ សូមព្យាយាមទម្លាក់រូបភាពម្តងទៀត');
        } finally {
            setTimeout(() => setProcessing(false), 600);
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
                            <span>Document Scanner</span>
                            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600 text-emerald-400 text-[9px] rounded-full font-khmer">
                                អត្តសញ្ញាណប័ណ្ណ / Passport Scanner
                            </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-khmer">
                            ទម្លាក់រូបភាពចូល (Drag & Drop) ដើម្បីស្កេនទិន្នន័យបញ្ចូល Form អូតូ
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
                                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
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
                                <FaCheckCircle /> Document Scanned Successfully!
                            </div>
                            {extractedFields && (
                                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                                    <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                        <span className="text-slate-400 block text-[9px]">Extracted Name</span>
                                        <span className="font-bold text-white">{extractedFields.customerNameEn || extractedFields.customerNameKh || '—'}</span>
                                    </div>
                                    <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                        <span className="text-slate-400 block text-[9px]">ID / Passport No</span>
                                        <span className="font-mono font-bold text-indigo-300">{extractedFields.idCardNumber || '—'}</span>
                                    </div>
                                    <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                        <span className="text-slate-400 block text-[9px]">DOB</span>
                                        <span className="font-mono text-slate-200">{extractedFields.dob || '—'}</span>
                                    </div>
                                    <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                                        <span className="text-slate-400 block text-[9px]">Gender</span>
                                        <span className="capitalize text-slate-200">{extractedFields.gender}</span>
                                    </div>
                                </div>
                            )}
                            <p className="text-[10px] text-amber-300/90 italic pt-1 font-khmer">
                                ✨ ទិន្នន័យត្រូវបំពេញចូលក្នុង Form ខាងក្រោមអូតូ! អ្នកអាចកែសម្រួលបន្ថែមប្រសិនបើចាំបាច់។
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shadow-inner">
                            <FaCloudUploadAlt className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-200 font-khmer">
                                ទម្លាក់រូបភាពអត្តសញ្ញាណប័ណ្ណ ឬ លិខិតឆ្លងដែន ទីនេះ
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Drag & Drop Document Image Here or <span className="text-indigo-400 underline font-semibold">Browse File</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentScanner;
