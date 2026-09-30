import React from 'react';
import { FaMobileAlt, FaMicrochip, FaMemory, FaHdd, FaBatteryFull, FaShieldAlt, FaSimCard } from 'react-icons/fa';

const Device3DPointers = ({ device }) => {
    if (!device) return null;

    return (
        <div className="
    w-full
    bg-white
    border border-gray-200
    rounded-[5px]
    p-5
    text-gray-900
    space-y-4
    shadow-[0_8px_25px_rgba(0,0,0,0.06)]
    select-none
">

            {/* Header */}
            <div className="
        flex items-center justify-between
        border-b border-gray-100
        pb-4
    ">
                <div className="flex items-center gap-3 min-w-0">

                    {/* Device Icon */}
                    <div className="
                w-10 h-10
                shrink-0
                rounded-[5px]
                bg-emerald-50
                border border-emerald-100
                flex items-center justify-center
                text-emerald-600
                text-xl
            ">
                        <FaMobileAlt />
                    </div>

                    {/* Device Name */}
                    <div className="min-w-0">
                        <h4 className="
                    text-sm
                    font-bold
                    text-gray-900
                    truncate
                ">
                            {device.model || 'Smart Device'}
                        </h4>

                        <p className="
                    text-[10px]
                    text-gray-400
                    font-mono
                    mt-0.5
                    truncate
                ">
                            Serial:
                            <span className="text-gray-600 ml-1">
                                {device.serialNumber || '—'}
                            </span>
                        </p>
                    </div>
                </div>


                {/* Status */}
                <span className={`
            shrink-0
            px-2.5 py-1
            rounded-full
            text-[10px]
            font-bold
            border
            ${device.lockPhoneStatus === 'Locked'
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    }
        `}>
                    {device.lockPhoneStatus === 'Locked'
                        ? 'Locked'
                        : 'Active'}
                </span>

            </div>


            {/* Information */}
            <div className="
        grid
        grid-cols-2
        sm:grid-cols-3
        gap-2.5
        text-xs
        font-khmer
    ">

                {/* IMEI 1 */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-sky-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaSimCard className="text-sky-500" />
                        IMEI 1
                    </span>

                    <p className="
                font-mono
                font-bold
                text-sky-600
                text-[11px]
                truncate
            ">
                        {device.imei1 || '—'}
                    </p>
                </div>


                {/* IMEI 2 */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-sky-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaSimCard className="text-sky-500" />
                        IMEI 2
                    </span>

                    <p className="
                font-mono
                font-bold
                text-sky-600
                text-[11px]
                truncate
            ">
                        {device.imei2 || '—'}
                    </p>
                </div>


                {/* Storage */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-amber-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaHdd className="text-amber-500" />
                        Storage
                    </span>

                    <p className="
                font-bold
                text-gray-800
                text-[11px]
            ">
                        {device.capacity || '128 GB'}
                    </p>
                </div>


                {/* RAM */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-indigo-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaMemory className="text-indigo-500" />
                        RAM
                    </span>

                    <p className="
                font-bold
                text-gray-800
                text-[11px]
            ">
                        {device.ram || '-'}
                    </p>
                </div>


                {/* Battery */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-emerald-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaBatteryFull className="text-emerald-500" />
                        Battery
                    </span>

                    <p className="
                font-bold
                text-emerald-600
                text-[11px]
            ">
                        {device.batteryLevel
                            ? `${device.batteryLevel}%`
                            : '-'}
                    </p>
                </div>


                {/* MDM Guard */}
                <div className="
            p-3
            bg-gray-50
            rounded-[5px]
            border border-gray-200
            space-y-1.5
            hover:border-purple-200
            transition-colors
        ">
                    <span className="
                text-[10px]
                text-gray-400
                font-semibold
                flex items-center gap-1.5
            ">
                        <FaShieldAlt className="text-purple-500" />
                        MDM Guard
                    </span>

                    <p className="
                font-bold
                text-purple-600
                text-[11px]
            ">
                        Protected
                    </p>
                </div>

            </div>
        </div>
    );
};

export default Device3DPointers;
