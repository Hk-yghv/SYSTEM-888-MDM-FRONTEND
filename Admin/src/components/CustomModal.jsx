import React from 'react';
import { MdCheckCircle, MdError, MdWarning, MdInfo } from 'react-icons/md';

const CustomModal = ({ open, title, message, type = 'info', onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel', isConfirm = false }) => {
    if (!open) return null;

    const icons = {
        success: <MdCheckCircle className="text-emerald-400 text-3xl animate-bounce" />,
        error: <MdError className="text-red-400 text-3xl animate-bounce" />,
        warning: <MdWarning className="text-amber-400 text-3xl animate-bounce" />,
        info: <MdInfo className="text-indigo-400 text-3xl" />
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mx-auto shadow-xs">
                    {icons[type] || icons.info}
                </div>

                <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800">{title || 'Notification'}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                    {isConfirm && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all border border-slate-200"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-6 py-2 text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-sm ${type === 'error' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25' :
                                type === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25' :
                                    'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomModal;
