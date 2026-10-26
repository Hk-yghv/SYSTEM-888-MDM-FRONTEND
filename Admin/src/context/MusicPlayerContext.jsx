import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'mdm_music_playlist_v1';
const MusicPlayerContext = createContext(null);
const DEFAULT_TRACK = {
    id: 'default-youtube-track-pICAha0nsb0',
    videoId: 'pICAha0nsb0',
    title: 'YouTube video pICAha0nsb0'
};

const applyPlayerVolume = (player) => {
    player.unMute();
    player.setVolume(100);
};

const readSavedMusic = () => {
    try {
        const savedValue = localStorage.getItem(STORAGE_KEY);
        const saved = JSON.parse(savedValue || '{}');
        const savedTracks = Array.isArray(saved.tracks)
            ? saved.tracks.filter(track => track && typeof track.videoId === 'string' && /^[\w-]{11}$/.test(track.videoId))
            : [];
        const defaultTrackDismissed = saved.defaultTrackDismissed === true;
        const tracks = savedTracks.length > 0 || defaultTrackDismissed
            ? savedTracks
            : [DEFAULT_TRACK];
        const playbackMode = ['sequential', 'shuffle', 'repeat-all', 'repeat-one'].includes(saved.playbackMode)
            ? saved.playbackMode
            : (saved.shuffle ? 'shuffle' : saved.repeat ? 'repeat-all' : 'sequential');
        return {
            tracks,
            defaultTrackDismissed,
            currentIndex: tracks.length === 0
                ? -1
                : Number.isInteger(saved.currentIndex) && saved.currentIndex >= 0 && saved.currentIndex < tracks.length
                    ? saved.currentIndex
                    : 0,
            playbackMode
        };
    } catch (error) {
        console.error('Unable to load saved music playlist:', error);
        return { tracks: [DEFAULT_TRACK], defaultTrackDismissed: false, currentIndex: 0, playbackMode: 'sequential' };
    }
};

export const extractYouTubeVideoId = (value) => {
    const input = String(value || '').trim();
    if (/^[\w-]{11}$/.test(input)) return input;

    try {
        const url = new URL(input);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        let videoId = '';
        if (host === 'youtu.be') {
            videoId = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
            if (url.pathname === '/watch') {
                videoId = url.searchParams.get('v') || '';
            } else {
                videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || '';
            }
        }
        return /^[\w-]{11}$/.test(videoId) ? videoId : '';
    } catch {
        return '';
    }
};

const loadYouTubeApi = () => new Promise((resolve, reject) => {
    if (window.YT?.Player) {
        resolve(window.YT);
        return;
    }

    const existingScript = document.querySelector('script[data-youtube-iframe-api]');
    const previousCallback = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('YouTube Player API timed out.')), 15000);
    window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout);
        previousCallback?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube Player API did not initialize.'));
    };

    if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.youtubeIframeApi = 'true';
        script.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('Unable to load YouTube Player API.'));
        };
        document.head.appendChild(script);
    }
});

