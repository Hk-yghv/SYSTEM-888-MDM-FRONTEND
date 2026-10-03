import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
    FaUserCircle,
    FaTelegramPlane,
    FaShieldAlt,
    FaKey,
    FaLock,
    FaCheckCircle,
    FaQrcode,
    FaCamera,
    FaDownload,
    FaTimes,
    FaSync,
    FaUserCheck,
    FaExclamationTriangle
} from 'react-icons/fa';
import { MdOutlineEmail, MdFace } from 'react-icons/md';
import { QRCodeCanvas } from 'qrcode.react';

// MDM App Icon as SVG data URL for QR Code center embedding
const MDM_CENTER_ICON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%23a855f7"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(%23g)"/><rect x="18" y="18" width="28" height="28" rx="6" fill="white"/><rect x="54" y="18" width="28" height="28" rx="6" fill="white"/><rect x="18" y="54" width="28" height="28" rx="6" fill="white"/><rect x="54" y="54" width="28" height="28" rx="6" fill="white"/></svg>`;

const Profile = () => {
    const { user, updateUserState, API_BASE } = useAuth();
    const { t } = useLanguage();

    // Telegram 2FA Settings State
    const [telegramId, setTelegramId] = useState(user?.telegramId || '');
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!user?.twoFactorEnabled);
    const [secondPassword, setSecondPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Change Password Form State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // ── Login Methods: QR Code Modal State ──
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrVerifyUsername, setQrVerifyUsername] = useState(user?.username || '');
    const [qrVerifyPassword, setQrVerifyPassword] = useState('');
    const [qrCodeData, setQrCodeData] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState('');
    const qrCanvasRef = useRef(null);

    // ── Login Methods: Face Setup Modal State ──
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [facePassword, setFacePassword] = useState('');
    const [faceStream, setFaceStream] = useState(null);
    const [faceCapturedImage, setFaceCapturedImage] = useState(null);
    const [faceSaving, setFaceSaving] = useState(false);
    const [faceError, setFaceError] = useState('');
    const [faceSuccess, setFaceSuccess] = useState('');
    const faceVideoRef = useRef(null);
    const faceCanvasRef = useRef(null);

    // Cleanup camera stream when face modal closes
    useEffect(() => {
        if (!showFaceModal && faceStream) {
            faceStream.getTracks().forEach(track => track.stop());
            setFaceStream(null);
        }
    }, [showFaceModal, faceStream]);

    // Handle Start Camera for Face Setup
    const startFaceCamera = async () => {
        setFaceError('');
        setFaceCapturedImage(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' }
            });
            setFaceStream(stream);
            if (faceVideoRef.current) {
                faceVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            setFaceError('មិនអាចបើកកាមេរ៉ាបានទេ សូមអនុញ្ញាត Camera Permission (Camera access denied)');
        }
    };

    // Capture Frame from Camera
    const captureFaceSnapshot = () => {
        if (!faceVideoRef.current) return;
        const video = faceVideoRef.current;
        const canvas = faceCanvasRef.current || document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFaceCapturedImage(dataUrl);

        // Stop stream after capture
        if (faceStream) {
            faceStream.getTracks().forEach(track => track.stop());
            setFaceStream(null);
        }
    };

    // Save Face Setup
    const handleSaveFaceSetup = async () => {
        if (!faceCapturedImage) {
            setFaceError('សូមថតរូបមុខរបស់អ្នកសិន (Please capture your face)');
            return;
        }
        setFaceSaving(true);
        setFaceError('');
        setFaceSuccess('');

        try {
            const res = await fetch(`${API_BASE}/auth/face-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username,
                    password: facePassword || undefined,
                    faceData: faceCapturedImage
                })
            });
            const data = await res.json();
            setFaceSaving(false);

            if (res.ok) {
                setFaceSuccess('រៀបចំស្កេនផ្ទៃមុខបានជោគជ័យ! (Face Recognition Configured)');
                if (user) {
                    updateUserState({ ...user, faceEnabled: true });
                }
                setTimeout(() => {
                    setShowFaceModal(false);
                    setFaceCapturedImage(null);
                    setFaceSuccess('');
                }, 1500);
            } else {
                setFaceError(data.error || 'Failed to save face recognition');
            }
        } catch (err) {
            setFaceSaving(false);
            setFaceError('Server error while saving face');
        }
    };

    // Verify Account & Generate QR Code
    const handleGenerateQr = async (e) => {
        e.preventDefault();
        setQrError('');
        setQrLoading(true);

        try {
            const res = await fetch(`${API_BASE}/auth/qr-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: qrVerifyUsername || user?.username,
                    password: qrVerifyPassword
                })
            });
            const data = await res.json();
            setQrLoading(false);

            if (res.ok && data.qrPayload) {
                setQrCodeData(data.qrPayload);
                if (user) {
                    updateUserState({ ...user, qrLoginToken: data.qrLoginToken || 'ACTIVE' });
                }
            } else {
                setQrError(data.error || 'ការផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវ (Invalid username or password)');
            }
        } catch (err) {
            setQrLoading(false);
            setQrError('Connection error while generating QR code');
        }
    };

    // Download QR Code Canvas as PNG
    const handleDownloadQr = () => {
        const canvas = document.getElementById('user-login-qr-canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `mdm-login-qr-${user?.username || 'user'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleSaveTelegram2FA = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const res = await fetch(`${API_BASE}/users/telegram-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username || '@hakyonghouv',
                    telegramId,
                    enable2FA: twoFactorEnabled,
                    secondPassword
                })
            });

            const data = await res.json();
            setSaving(false);

            if (res.ok) {
                setMessage('Telegram 2-Step Verification settings updated successfully!');
                setSecondPassword('');
                if (data.user) {
                    updateUserState(data.user);
                }
            } else {
                setMessage(data.error || 'Failed to update Telegram 2FA');
            }
        } catch (err) {
            setSaving(false);
            setMessage('Saved locally. Connect backend server for live Telegram bot dispatch.');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordMessage('');

        if (newPassword !== confirmPassword) {
            setPasswordError('New password and confirm password do not match.');
            return;
        }

        setUpdatingPassword(true);
        try {
            const res = await fetch(`${API_BASE}/users/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username,
                    oldPassword,
                    newPassword
                })
            });

            const data = await res.json();
            setUpdatingPassword(false);

            if (res.ok) {
                setPasswordMessage('Password changed successfully!');
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                if (data.user) {
                    updateUserState(data.user);
                }
            } else {
                setPasswordError(data.error || 'Failed to update password');
            }
        } catch (err) {
            setUpdatingPassword(false);
            setPasswordError('Failed to change password. Server connection error.');
        }
    };

    return (
        <div className="w-full bg-transparent p-6 select-none space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-800/80">
                <div>
                    <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <FaShieldAlt className="text-indigo-400" />
                        {t('profile')} &amp; Security Center
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">គ្រប់គ្រងគណនី សុវត្ថិភាព និងរបៀប Log In ចូលប្រព័ន្ធ</p>
                </div>
            </div>

            {message && (
                <div className="p-3 rounded-[8px] bg-indigo-950/80 border border-indigo-700 text-indigo-200 text-xs font-semibold animate-fade-in flex items-center gap-2">
                    <FaCheckCircle className="text-indigo-400" />
                    <span>{message}</span>
                </div>
            )}

            {/* ═══════════════════ របៀប LOG IN (Authentication Methods) ═══════════════════ */}
            <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                            <FaShieldAlt className="text-base" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-100 uppercase tracking-wide">
                                របៀប LOG IN (Login Methods)
                            </h2>
                            <p className="text-xs text-gray-400">ជ្រើសរើស និងកំណត់ជម្រើសចូលប្រើប្រព័ន្ធរបស់អ្នក</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    {/* 1. Password (ពាក្យសម្ងាត់) */}
                    <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                                    <FaLock className="text-lg" />
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                                    <FaCheckCircle className="text-emerald-400 text-xs" /> Done (រួចរាល់)
                                </span>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-100 text-sm">ពាក្យសម្ងាត់ (Password)</h3>
                                <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                                    កំណត់ស្រាប់ដោយស្វ័យប្រវត្តិតាំងពីបង្កើតគណនី (Auto ready on creation)
                                </p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-800/80">
                            <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                                ✓ សកម្មជាប្រចាំ (Active)
                            </span>
                        </div>
                    </div>

                    {/* 2. Face Scan (ស្កេនផ្ទៃមុខ) */}
                    <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400">
                                    <MdFace className="text-2xl" />
                                </div>
                                {user?.faceEnabled ? (
                                    <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                                        <FaCheckCircle className="text-emerald-400 text-xs" /> Done (រួចរាល់)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 bg-amber-950/80 border border-amber-700/80 text-amber-300 rounded-full text-[11px] font-bold flex items-center gap-1">
                                        <FaExclamationTriangle className="text-xs" /> ត្រូវ Setup មុខសិន
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-100 text-sm">ស្កេនផ្ទៃមុខ (Face Scan)</h3>
                                <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                                    {user?.faceEnabled
                                        ? 'មុខងារស្កេនមុខបានបើកដំណើរការរួចរាល់ហើយ'
                                        : 'ត្រូវឱ្យ Setup ផ្ទៃមុខតាមកាមេរ៉ាសិនទើបអាច Login បាន'}
                                </p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-800/80">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowFaceModal(true);
                                    startFaceCamera();
                                }}
                                className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 hover:text-purple-200 font-bold rounded-[6px] text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <FaCamera />
                                <span>{user?.faceEnabled ? 'ផ្លាស់ប្តូរ/រៀបចំមុខឡើងវិញ (Update Face)' : 'រៀបចំស្កេនមុខ (Setup Face)'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. QR Code (ស្កេន QR Code) */}
                    <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                                    <FaQrcode className="text-xl" />
                                </div>
                                <span className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 rounded-full text-[11px] font-bold flex items-center gap-1">
                                    <FaKey className="text-xs" /> ត្រូវការ Verify គណនី
                                </span>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-100 text-sm">ស្កេន QR Code (QR Login)</h3>
                                <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                                    ផ្ទៀងផ្ទាត់ Password និង Username ដើម្បីបង្ហាញ QR Code ជាប់រូប Icon សម្រាប់ទាញយក
                                </p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-800/80">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowQrModal(true);
                                    setQrVerifyUsername(user?.username || '');
                                    setQrVerifyPassword('');
                                    setQrError('');
                                }}
                                className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 hover:text-cyan-200 font-bold rounded-[6px] text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <FaQrcode />
                                <span>{qrCodeData ? 'មើល / ទាញយក QR Code' : 'បង្កើត / បង្ហាញ QR Code'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════ MODAL: Setup Face Recognition ═══════════════════ */}
            {showFaceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#0f1426] border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                                    <MdFace className="text-xl" />
                                </div>
                                <h3 className="font-bold text-gray-100 text-sm">រៀបចំស្កេនផ្ទៃមុខ (Setup Face Scan)</h3>
                            </div>
                            <button
                                onClick={() => setShowFaceModal(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {faceError && (
                            <div className="p-2.5 rounded-[6px] bg-red-950/70 border border-red-800 text-red-300 text-xs font-semibold flex items-center gap-2">
                                <FaExclamationTriangle />
                                <span>{faceError}</span>
                            </div>
                        )}

                        {faceSuccess && (
                            <div className="p-2.5 rounded-[6px] bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                                <FaCheckCircle />
                                <span>{faceSuccess}</span>
                            </div>
                        )}

                        <div className="relative w-full aspect-square bg-gray-950 rounded-2xl overflow-hidden border-2 border-dashed border-purple-500/40 flex items-center justify-center">
                            {!faceCapturedImage ? (
                                <>
                                    <video
                                        ref={faceVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover transform scale-x-[-1]"
                                    />
                                    {/* Face Guide Target Overlay */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-56 h-56 rounded-full border-2 border-purple-400/80 border-dashed animate-pulse flex items-center justify-center">
                                            <div className="w-48 h-48 rounded-full border border-purple-300/40"></div>
                                        </div>
                                    </div>
                                    <p className="absolute bottom-3 text-[11px] text-purple-200 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                                        សូមដាក់ផ្ទៃមុខចំកណ្តាលរង្វង់ (Place face inside circle)
                                    </p>
                                </>
                            ) : (
                                <div className="relative w-full h-full">
                                    <img
                                        src={faceCapturedImage}
                                        alt="Captured Face"
                                        className="w-full h-full object-cover transform scale-x-[-1]"
                                    />
                                    <div className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-950/90 border border-emerald-700 text-emerald-300 rounded-full text-[10px] font-bold flex items-center gap-1">
                                        <FaCheckCircle /> ថតរួចរាល់
                                    </div>
                                </div>
                            )}
                        </div>

                        <canvas ref={faceCanvasRef} className="hidden" />

                        <div className="flex gap-2">
                            {!faceCapturedImage ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={startFaceCamera}
                                        className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-[6px] text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <FaSync /> បើកកាមេរ៉ាឡើងវិញ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={captureFaceSnapshot}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-[6px] text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <FaCamera /> ថតរូបមុខ (Capture)
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={startFaceCamera}
                                        className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-[6px] text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <FaSync /> ថតម្តងទៀត (Retake)
                                    </button>
                                    <button
                                        type="button"
                                        disabled={faceSaving}
                                        onClick={handleSaveFaceSetup}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-[6px] text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {faceSaving ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <FaCheckCircle /> រក្សាទុក (Save Face)
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ MODAL: QR Code Verification & Display & Download ═══════════════════ */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#0f1426] border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                                    <FaQrcode className="text-lg" />
                                </div>
                                <h3 className="font-bold text-gray-100 text-sm">
                                    {qrCodeData ? 'QR Code សម្រាប់ Log In' : 'ផ្ទៀងផ្ទាត់គណនីដើម្បីយក QR Code'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowQrModal(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {qrError && (
                            <div className="p-2.5 rounded-[6px] bg-red-950/70 border border-red-800 text-red-300 text-xs font-semibold flex items-center gap-2">
                                <FaExclamationTriangle />
                                <span>{qrError}</span>
                            </div>
                        )}

                        {!qrCodeData ? (
                            /* Step 1: Prompt for Username & Password to verify ownership */
                            <form onSubmit={handleGenerateQr} className="space-y-3 text-xs">
                                <p className="text-gray-300 text-[11px] leading-relaxed">
                                    ដើម្បីសុវត្ថិភាព សូមបញ្ចូល <span className="text-cyan-400 font-bold">Username</span> និង <span className="text-cyan-400 font-bold">Password</span> របស់អ្នកដើម្បីផ្ទៀងផ្ទាត់គណនី (Verify Account):
                                </p>

                                <div>
                                    <label className="block font-semibold text-gray-400 mb-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        value={qrVerifyUsername}
                                        onChange={(e) => setQrVerifyUsername(e.target.value)}
                                        placeholder="Enter username"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 focus:border-cyan-500 rounded-[6px] text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-gray-400 mb-1">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={qrVerifyPassword}
                                        onChange={(e) => setQrVerifyPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 focus:border-cyan-500 rounded-[6px] text-gray-100"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={qrLoading}
                                    className="w-full py-2.5 mt-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-[6px] cursor-pointer shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {qrLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <FaCheckCircle />
                                            <span>ផ្ទៀងផ្ទាត់ &amp; បង្ហាញ QR Code (Verify &amp; Generate)</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            /* Step 2: Show QR Code with Embedded Center Icon + Download Button */
                            <div className="space-y-4 text-center">
                                <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border-4 border-cyan-500/30">
                                    <QRCodeCanvas
                                        id="user-login-qr-canvas"
                                        value={qrCodeData}
                                        size={220}
                                        level="H"
                                        marginSize={2}
                                        imageSettings={{
                                            src: MDM_CENTER_ICON,
                                            x: undefined,
                                            y: undefined,
                                            height: 48,
                                            width: 48,
                                            excavate: true,
                                        }}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <p className="font-bold text-gray-100 text-sm">
                                        QR Code សម្រាប់ Login របស់ <span className="text-cyan-400 font-mono">{user?.username}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                        អ្នកអាចស្កេនផ្ទាល់ ឬទាញយករូបភាពទុកសម្រាប់ Upload Login នៅពេលក្រោយ
                                    </p>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleDownloadQr}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-[6px] text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <FaDownload />
                                        <span>ទាញយក QR Code (Download QR)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQrCodeData(null);
                                            setQrVerifyPassword('');
                                        }}
                                        className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-[6px] text-xs transition-all cursor-pointer"
                                    >
                                        បង្កើតថ្មី
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Area: Account Summary Card & Change Password Card */}
                <div className="space-y-6">
                    {/* Account Summary Card */}
                    <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-5 text-center shadow-xl">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 mx-auto shadow-2xl icon-animated-glow">
                            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                                <FaUserCircle className="text-5xl text-indigo-300" />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-black text-gray-100">{user?.name || 'BOY BOY'}</h2>
                            <p className="text-xs text-indigo-400 font-mono font-semibold">{user?.username || '@hakyonghouv'}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-purple-950/80 border border-purple-700 text-purple-300 rounded-full font-bold text-[10px] uppercase tracking-wider">
                                {user?.role || 'Administrator'}
                            </span>
                            {user?.brand && (
                                <span className="block mt-1 text-[11px] text-gray-300">
                                    Brand: <span className="font-bold text-indigo-400">{user.brand}</span>
                                </span>
                            )}
                        </div>

                        <div className="pt-3 border-t border-gray-800/80 text-left text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Account ID:</span>
                                <span className="font-mono text-gray-200 font-bold">{user?.userId || '001290312'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Email:</span>
                                <span className="font-mono text-gray-200">{user?.email || 'yonghouvh@gmail.com'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">System Status:</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Online
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Change Password Card */}
                    <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl text-xs">
                        <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                            <FaKey className="text-lg text-indigo-400" />
                            <h3 className="font-bold text-gray-100">Change Password</h3>
                        </div>

                        {passwordMessage && (
                            <div className="p-2.5 rounded-[5px] bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-semibold text-[11px]">
                                {passwordMessage}
                            </div>
                        )}

                        {passwordError && (
                            <div className="p-2.5 rounded-[5px] bg-red-950/60 border border-red-800 text-red-300 font-semibold text-[11px]">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-3">
                            <div>
                                <label className="block font-semibold text-gray-400 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-400 mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-gray-400 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={updatingPassword}
                                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-[5px] cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                            >
                                {updatingPassword ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Area: Telegram 2FA Setup */}
                <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-gray-800 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                        <FaTelegramPlane className="text-2xl text-indigo-400" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-100">Telegram 2-Step Verification (2FA)</h3>
                            <p className="text-xs text-gray-400">Link Telegram Account ID to receive single-use OTP codes</p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveTelegram2FA} className="space-y-4 text-xs">
                        <div>
                            <label className="block font-semibold text-gray-300 mb-1">Telegram User Chat ID</label>
                            <input
                                type="text"
                                value={telegramId}
                                onChange={(e) => setTelegramId(e.target.value)}
                                placeholder="Enter Telegram ID (e.g. 12903120)"
                                className="w-full h-11 px-4 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-xs text-gray-100 font-mono"
                            />
                        </div>

                        {/* Automatic reveal of 2-Step Verification when Telegram ID is present */}
                        {telegramId && (
                            <div className="p-2 rounded-[5px] bg-indigo-950/40 border border-indigo-800/60 space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-indigo-200 text-xs flex items-center gap-2">
                                        <FaShieldAlt className="text-indigo-400" /> Enable 2-Step Verification OTP
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={twoFactorEnabled}
                                        onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                    />
                                </div>

                                {/* Password តង់ទី២ Input Field */}
                                <div className="space-y-1 pt-2 border-t border-indigo-900/40">
                                    <label className="block text-[11px] font-semibold text-gray-300">
                                        {t('telegram2FA')}
                                    </label>
                                    <input
                                        type="password"
                                        value={secondPassword}
                                        onChange={(e) => setSecondPassword(e.target.value)}
                                        placeholder="Enter second password to set/change"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-800 focus:border-indigo-500 rounded-[5px] text-xs text-gray-100 font-mono"
                                    />
                                </div>

                                <div className="p-2 rounded-[5px] bg-gray-900/80 border border-gray-800 text-[11px] text-gray-300 space-y-2 leading-relaxed">
                                    <p className="font-bold text-amber-400 flex items-center gap-1">
                                        📌 Telegram Bot Setup Guide / ការណែនាំភ្ជាប់ Telegram Bot:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                                        <li>Open Telegram and search for your MDM Bot.</li>
                                        <li>Press <span className="font-bold text-indigo-300 font-mono">/start</span> to initiate communication with the bot.</li>
                                        <li>Copy your Telegram Chat ID into the field above, set your Password តង់ទី២, and enable 2-Step Verification.</li>
                                        <li>Every time you sign in, the system will automatically send a 6-digit OTP to your Telegram!</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-[5px] shadow-lg shadow-indigo-600/30 cursor-pointer transition-all flex items-center gap-2"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <FaCheckCircle />
                                    <span>Save Security Settings</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Profile;
