import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Device3DPointers = ({ device }) => {
    const canvasRef = useRef(null);
    const [selectedFeature, setSelectedFeature] = useState(null);

    const modelName = device?.model || device?.device_model || 'Samsung Galaxy S24 Ultra';
    const serialNo = device?.serialNumber || device?.serial_number || 'RF8X109283';
    const imei1 = device?.imei1 || device?.imei1_number || '358941109482103';
    const brand = device?.brand || 'SAMSUNG';
    const color = device?.color || 'Titanium Gray';

    useEffect(() => {
        if (!canvasRef.current) return;

        const container = canvasRef.current;
        const width = container.clientWidth || 450;
        const height = container.clientHeight || 400;

        // Scene
        const scene = new THREE.Scene();
        scene.background = null;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 7.5);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x6366f1, 2.5);
        dirLight1.position.set(5, 10, 7);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x10b981, 2.0);
        dirLight2.position.set(-5, -5, -5);
        scene.add(dirLight2);

        // Phone Group
        const phoneGroup = new THREE.Group();

        // Color customization
        let bodyHex = 0x1e293b;
        if (color.toLowerCase().includes('gold')) bodyHex = 0xd97706;
        else if (color.toLowerCase().includes('titanium') || color.toLowerCase().includes('gray')) bodyHex = 0x334155;
        else if (color.toLowerCase().includes('black')) bodyHex = 0x0f172a;
        else if (color.toLowerCase().includes('white')) bodyHex = 0xe2e8f0;

        // Phone Body Chassis
        const bodyGeo = new THREE.BoxGeometry(2.3, 4.6, 0.28);
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.85, roughness: 0.2 });
        const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
        phoneGroup.add(phoneBody);

        // Screen Mesh Texture
        const canvasScreen = document.createElement('canvas');
        canvasScreen.width = 256;
        canvasScreen.height = 512;
        const ctx = canvasScreen.getContext('2d');

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, 256, 512);

        // Header bar
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(0, 0, 256, 45);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('SYSTEM MDM', 16, 28);

        // Model Badge
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(modelName, 128, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`SN: ${serialNo}`, 128, 210);
        ctx.fillText(`IMEI: ${imei1}`, 128, 235);

        ctx.fillStyle = '#10b981';
        ctx.roundRect(30, 320, 196, 44, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText('ENROLLED & ACTIVE', 128, 347);

        const screenTexture = new THREE.CanvasTexture(canvasScreen);
        const screenGeo = new THREE.PlaneGeometry(2.15, 4.35);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenMesh.position.z = 0.145;
        phoneGroup.add(screenMesh);

        // Camera Bump & Lenses
        const bumpGeo = new THREE.BoxGeometry(0.7, 1.1, 0.1);
        const bumpMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
        const bumpMesh = new THREE.Mesh(bumpGeo, bumpMat);
        bumpMesh.position.set(-0.6, 1.5, -0.16);
        phoneGroup.add(bumpMesh);

        for (let i = 0; i < 3; i++) {
            const lensGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16);
            const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 1 });
            const lens = new THREE.Mesh(lensGeo, lensMat);
            lens.rotation.x = Math.PI / 2;
            lens.position.set(-0.6, 1.7 - i * 0.32, -0.21);
            phoneGroup.add(lens);
        }

        // ── 3D Callout Lines & Glowing Feature Nodes ──
        const features = [
            { id: 'camera', name: '200MP Quad Camera System', desc: 'Main 200MP OIS + 50MP Telephoto Lens', pos: new THREE.Vector3(-0.6, 1.5, -0.21), target: new THREE.Vector3(-2.2, 1.8, 0) },
            { id: 'display', name: 'Dynamic AMOLED 2X Display', desc: '120Hz LTPO 2600 nits Peak Brightness', pos: new THREE.Vector3(0, 0.5, 0.15), target: new THREE.Vector3(2.2, 0.8, 0) },
            { id: 'chip', name: 'Snapdragon 8 Gen 3 for Galaxy', desc: 'High Efficiency 4nm Octa-Core Processor', pos: new THREE.Vector3(0, -0.8, 0.15), target: new THREE.Vector3(-2.2, -0.8, 0) },
            { id: 'battery', name: '5000 mAh Intelligent Battery', desc: '45W Super Fast Charging + Qi Wireless', pos: new THREE.Vector3(0, -1.8, 0), target: new THREE.Vector3(2.2, -1.8, 0) },
        ];

        features.forEach(feat => {
            // Node sphere
            const sphereGeo = new THREE.SphereGeometry(0.06, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.copy(feat.pos);
            phoneGroup.add(sphere);

            // Connector Line
            const lineGeo = new THREE.BufferGeometry().setFromPoints([feat.pos, feat.target]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.7 });
            const line = new THREE.Line(lineGeo, lineMat);
            phoneGroup.add(line);
        });

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

        const onMouseUp = () => { isDragging = false; };

        const dom = renderer.domElement;
        dom.addEventListener('mousedown', onMouseDown);
        dom.addEventListener('touchstart', (e) => onMouseDown(e.touches[0]));
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', (e) => e.touches[0] && onMouseMove(e.touches[0]));
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchend', onMouseUp);

        // Float Animation
        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            if (!isDragging) {
                phoneGroup.rotation.y += 0.005;
                phoneGroup.position.y = Math.sin(Date.now() * 0.002) * 0.12;
            }
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animId);
            dom.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (container.contains(dom)) container.removeChild(dom);
        };
    }, [device, color, modelName, serialNo, imei1]);

    return (
        <div className="w-full flex flex-col items-center relative">
            <div ref={canvasRef} className="w-full h-[360px] flex items-center justify-center cursor-grab active:cursor-grabbing relative">
            </div>

            {/* Overlay Specs Callout Badges */}
            <div className="grid grid-cols-2 gap-2 w-full pt-2 text-xs">
                <div className="p-2.5 bg-slate-900/90 border border-sky-500/40 rounded-xl text-left">
                    <span className="text-[10px] text-sky-400 font-bold uppercase block">📸 Camera System</span>
                    <span className="font-bold text-white text-xs">200MP Quad Camera</span>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-emerald-500/40 rounded-xl text-left">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">📱 Display Tech</span>
                    <span className="font-bold text-white text-xs">Dynamic AMOLED 120Hz</span>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-indigo-500/40 rounded-xl text-left">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase block">⚡ Processor / Chip</span>
                    <span className="font-bold text-white text-xs">Snapdragon 8 Gen 3</span>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-amber-500/40 rounded-xl text-left">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">🔋 Battery & Power</span>
                    <span className="font-bold text-white text-xs">5000 mAh &bull; 45W Fast</span>
                </div>
            </div>

            <p className="text-[10px] text-slate-400 font-khmer text-center mt-2">
                ✨ ចាប់ទាញម៉ៅ (Mouse Drag 360°) ដើម្បីបង្វិលមើលរូបរាង 3D ទូរស័ព្ទទាំងមូល និងបន្ទាត់បង្ហាញព័ត៌មាន
            </p>
        </div>
    );
};

export default Device3DPointers;
