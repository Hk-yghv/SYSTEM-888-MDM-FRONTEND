import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    FaCircle, FaDesktop, FaFolderOpen, FaMicrophone, FaPause,
    FaPlay, FaStop, FaVideo
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
    const [portalTarget, setPortalTarget] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
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
        const syncPortalTarget = () => {
            const target = document.getElementById('display-screen-recorder');
            setPortalTarget(current => current === target ? current : target);
        };
        syncPortalTarget();
        const observer = new MutationObserver(syncPortalTarget);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

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

    if (!isAuthenticated || !portalTarget) return null;

    const audioOptions = [
        { label: 'សម្លេងពី Microphone', icon: <FaMicrophone />, enabled: captureMicrophone, setEnabled: setCaptureMicrophone },
        { label: 'សម្លេងពីក្នុងកុំព្យូទ័រ', icon: <FaDesktop />, enabled: captureSystemAudio, setEnabled: setCaptureSystemAudio }
    ];

    return createPortal(
        <div className="space-y-2 border-b border-slate-100 pb-2 text-slate-800">
            {error && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                    {error}
                </div>
            )}
            {successMessage && (
                <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800">
                    {successMessage}
                </div>
            )}

            {isRecording ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 p-2 text-rose-700">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                        <FaCircle className={`text-[8px] ${isPaused ? 'text-amber-500' : 'animate-pulse text-rose-600'}`} />
                        {isPaused ? 'បានផ្អាក' : 'កំពុងថត'} {formatDuration(duration)}
                    </span>
                    <div className="flex gap-1.5">
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
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                        >
                            {isPaused ? <FaPlay /> : <FaPause />}
                        </button>
                        <button
                            type="button"
                            onClick={stopRecording}
                            aria-label="បញ្ឈប់ និងរក្សាទុកវីដេអូ"
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                        >
                            <FaStop />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => {
                            setError('');
                            setShowSettings(open => !open);
                        }}
                        aria-expanded={showSettings}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                    >
                        <span className="flex items-center gap-2">
                            <FaVideo className="text-rose-600" /> Record screen
                        </span>
                        <span className="text-[10px] text-slate-500">{showSettings ? 'បិទ' : 'កំណត់'}</span>
                    </button>

                    {showSettings && (
                        <div className="space-y-2 px-1 pb-1">
                            <p className="text-[10px] text-slate-500">អូសទៅស្តាំដើម្បីបើក និងឆ្វេងដើម្បីបិទសម្លេង។</p>
                            {audioOptions.map(option => (
                                <div key={option.label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium">
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
                                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors touch-pan-y cursor-pointer ${option.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${option.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={chooseFolder}
                                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[10px] text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <FaFolderOpen className="shrink-0 text-amber-600" />
                                <span className="truncate">{folderName ? `រក្សាទុក៖ ${folderName}` : 'ជ្រើស folder រក្សាទុក'}</span>
                            </button>
                            <p className="text-[10px] text-slate-500">សម្លេងកុំព្យូទ័រអាស្រ័យលើ browser និង screen/tab ដែលបានជ្រើស។</p>
                            <button
                                type="button"
                                onClick={startRecording}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                            >
                                <FaVideo /> ចាប់ផ្តើមថត
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>,
        portalTarget
    );
};

export default ScreenRecorderDock;
