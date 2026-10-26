import React from 'react';
import { Link } from 'react-router-dom';
import { FaMusic, FaPause, FaPlay, FaStepForward, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useMusicPlayer } from '../../context/MusicPlayerContext';

const MusicDockControls = () => {
    const {
        currentTrack, isPlaying, isPlayerVisible, tracks, playerReady,
        currentTime, duration, togglePlayPause, togglePlayerVisibility, playNext,
        seekTo
    } = useMusicPlayer();
    const formatTime = (seconds) => {
        const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
        return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
    };

    return (
        <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex items-center justify-between px-2.5 py-1">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <FaMusic className="text-violet-600" /> Music
                </span>
                <Link to="/music" className="text-[10px] font-semibold text-violet-700 hover:text-violet-900">
                    Playlist
                </Link>
            </div>
            <p className="truncate px-2.5 text-[10px] text-slate-500" title={currentTrack?.title || ''}>
                {currentTrack?.title || 'មិនទាន់មានបទ'}
            </p>
            <div className="mt-1 flex items-center gap-1">
                <button
                    type="button"
                    onClick={togglePlayPause}
                    disabled={!tracks.length || !playerReady}
                    aria-label={isPlaying ? 'Pause music' : 'Play music'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                >
                    {isPlaying ? <FaPause size={11} /> : <FaPlay size={11} />}
                </button>
                <button
                    type="button"
                    onClick={playNext}
                    disabled={!tracks.length || !playerReady}
                    aria-label="Next track"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                    <FaStepForward size={12} />
                </button>
                <button
                    type="button"
                    onClick={togglePlayerVisibility}
                    disabled={!currentTrack}
                    aria-label={isPlayerVisible ? 'Close music player and pause' : 'Open music player'}
                    title={isPlayerVisible ? 'បិទ Player និង Pause' : 'បើក Player'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                    {isPlayerVisible ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                </button>
            </div>
            <div className="mt-1 flex items-center gap-1 px-1">
                <span className="w-7 text-right font-mono text-[8px] text-slate-400">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="1"
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seekTo(event.target.value)}
                    disabled={!playerReady || !duration}
                    aria-label="Music playback progress"
                    className="min-w-0 flex-1 accent-violet-600 disabled:opacity-40"
                />
                <span className="w-7 font-mono text-[8px] text-slate-400">{formatTime(duration)}</span>
            </div>
        </div>
    );
};

export default MusicDockControls;
