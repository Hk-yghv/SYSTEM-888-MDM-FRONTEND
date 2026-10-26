import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FaCircle, FaDesktop, FaFolderOpen, FaMicrophone, FaPause,
    FaPlay, FaStop, FaTimes, FaVideo
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const ScreenRecorderDock = () => {
    const { user } = useAuth();
    const isAuthenticated = Boolean(user);
    const [isOpen, setIsOpen] = useState(false);
    const [captureMicrophone, setCaptureMicrophone] = useState(false);
    const [captureSystemAudio, setCaptureSystemAudio] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [folderName, setFolderName] = useState('');
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const sourceStreamsRef = useRef([]);
    const audioContextRef = useRef(null);
    const chunksRef = useRef([]);
    const folderRef = useRef(null);
    const audioToggleStartXRef = useRef(null);

    const releaseStreams = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        sourceStreamsRef.current.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        sourceStreamsRef.current = [];
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            void audioContextRef.current.close().catch(closeError => {
                console.error('Failed to close screen recording audio context:', closeError);
            });
        }
        audioContextRef.current = null;
    }, []);

    const saveRecording = useCallback(async (blob) => {
        if (!blob.size) {
            setError('វីដេអូថតមិនមានទិន្នន័យទេ។ សូមពិនិត្យការអនុញ្ញាត ហើយសាកល្បងម្តងទៀត។');
            return;
        }

        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = `screen-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
        const folder = folderRef.current;
        if (folder) {
            try {
                const fileHandle = await folder.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                setSuccessMessage(`វីដេអូត្រូវបានរក្សាទុកក្នុង folder ${folder.name}។`);
                return;
            } catch (saveError) {
                console.error('Failed to save screen recording to the selected folder:', saveError);
                setError('មិនអាចរក្សាទុកក្នុង folder ដែលបានជ្រើសបានទេ។ សូមជ្រើស folder ម្តងទៀត ហើយសាកល្បង។');
                return;
            }
        }

        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        setSuccessMessage('វីដេអូបានទាញយកទៅទីតាំង Download លំនាំដើមរបស់ browser។');
    }, []);

    const stopRecording = useCallback(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
    }, []);

    const startRecording = async () => {
        setError('');
        setSuccessMessage('');
        if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
            setError('Browser នេះមិនគាំទ្រការថតអេក្រង់ទេ។ សូមប្រើ Chrome ឬ Edge ជំនាន់ថ្មី។');
            return;
        }

        let displayStream;
        let microphoneStream;
        try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: captureSystemAudio
            });
            if (captureSystemAudio && displayStream.getAudioTracks().length === 0) {
                throw new Error('Browser ឬ screen ដែលបានជ្រើសមិនបានផ្តល់សម្លេងកុំព្យូទ័រទេ។ សូមជ្រើស screen/tab ដែលគាំទ្រ audio ឬបិទជម្រើសនេះ។');
            }
            if (captureMicrophone) {
                microphoneStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true },
                    video: false
                });
            }

            const audioTracks = [
                ...displayStream.getAudioTracks(),
                ...(microphoneStream?.getAudioTracks() || [])
            ];
            sourceStreamsRef.current = [displayStream, ...(microphoneStream ? [microphoneStream] : [])];
            let recordingAudioTracks = audioTracks;
            if (audioTracks.length > 1) {
                const audioContext = new AudioContext();
                audioContextRef.current = audioContext;
                await audioContext.resume();
                const mixedAudio = audioContext.createMediaStreamDestination();
                audioTracks.forEach(track => {
                    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
                    source.connect(mixedAudio);
                });
                recordingAudioTracks = mixedAudio.stream.getAudioTracks();
            }
            const recordingStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...recordingAudioTracks
            ]);
            streamRef.current = recordingStream;
            chunksRef.current = [];

            const mimeType = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ].find(type => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onerror = event => {
                console.error('Screen recording failed:', event.error);
                setError('មានបញ្ហាក្នុងការថតអេក្រង់។ សូមសាកល្បងម្តងទៀត។');
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || 'video/webm'
                });
                chunksRef.current = [];
                recorderRef.current = null;
                releaseStreams();
                setIsRecording(false);
                setIsPaused(false);
                void saveRecording(blob);
            };
            displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
                if (recorder.state !== 'inactive') recorder.stop();
            }, { once: true });

            recorder.start(1000);
            setDuration(0);
            setIsRecording(true);
            setIsPaused(false);
            setShowSettings(false);
            setIsOpen(true);
        } catch (startError) {
            displayStream?.getTracks().forEach(track => track.stop());
            microphoneStream?.getTracks().forEach(track => track.stop());
            releaseStreams();
            console.error('Unable to start screen recording:', startError);
            setError(startError.name === 'NotAllowedError'
                ? 'ការចាប់អេក្រង់ត្រូវបានបោះបង់ ឬមិនបានអនុញ្ញាត។'
                : (startError.message || 'មិនអាចចាប់ផ្តើមថតអេក្រង់បានទេ។'));
        }
    };

    const chooseFolder = async () => {
        if (typeof window.showDirectoryPicker !== 'function') {
            setError('Browser នេះមិនគាំទ្រការជ្រើស folder ផ្ទាល់ទេ។ វីដេអូនឹងទាញយកទៅទីតាំង Download លំនាំដើម។');
            return;
        }
        try {
            const folder = await window.showDirectoryPicker({ mode: 'readwrite' });
            folderRef.current = folder;
            setFolderName(folder.name);
            setError('');
        } catch (folderError) {
            if (folderError.name !== 'AbortError') {
                console.error('Failed to select a recording folder:', folderError);
                setError('មិនអាចជ្រើស folder រក្សាទុកបានទេ។ សូមពិនិត្យសិទ្ធិរបស់ browser។');
            }
        }
    };

    const toggleAudioOnSwipe = (event, enabled, setEnabled) => {
        const startX = audioToggleStartXRef.current;
        audioToggleStartXRef.current = null;
        if (startX === null) return;
        const distance = event.clientX - startX;
        setEnabled(Math.abs(distance) > 20 ? distance > 0 : !enabled);
    };

    useEffect(() => {
        if (!isRecording || isPaused) return undefined;
        const intervalId = window.setInterval(() => setDuration(value => value + 1), 1000);
        return () => window.clearInterval(intervalId);
    }, [isRecording, isPaused]);

    useEffect(() => {
        if (!isAuthenticated) stopRecording();
    }, [isAuthenticated, stopRecording]);

    useEffect(() => () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.onstop = null;
            recorderRef.current.stop();
        }
        releaseStreams();
    }, [releaseStreams]);

    if (!isAuthenticated) return null;

    const audioOptions = [
        { label: 'សម្លេងពី Microphone', icon: <FaMicrophone />, enabled: captureMicrophone, setEnabled: setCaptureMicrophone },
        { label: 'សម្លេងពីក្នុងកុំព្យូទ័រ', icon: <FaDesktop />, enabled: captureSystemAudio, setEnabled: setCaptureSystemAudio }
    ];

    return (
        <div className="no-print fixed right-0 top-[45%] z-[100000]">
            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                aria-expanded={isOpen}
                aria-label={isRecording ? `កំពុងថត ${formatDuration(duration)}` : 'បើកការថតអេក្រង់'}
                title={isRecording ? `កំពុងថត ${formatDuration(duration)}` : 'ថតអេក្រង់'}
                className={`flex min-h-12 items-center gap-2 rounded-l-xl border-y border-l px-3 py-2 text-sm font-bold text-white shadow-xl cursor-pointer ${
                    isRecording ? 'border-rose-400 bg-rose-600' : 'border-violet-400 bg-violet-700 hover:bg-violet-800'
                }`}
            >
                {isRecording ? <FaCircle className={`text-[9px] ${isPaused ? 'text-amber-300' : 'animate-pulse'}`} /> : <FaVideo />}
                <span>{isRecording ? formatDuration(duration) : 'Record'}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-24px))] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="flex items-center gap-2 text-sm font-bold">
                            <FaVideo className="text-rose-600" /> ការថតអេក្រង់
                        </span>
                        <button type="button" onClick={() => setIsOpen(false)} aria-label="បិទ" className="text-slate-500 hover:text-slate-800 cursor-pointer">
                            <FaTimes />
                        </button>
                    </div>

                    {error && (
                        <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                            {successMessage}
                        </div>
                    )}

                    {isRecording ? (
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-bold">{isPaused ? 'បានផ្អាក' : 'កំពុងថត'} {formatDuration(duration)}</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const recorder = recorderRef.current;
                                        if (recorder?.state === 'recording') {
                                            recorder.pause();
                                            setIsPaused(true);
                                        } else if (recorder?.state === 'paused') {
                                            recorder.resume();
                                            setIsPaused(false);
                                        }
                                    }}
                                    aria-label={isPaused ? 'បន្តថត' : 'ផ្អាកថត'}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                                >
                                    {isPaused ? <FaPlay /> : <FaPause />}
                                </button>
                                <button
                                    type="button"
                                    onClick={stopRecording}
                                    aria-label="បញ្ឈប់ និងរក្សាទុកវីដេអូ"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                                >
                                    <FaStop />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="mb-3 text-xs text-slate-600">អូសប៊ូតុងទៅស្តាំដើម្បីបើក និងទៅឆ្វេងដើម្បីបិទសម្លេង។</p>
                            <div className="space-y-2">
                                {audioOptions.map(option => (
                                    <div key={option.label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                                        <span className="flex items-center gap-2 text-xs font-medium">
                                            <span className="text-violet-600">{option.icon}</span>{option.label}
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={option.enabled}
                                            aria-label={option.label}
                                            onPointerDown={event => { audioToggleStartXRef.current = event.clientX; }}
                                            onPointerUp={event => toggleAudioOnSwipe(event, option.enabled, option.setEnabled)}
                                            onPointerCancel={() => { audioToggleStartXRef.current = null; }}
                                            onKeyDown={event => {
                                                if (event.key === ' ' || event.key === 'Enter') {
                                                    event.preventDefault();
                                                    option.setEnabled(enabled => !enabled);
                                                }
                                            }}
                                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors touch-pan-y cursor-pointer ${option.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${option.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p className="my-3 text-[11px] text-slate-500">សម្លេងកុំព្យូទ័រអាស្រ័យលើ browser និង screen/tab ដែលបានជ្រើស។</p>
                            <button
                                type="button"
                                onClick={chooseFolder}
                                className="mb-3 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <FaFolderOpen className="shrink-0 text-amber-600" />
                                <span className="truncate">{folderName ? `រក្សាទុកក្នុង៖ ${folderName}` : 'ជ្រើស folder រក្សាទុកវីដេអូ'}</span>
                            </button>
                            <button type="button" onClick={startRecording} className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer">
                                <FaVideo /> ចាប់ផ្តើមថត
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScreenRecorderDock;
