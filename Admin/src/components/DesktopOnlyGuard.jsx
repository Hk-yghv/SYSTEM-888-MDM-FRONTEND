import React, { useState, useEffect } from 'react';
import { FaDesktop, FaMobileAlt, FaExclamationTriangle } from 'react-icons/fa';
import { MdOutlineDashboard } from 'react-icons/md';

const DesktopOnlyGuard = ({ children }) => {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const checkDevice = () => {

            const width = window.innerWidth;
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (width < 1024 || isMobileUA) {
                setIsDesktop(false);
            } else {
                setIsDesktop(true);
            }
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    if (!isDesktop) {
        return (
            <div className="fixed inset-0 w-full h-screen bg-[#070913] flex flex-col items-center justify-center p-6 text-center z-[999999] select-none">
                {/* Ambient Background Glow */}
                <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

                <div className="max-w-md w-full p-8 rounded-3xl bg-[#0f1426]/95 border border-red-800/80 shadow-2xl backdrop-blur-xl space-y-6 relative z-10">
                    <div className="w-20 h-20 rounded-3xl bg-red-950/80 border border-red-700 mx-auto flex items-center justify-center text-red-400 text-3xl shadow-xl animate-bounce">
                        <FaDesktop />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                            <FaExclamationTriangle />
                            <span>Desktop Computer Screen Required</span>
                        </div>
                        <h1 className="text-xl font-white text-white font-khmer">
                            អនុញ្ញាតតែលើកុំព្យូទ័រ / Computer Only
                        </h1>
                        <p className="text-xs text-white leading-relaxed font-khmer pt-2">
                            ប្រព័ន្ធ SYSTEM MDM ត្រូវបានទាមទារឱ្យប្រើប្រាស់នៅលើអេក្រង់កុំព្យូទ័រ (Desktop / Laptop) ធំជាង 1024px ប៉ុណ្ណោះ។ ឧបករណ៍ Tablet ឬ ទូរស័ព្ទដៃមិនត្រូវបានអនុញ្ញាតឱ្យបើកចូលប្រើប្រាស់ឡើយ។
                        </p>
                    </div>

                    <div className="p-4 rounded-[5px] bg-white/80 border border-white text-left text-xs space-y-2">
                        <div className="flex items-center gap-3 text-red-400 font-semibold">
                            <FaMobileAlt className="text-lg" />
                            <span>Mobile & Tablet Access Restricted</span>
                        </div>
                        <p className="text-[11px] text-white-400">
                            Please open this website on a desktop computer browser to continue.
                        </p>
                    </div>

                    <div className="pt-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                        SYSTEM MDM Security Guard Protocol
                    </div>
                </div>
            </div>
        );
    }

    return children;
};

export default DesktopOnlyGuard;
