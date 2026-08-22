import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
    let content = fs.readFileSync(manifestPath, 'utf8');
    const permissions = `
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
`;
    if (!content.includes('android.permission.CAMERA')) {
        content = content.replace('</manifest>', `${permissions}\n</manifest>`);
        fs.writeFileSync(manifestPath, content, 'utf8');
        console.log('✅ Successfully injected Camera permissions into AndroidManifest.xml!');
    } else {
        console.log('ℹ️ Camera permissions already present in AndroidManifest.xml');
    }
} else {
    console.warn('⚠️ AndroidManifest.xml not found at path:', manifestPath);
}
