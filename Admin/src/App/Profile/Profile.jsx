import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { FaUserCircle, FaTelegramPlane, FaShieldAlt, FaKey, FaLock, FaCheckCircle } from 'react-icons/fa';
import { MdOutlineEmail } from 'react-icons/md';

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
                        {t('profile')} & Security Center
                    </h1>
                </div>
            </div>

            {message && (
                <div className="p-1 rounded-[5px] bg-indigo-950/80 border border-indigo-700 text-indigo-200 text-xs font-semibold animate-fade-in">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Area: Account Summary Card & Change Password Card */}
                <div className="space-y-6">
                    {/* Account Summary Card */}
                    <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-5 text-center shadow-xl">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 p-1 mx-auto shadow-2xl icon-animated-glow">
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

                                <div className="p-1 rounded-[5px] bg-gray-900/80 border border-gray-800 text-[11px] text-gray-300 space-y-2 leading-relaxed">
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
