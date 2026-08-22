import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const IDCard3DViewer = ({ customer }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const container = canvasRef.current;
        const width = container.clientWidth || 320;
        const height = container.clientHeight || 220;

        // Scene
        const scene = new THREE.Scene();
        scene.background = null;

        // Camera
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
        camera.position.set(0, 0, 5);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x6366f1, 2.5, 50);
        pointLight.position.set(3, 4, 5);
        scene.add(pointLight);

        const pointLight2 = new THREE.PointLight(0x10b981, 1.8, 50);
        pointLight2.position.set(-4, -3, 3);
        scene.add(pointLight2);

        // Group
        const cardGroup = new THREE.Group();

        // 1. Create Dynamic Canvas Texture for Front of 3D ID Card
        const canvasFront = document.createElement('canvas');
        canvasFront.width = 512;
        canvasFront.height = 320;
        const ctx = canvasFront.getContext('2d');

        // Card Background (Cambodia ID / Passport Theme)
        const bgGradient = ctx.createLinearGradient(0, 0, 512, 320);
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(0.5, '#1e1b4b');
        bgGradient.addColorStop(1, '#0284c7');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, 512, 320);

        // Border & Inner Frame
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 496, 304);

        // Header Title
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('KINGDOM OF CAMBODIA • ព្រះរាជាណាចក្រកម្ពុជា', 24, 34);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText('NATIONAL IDENTITY CARD', 24, 62);

        // Hologram SIM/Chip Icon
        ctx.fillStyle = '#f59e0b';
        ctx.roundRect(24, 80, 54, 42, 6);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(32, 88, 38, 26);

        // Customer Info
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('NAME (ENGLISH)', 100, 95);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText(customer?.customerNameEn || customer?.name_english || 'HAKYONG HOUV', 100, 118);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('NAME (KHMER)', 100, 145);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText(customer?.customerNameKh || customer?.name_khmer || 'ហាក់ យ៉ុងហូវ', 100, 168);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('ID CARD NO / PASSPORT', 100, 195);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(customer?.idCardNumber || customer?.id_number || '010293847', 100, 220);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`DOB: ${customer?.dob || '2000-01-01'}  •  GENDER: ${(customer?.gender || 'MALE').toUpperCase()}`, 100, 250);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`ADDR: ${customer?.currentAddress || 'Phnom Penh, Cambodia'}`, 24, 290);

        // Photo Box
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(370, 80, 118, 150);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(370, 80, 118, 150);

        // Default Avatar Drawing
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(429, 130, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(429, 210, 45, Math.PI, Math.PI * 2);
        ctx.fill();

        const frontTexture = new THREE.CanvasTexture(canvasFront);

        // 3D Box Card Geometry
        const cardGeo = new THREE.BoxGeometry(3.6, 2.25, 0.08);
        const cardMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }), // right
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }), // left
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }), // top
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }), // bottom
            new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.2, metalness: 0.4 }), // front
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.5 }) // back
        ];

        const cardMesh = new THREE.Mesh(cardGeo, cardMaterials);
        cardGroup.add(cardMesh);
        scene.add(cardGroup);

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

            cardGroup.rotation.y += deltaX * 0.015;
            cardGroup.rotation.x += deltaY * 0.015;

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

        // Slow Floating Animation
        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            if (!isDragging) {
                cardGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.25;
                cardGroup.rotation.x = Math.cos(Date.now() * 0.001) * 0.1;
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
    }, [customer]);

    return (
        <div className="w-full flex flex-col items-center">
            <div ref={canvasRef} className="w-full h-[220px] flex items-center justify-center cursor-grab active:cursor-grabbing"></div>
            <p className="text-[10px] text-indigo-300 font-khmer text-center mt-1 opacity-80">
                ✨ ចាប់ទាញម៉ៅ (Drag 360°) ដើម្បីបង្វិលមើលរូប 3D អត្តសញ្ញាណប័ណ្ណ
            </p>
        </div>
    );
};

export default IDCard3DViewer;
