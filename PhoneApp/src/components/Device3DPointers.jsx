import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const Device3DPointers = ({ device }) => {
    const canvasRef = useRef(null);

    const modelName = device?.model || device?.device_model || 'Samsung Galaxy S24 Ultra';
    const serialNo = device?.serialNumber || device?.serial_number || 'RF8X109283';
    const imei1 = device?.imei1 || device?.imei1_number || '358941109482103';

    useEffect(() => {
        if (!canvasRef.current) return;

        const container = canvasRef.current;
        const width = container.clientWidth || 320;
        const height = container.clientHeight || 320;

        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 7.5);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x6366f1, 2.5);
        dirLight1.position.set(5, 10, 7);
        scene.add(dirLight1);

        const phoneGroup = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(2.3, 4.6, 0.28);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 });
        const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
        phoneGroup.add(phoneBody);

        const canvasScreen = document.createElement('canvas');
        canvasScreen.width = 256;
        canvasScreen.height = 512;
        const ctx = canvasScreen.getContext('2d');

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, 256, 512);

        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(0, 0, 256, 45);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('SYSTEM MDM', 16, 28);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(modelName, 128, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`SN: ${serialNo}`, 128, 210);
        ctx.fillText(`IMEI: ${imei1}`, 128, 235);

        const screenTexture = new THREE.CanvasTexture(canvasScreen);
        const screenGeo = new THREE.PlaneGeometry(2.15, 4.35);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenMesh.position.z = 0.145;
        phoneGroup.add(screenMesh);

        scene.add(phoneGroup);

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

        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            if (!isDragging) {
                phoneGroup.rotation.y += 0.005;
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
    }, [device, modelName, serialNo, imei1]);

    return (
        <div className="w-full flex flex-col items-center">
            <div ref={canvasRef} className="w-full h-[320px] flex items-center justify-center cursor-grab active:cursor-grabbing"></div>
        </div>
    );
};

export default Device3DPointers;
