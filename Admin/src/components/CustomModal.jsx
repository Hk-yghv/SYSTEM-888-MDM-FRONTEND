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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f1426] border border-gray-700/80 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-center">
                <div className="w-14 h-14 rounded-[5px] bg-gray-900/90 border border-gray-700 flex items-center justify-center mx-auto shadow-inner">
                    {icons[type] || icons.info}
                </div>

                <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-100">{title || 'Notification'}</h3>
                    <p className="text-xs text-gray-300 leading-relaxed">{message}</p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                    {isConfirm && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-[5px] text-xs cursor-pointer transition-all border border-gray-700"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-6 py-2 text-white font-bold rounded-[5px] text-xs cursor-pointer transition-all shadow-lg ${
                            type === 'error' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30' :
                            type === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' :
                            'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
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
