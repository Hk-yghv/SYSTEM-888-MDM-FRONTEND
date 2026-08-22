import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../../context/AuthContext';
import { FaQrcode, FaWifi, FaBroadcastTower, FaMobileAlt, FaBatteryThreeQuarters, FaMicrochip, FaMemory, FaHdd, FaSms, FaSyncAlt, FaUnlink, FaCheckCircle, FaLaptop } from 'react-icons/fa';
import { MdPhoneAndroid, MdDeveloperMode, MdOutlineSignalCellular4Bar } from 'react-icons/md';

const PhoneAppPage = () => {
    const { API_BASE } = useAuth();
    const [activeTab, setActiveTab] = useState('qrcode'); // 'qrcode' | 'wifi' | 'hotspot'
    const [deviceData, setDeviceData] = useState(null);
    const [createSessionActive, setCreateSessionActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const canvasRef = useRef(null);

    // ── Fetch Phone Status ──
    const fetchStatus = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/phone-app/status`);
            if (res.ok) {
                const data = await res.json();
                setDeviceData(data.device || null);
                setCreateSessionActive(data.createSessionActive || false);
            }
        } catch (err) {
            console.error('Fetch phone status error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [API_BASE]);

    // ── 3D Device Renderer (Three.js WebGL Interactive Smartphone) ──
    useEffect(() => {
        if (!canvasRef.current) return;

        const container = canvasRef.current;
        const width = container.clientWidth || 320;
        const height = container.clientHeight || 360;

        // Scene
        const scene = new THREE.Scene();
        scene.background = null;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 8);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Clear canvas container before appending
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x6366f1, 2.5);
        dirLight1.position.set(5, 10, 7);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x10b981, 2.0);
        dirLight2.position.set(-5, -5, -5);
        scene.add(dirLight2);

        // ── Construct 3D Phone Mesh ──
        const phoneGroup = new THREE.Group();

        // Phone Body Chassis
        const bodyGeo = new THREE.BoxGeometry(2.4, 4.8, 0.28);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.2,
        });
        const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
        phoneGroup.add(phoneBody);

        // Screen Bevel Front
        const screenGeo = new THREE.PlaneGeometry(2.2, 4.5);
        const canvasScreen = document.createElement('canvas');
        canvasScreen.width = 256;
        canvasScreen.height = 512;
        const ctx = canvasScreen.getContext('2d');

        // Draw Phone Screen UI onto Canvas Texture
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 512);

        // Header bar
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(0, 0, 256, 40);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('SYSTEM MDM', 16, 26);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('100% Connected', 150, 26);

        // Circle MDM Logo
        ctx.beginPath();
        ctx.arc(128, 160, 45, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#10b981';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MDM', 128, 168);

        // Device Info Text
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText(deviceData?.model || 'Samsung S24 Ultra', 128, 240);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText(`IMEI: ${deviceData?.imei1 || '358941109482103'}`, 128, 270);
        ctx.fillText(`Battery: ${deviceData?.batteryLevel || 88}% • 5G`, 128, 295);

        // Action Button
        ctx.fillStyle = '#10b981';
        ctx.roundRect(38, 360, 180, 42, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText('REAL-TIME SCANNER', 128, 386);

        const screenTexture = new THREE.CanvasTexture(canvasScreen);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenMesh.position.z = 0.145;
        phoneGroup.add(screenMesh);

        // Camera Lens Hole / Notch
        const cameraGeo = new THREE.CircleGeometry(0.08, 16);
        const cameraMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const cameraMesh = new THREE.Mesh(cameraGeo, cameraMat);
        cameraMesh.position.set(0, 2.15, 0.148);
        phoneGroup.add(cameraMesh);

        // Back Camera Bump
        const bumpGeo = new THREE.BoxGeometry(0.7, 1.0, 0.1);
        const bumpMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
        const bumpMesh = new THREE.Mesh(bumpGeo, bumpMat);
        bumpMesh.position.set(-0.6, 1.6, -0.16);
        phoneGroup.add(bumpMesh);

        // Lenses
        for (let i = 0; i < 3; i++) {
            const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
            const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 1 });
            const lens = new THREE.Mesh(lensGeo, lensMat);
            lens.rotation.x = Math.PI / 2;
            lens.position.set(-0.6, 1.8 - i * 0.3, -0.21);
            phoneGroup.add(lens);
        }

        scene.add(phoneGroup);

        // Mouse Drag Rotation Logic
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        const onMouseDown = (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            phoneGroup.rotation.y += deltaX * 0.015;
            phoneGroup.rotation.x += deltaY * 0.015;

            previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        const dom = renderer.domElement;
        dom.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Auto Slow Float Animation
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            if (!isDragging) {
                phoneGroup.rotation.y += 0.005;
                phoneGroup.position.y = Math.sin(Date.now() * 0.002) * 0.15;
            }
            renderer.render(scene, camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            dom.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (container.contains(dom)) container.removeChild(dom);
        };
    }, [deviceData]);

    return (
        <div className="w-full min-h-[93vh] bg-[#070913] p-4 text-slate-100 select-none space-y-4 overflow-y-auto">
            {/* Header */}
            <header className="p-4 border border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div>
                    <h1 className="text-xl font-extrabold text-indigo-400 flex items-center gap-2">
                        <MdPhoneAndroid className="text-2xl" />
                        <span>Phone App Connection Settings</span>
                        <span className="px-2.5 py-0.5 bg-indigo-950 border border-indigo-700 text-indigo-300 text-xs rounded-full font-normal">
                            System Integration
                        </span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-khmer">
                        គ្រប់គ្រងការភ្ជាប់ទូរស័ព្ទដៃ (Phone App) តាមរយៈ QR Code, Wi-Fi ឬ Hotspot និងមើលព័ត៌មានទូរស័ព្ទជា 3D
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchStatus}
                        disabled={reloading}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                    >
                        <FaSyncAlt className={reloading ? "animate-spin text-emerald-400" : ""} />
                        <span>Refresh Status</span>
                    </button>
                </div>
            </header>

            {/* Connection Mode Selection & Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left Column: Connection Pairing Modes (8 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    
                    {/* Pairing Method Tab Buttons */}
                    <div className="bg-[#0f1426] border border-gray-800 p-2 rounded-2xl flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('qrcode')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'qrcode'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <FaQrcode className="text-base" />
                            <span>QR Code Connect</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('wifi')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'wifi'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <FaWifi className="text-base" />
                            <span>Wi-Fi Network</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('hotspot')}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'hotspot'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <FaBroadcastTower className="text-base" />
                            <span>Hotspot AP</span>
                        </button>
                    </div>

                    {/* Pairing Tab Content */}
                    <div className="bg-[#0f1426] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                        {activeTab === 'qrcode' && (
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                {/* Simulated QR Code Box */}
                                <div className="p-4 bg-white rounded-2xl border-4 border-indigo-500 shadow-2xl flex flex-col items-center justify-center relative">
                                    <div className="w-44 h-44 bg-slate-900 rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden">
                                        {/* SVG QR Code pattern */}
                                        <svg viewBox="0 0 100 100" className="w-full h-full fill-indigo-400">
                                            <rect x="5" y="5" width="30" height="30" fill="none" stroke="#6366f1" strokeWidth="6" />
                                            <rect x="12" y="12" width="16" height="16" fill="#6366f1" />
                                            <rect x="65" y="5" width="30" height="30" fill="none" stroke="#6366f1" strokeWidth="6" />
                                            <rect x="72" y="12" width="16" height="16" fill="#6366f1" />
                                            <rect x="5" y="65" width="30" height="30" fill="none" stroke="#6366f1" strokeWidth="6" />
                                            <rect x="12" y="72" width="16" height="16" fill="#6366f1" />
                                            <rect x="42" y="42" width="16" height="16" fill="#10b981" />
                                            <rect x="65" y="65" width="12" height="12" fill="#6366f1" />
                                            <rect x="80" y="80" width="15" height="15" fill="#10b981" />
                                            <rect x="45" y="10" width="10" height="20" fill="#6366f1" />
                                            <rect x="10" y="45" width="20" height="10" fill="#6366f1" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-800 mt-2 font-mono">
                                        TOKEN: SYSTEM-MDM-PAIR-9982
                                    </span>
                                </div>

                                <div className="space-y-3 text-left">
                                    <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-700 text-[10px] font-bold uppercase rounded-full">
                                        Recommended Method
                                    </span>
                                    <h3 className="text-base font-bold text-slate-100 font-khmer">
                                        ភ្ជាប់តាមរយៈការ Scan QR Code
                                    </h3>
                                    <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside font-khmer">
                                        <li>បើកកម្មវិធី Phone App លើទូរស័ព្ទដៃ Android របស់អ្នក</li>
                                        <li>ជ្រើសរើស Brand រួចធ្វើការ Login</li>
                                        <li>ចុចលើប៊ូតុង <strong className="text-indigo-400">Scan QR Connect</strong> លើ App</li>
                                        <li>តម្រង់កាំមេរ៉ាទូរស័ព្ទមកកាន់ QR Code ខាងឆ្វេងនេះជាការស្រេច</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        {activeTab === 'wifi' && (
                            <div className="space-y-3 text-left">
                                <h3 className="text-base font-bold text-slate-100 font-khmer flex items-center gap-2">
                                    <FaWifi className="text-emerald-400" /> ភ្ជាប់តាមរយៈបណ្តាញ Local Wi-Fi Network
                                </h3>
                                <p className="text-xs text-slate-300 font-khmer">
                                    ប្រាកដថា Computer និង Phone របស់អ្នកស្ថិតក្នុងបណ្តាញ Wi-Fi តែមួយ៖
                                </p>
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                                    <div className="flex justify-between"><span className="text-slate-400">Server Host IP:</span><span className="text-indigo-400 font-bold">192.168.1.100</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Pairing Port:</span><span className="text-emerald-400 font-bold">5000</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Pairing PIN Code:</span><span className="text-amber-400 font-bold">882910</span></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'hotspot' && (
                            <div className="space-y-3 text-left">
                                <h3 className="text-base font-bold text-slate-100 font-khmer flex items-center gap-2">
                                    <FaBroadcastTower className="text-amber-400" /> ភ្ជាប់តាមរយៈ Mobile Hotspot
                                </h3>
                                <p className="text-xs text-slate-300 font-khmer">
                                    បើក Mobile Hotspot លើទូរស័ព្ទដៃ រួចភ្ជាប់ Computer ទៅកាន់ Hotspot នោះ៖
                                </p>
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                                    <div className="flex justify-between"><span className="text-slate-400">Hotspot AP Name:</span><span className="text-amber-400 font-bold">SYSTEM_MDM_AP</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Gateway IP:</span><span className="text-indigo-400 font-bold">192.168.43.1</span></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detailed Connected Phone Information */}
                    <div className="bg-[#0f1426] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaMobileAlt /> Connected Device Telemetry & Specifications
                            </h3>
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                deviceData?.isConnected 
                                    ? 'bg-emerald-950 border-emerald-700 text-emerald-400' 
                                    : 'bg-red-950 border-red-800 text-red-400'
                            }`}>
                                {deviceData?.isConnected ? '🟢 ACTIVE CONNECTED' : '🔴 DISCONNECTED'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">Device Model</span>
                                <span className="font-bold text-white">{deviceData?.model || '—'}</span>
                            </div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">IMEI 1</span>
                                <span className="font-mono text-indigo-300">{deviceData?.imei1 || '—'}</span>
                            </div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">IMEI 2</span>
                                <span className="font-mono text-indigo-300">{deviceData?.imei2 || '—'}</span>
                            </div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">Battery & Charging</span>
                                <span className="font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                    <FaBatteryThreeQuarters /> {deviceData?.batteryLevel}% {deviceData?.isCharging ? '(Charging)' : ''}
                                </span>
                            </div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">RAM & Storage</span>
                                <span className="text-slate-200">{deviceData?.ram} • {deviceData?.storage}</span>
                            </div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block text-[10px] font-semibold">IP Address & Network</span>
                                <span className="font-mono text-sky-400">{deviceData?.ip} ({deviceData?.carrier})</span>
                            </div>
                        </div>

                        {/* Recent SMS Preview */}
                        <div className="pt-2 border-t border-gray-800">
                            <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                                <FaSms className="text-indigo-400" /> Recent Phone SMS Messages ({deviceData?.smsCount || 0} Total)
                            </h4>
                            <div className="space-y-2">
                                {deviceData?.recentSms?.map((sms, i) => (
                                    <div key={i} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs flex justify-between items-start">
                                        <div>
                                            <span className="font-bold text-indigo-400 block">{sms.sender}</span>
                                            <p className="text-slate-300 text-[11px]">{sms.text}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono">{sms.date}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Interactive 3D Device Viewer (5 cols) */}
                <div className="lg:col-span-5 bg-[#0f1426] border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between items-center relative overflow-hidden min-h-[500px]">
                    <div className="w-full flex items-center justify-between border-b border-gray-800 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                <span>3D Interactive Device Model</span>
                            </h3>
                            <p className="text-[10px] text-slate-400 font-khmer">
                                ចាប់ទាញម៉ៅ (Mouse Drag) ដើម្បីបង្វិលរូប 3D ទូរស័ព្ទ 360°
                            </p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-400 text-[9px] font-bold rounded-full">
                            Interactive WebGL 3D
                        </span>
                    </div>

                    {/* Three.js Canvas Container */}
                    <div ref={canvasRef} className="w-full h-[380px] flex items-center justify-center cursor-grab active:cursor-grabbing relative">
                    </div>

                    <div className="w-full p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
                        <p className="text-xs text-indigo-300 font-bold">
                            {deviceData?.model || 'Samsung Galaxy S24 Ultra'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ID: {deviceData?.id} &bull; OS: {deviceData?.osVersion}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PhoneAppPage;
