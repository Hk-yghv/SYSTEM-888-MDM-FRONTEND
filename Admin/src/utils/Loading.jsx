import React from 'react';
import { MdOutlineDashboard } from 'react-icons/md';

const Loading = () => {
    return (
        <div className="w-full h-screen bg-[#070913] flex flex-col items-center justify-center relative overflow-hidden select-none p-4 z-50">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative flex items-center justify-center mb-6">
                {/* Outer Spinning Ring */}
                <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 border-r-purple-500 rounded-full animate-spin"></div>
                
                {/* Inner Counter-Spinning Ring */}
                <div className="absolute w-16 h-16 border-4 border-purple-500/20 border-b-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}></div>

                {/* Center Icon */}
                <div className="absolute w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/40 icon-animated-glow">
                    <MdOutlineDashboard className="text-white text-xl" />
                </div>
            </div>

            <div className="text-center space-y-2">
                <h2 className="text-xl font-black gradient-text-blue tracking-wider">SYSTEM MDM</h2>
                <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-300 font-medium">
                    <span>Loading System Resources</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                </div>
            </div>
        </div>
    );
};

export default Loading;