export const MusicPlayerProvider = ({ children }) => {
    const initialMusic = useMemo(readSavedMusic, []);
    const [tracks, setTracks] = useState(initialMusic.tracks);
    const [currentIndex, setCurrentIndex] = useState(() => (
        initialMusic.currentIndex >= 0 && initialMusic.currentIndex < initialMusic.tracks.length
            ? initialMusic.currentIndex
            : -1
    ));
    const [playbackMode, setPlaybackMode] = useState(initialMusic.playbackMode);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [defaultTrackDismissed, setDefaultTrackDismissed] = useState(initialMusic.defaultTrackDismissed);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPlayerVisible, setIsPlayerVisible] = useState(false);
    const [playerError, setPlayerError] = useState('');
    const [playerReady, setPlayerReady] = useState(false);
    const playerContainerRef = useRef(null);
    const playerRef = useRef(null);
    const loadedVideoIdRef = useRef('');
    const pendingPlayRef = useRef(false);
    const settingsRef = useRef({ tracks, currentIndex, playbackMode });
    settingsRef.current = { tracks, currentIndex, playbackMode };

    const currentTrack = tracks[currentIndex] || null;

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                tracks,
                currentIndex,
                playbackMode,
                defaultTrackDismissed
            }));
        } catch (error) {
            console.error('Unable to save music playlist locally:', error);
        }
    }, [tracks, currentIndex, playbackMode, defaultTrackDismissed]);

    const playTrackAt = useCallback((index) => {
        const track = settingsRef.current.tracks[index];
        if (!track) return;

        setIsPlayerVisible(true);
        setCurrentIndex(index);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(true);
        setPlayerError('');
        pendingPlayRef.current = true;

        const player = playerRef.current;
        if (player && loadedVideoIdRef.current === track.videoId) {
            pendingPlayRef.current = false;
            applyPlayerVolume(player);
            player.playVideo();
        } else if (player && playerReady) {
            loadedVideoIdRef.current = track.videoId;
            pendingPlayRef.current = false;
            player.loadVideoById(track.videoId);
            applyPlayerVolume(player);
            player.playVideo();
        }
    }, [playerReady]);

    const playNext = useCallback((ended = false) => {
        const current = settingsRef.current;
        if (current.tracks.length === 0) return;

        if (ended === true && current.playbackMode === 'repeat-one') {
            playerRef.current?.seekTo(0, true);
            playerRef.current?.playVideo();
            setCurrentTime(0);
            setIsPlaying(true);
            return;
        }

        let nextIndex;
        if (current.playbackMode === 'shuffle' && current.tracks.length > 1) {
            const choices = current.tracks.map((_, index) => index).filter(index => index !== current.currentIndex);
            nextIndex = choices[Math.floor(Math.random() * choices.length)];
        } else {
            nextIndex = current.currentIndex + 1;
        }

        if (nextIndex >= current.tracks.length) {
            if (current.playbackMode !== 'repeat-all' && current.playbackMode !== 'shuffle') {
                setIsPlaying(false);
                playerRef.current?.stopVideo();
                return;
            }
            nextIndex = 0;
        }
        playTrackAt(nextIndex);
    }, [playTrackAt]);

    const playNextRef = useRef(playNext);
    playNextRef.current = playNext;

    useEffect(() => {
        let active = true;

        loadYouTubeApi().then(YT => {
            if (!active || !playerContainerRef.current || playerRef.current) return;
            playerRef.current = new YT.Player(playerContainerRef.current, {
                width: '200',
                height: '200',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    playsinline: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        playerRef.current = event.target;
                        applyPlayerVolume(event.target);
                        setPlayerReady(true);
                    },
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            applyPlayerVolume(event.target);
                            [150, 600].forEach(delay => {
                                window.setTimeout(() => {
                                    if (
                                        playerRef.current === event.target &&
                                        event.target.getPlayerState?.() === YT.PlayerState.PLAYING
                                    ) {
                                        applyPlayerVolume(event.target);
                                    }
                                }, delay);
                            });
                            setIsPlaying(true);
                        }
                        if (event.data === YT.PlayerState.PAUSED) setIsPlaying(false);
                        if (event.data === YT.PlayerState.ENDED) {
                            setIsPlaying(false);
                            playNextRef.current(true);
                        }
                    },
                    onError: (event) => {
                        setIsPlaying(false);
                        setPlayerError(`YouTube playback error (${event.data}).`);
                    }
                }
            });
        }).catch(error => {
            if (active) {
                console.error('YouTube player initialization error:', error);
                setIsPlaying(false);
                setPlayerError(error.message);
            }
        });

        return () => {
            active = false;
            playerRef.current?.destroy();
            playerRef.current = null;
            loadedVideoIdRef.current = '';
        };
    }, []);

    useEffect(() => {
        if (!playerReady) return undefined;
        const progressInterval = window.setInterval(() => {
            const player = playerRef.current;
            if (!player) return;
            const nextDuration = Number(player.getDuration?.()) || 0;
            setDuration(nextDuration);
            if (isPlaying && player.getPlayerState?.() === 1) {
                applyPlayerVolume(player);
                setCurrentTime(Number(player.getCurrentTime?.()) || 0);
            }
        }, 500);
        return () => window.clearInterval(progressInterval);
    }, [isPlaying, playerReady, currentTrack]);

    useEffect(() => {
        if (!playerReady || !currentTrack || loadedVideoIdRef.current === currentTrack.videoId) return;
        loadedVideoIdRef.current = currentTrack.videoId;
        if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            playerRef.current?.loadVideoById(currentTrack.videoId);
            applyPlayerVolume(playerRef.current);
            playerRef.current?.playVideo();
        } else {
            playerRef.current?.cueVideoById(currentTrack.videoId);
        }
    }, [currentTrack, playerReady]);

    const togglePlayPause = useCallback(() => {
        if (!currentTrack) {
            if (tracks.length > 0) playTrackAt(0);
            return;
        }
        const player = playerRef.current;
        if (!player || !playerReady) {
            pendingPlayRef.current = true;
            setIsPlaying(true);
            return;
        }
        if (isPlaying) {
            player.pauseVideo();
            setIsPlaying(false);
        } else if (loadedVideoIdRef.current !== currentTrack.videoId) {
            pendingPlayRef.current = true;
            setIsPlaying(true);
            player.loadVideoById(currentTrack.videoId);
            applyPlayerVolume(player);
            player.playVideo();
            loadedVideoIdRef.current = currentTrack.videoId;
            pendingPlayRef.current = false;
        } else {
            applyPlayerVolume(player);
            player.playVideo();
        }
    }, [currentTrack, isPlaying, playerReady, playTrackAt, tracks.length]);

    const togglePlayerVisibility = useCallback(() => {
        setIsPlayerVisible(visible => !visible);
    }, []);

    const playPrevious = useCallback(() => {
        const { tracks: currentTracks, currentIndex: index, playbackMode: mode } = settingsRef.current;
        if (currentTracks.length === 0) return;
        const previousIndex = index > 0 ? index - 1 : (mode === 'repeat-all' ? currentTracks.length - 1 : 0);
        playTrackAt(previousIndex);
    }, [playTrackAt]);

    const seekTo = useCallback((time) => {
        const nextTime = Math.min(duration || 0, Math.max(0, Number(time) || 0));
        playerRef.current?.seekTo(nextTime, true);
        setCurrentTime(nextTime);
    }, [duration]);

    const addTrack = useCallback((videoId, title) => {
        const track = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            videoId,
            title: String(title || '').trim() || `YouTube video ${videoId}`
        };
        if (settingsRef.current.tracks.length === 0) setCurrentIndex(0);
        setTracks(current => [...current, track]);
        return track;
    }, []);

    const removeTrack = useCallback((id) => {
        const removeIndex = settingsRef.current.tracks.findIndex(track => track.id === id);
        if (removeIndex === -1) return;
        if (id === DEFAULT_TRACK.id) setDefaultTrackDismissed(true);
        const isCurrent = removeIndex === settingsRef.current.currentIndex;
        if (isCurrent) {
            playerRef.current?.stopVideo();
            loadedVideoIdRef.current = '';
            pendingPlayRef.current = false;
            setIsPlaying(false);
        }
        setTracks(current => current.filter(track => track.id !== id));
        setCurrentIndex(index => {
            const remaining = settingsRef.current.tracks.length - 1;
            if (remaining === 0) return -1;
            if (removeIndex < index) return index - 1;
            if (removeIndex === index) return Math.min(index, remaining - 1);
            return index;
        });
    }, []);

    const moveTrack = useCallback((index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= settingsRef.current.tracks.length) return;
        setCurrentIndex(currentIndex => {
            if (currentIndex === index) return targetIndex;
            if (currentIndex === targetIndex) return index;
            return currentIndex;
        });
        setTracks(current => {
            const reordered = [...current];
            [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
            return reordered;
        });
    }, []);

    const changePlaybackMode = useCallback((mode) => {
        if (!['sequential', 'shuffle', 'repeat-all', 'repeat-one'].includes(mode)) return;
        setPlaybackMode(mode);
    }, []);

    const value = useMemo(() => ({
        tracks,
        currentTrack,
        currentIndex,
        playbackMode,
        currentTime,
        duration,
        isPlaying,
        isPlayerVisible,
        playerError,
        playerReady,
        addTrack,
        removeTrack,
        moveTrack,
        playTrackAt,
        playNext,
        playPrevious,
        togglePlayPause,
        togglePlayerVisibility,
        seekTo,
        setPlaybackMode: changePlaybackMode
    }), [
        tracks, currentTrack, currentIndex, playbackMode, currentTime, duration, isPlaying,
        isPlayerVisible, playerError, playerReady, addTrack, removeTrack, moveTrack,
        playTrackAt, playNext, playPrevious, togglePlayPause, togglePlayerVisibility,
        seekTo, changePlaybackMode
    ]);

    return (
        <MusicPlayerContext.Provider value={value}>
            {children}
            <div
                className="fixed bottom-4 right-4 z-[99998] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                style={{
                    width: 216,
                    height: 242,
                    left: isPlayerVisible && currentTrack ? 'auto' : -240,
                    top: isPlayerVisible && currentTrack ? 'auto' : 0,
                    right: isPlayerVisible && currentTrack ? 16 : 'auto',
                    bottom: isPlayerVisible && currentTrack ? 16 : 'auto',
                    opacity: isPlayerVisible && currentTrack ? 1 : 0.01,
                    overflow: 'visible',
                    pointerEvents: isPlayerVisible && currentTrack ? 'auto' : 'none'
                }}
            >
                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                    <span className="max-w-[160px] truncate text-[10px] font-semibold text-slate-700">
                        {currentTrack?.title || ''}
                    </span>
                    <button
                        type="button"
                        onClick={togglePlayerVisibility}
                        aria-label="Hide music player"
                        title="លាក់វីដេអូ តែបន្តចាក់សំឡេង"
                        className="rounded px-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
                    >
                        ×
                    </button>
                </div>
                <div ref={playerContainerRef} style={{ width: 200, height: 200 }} />
            </div>
        </MusicPlayerContext.Provider>
    );
};

export const useMusicPlayer = () => {
    const context = useContext(MusicPlayerContext);
    if (!context) throw new Error('useMusicPlayer must be used within MusicPlayerProvider.');
    return context;
};
