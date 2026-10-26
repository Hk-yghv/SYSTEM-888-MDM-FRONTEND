import React from 'react';
import { Link } from 'react-router-dom';
import { FaMusic, FaPause, FaPlay, FaStepForward, FaVolumeUp, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useMusicPlayer } from '../../context/MusicPlayerContext';

const MusicDockControls = () => {
    const {
        currentTrack, isPlaying, isPlayerVisible, tracks, volume, playerReady,
        togglePlayPause, togglePlayerVisibility, playNext, setVolume
    } = useMusicPlayer();

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
                <FaVolumeUp className="ml-1 text-[11px] text-slate-500" />
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(event) => setVolume(event.target.value)}
                    aria-label="Music volume"
                    className="min-w-0 flex-1 accent-violet-600"
                />
                <span className="w-7 text-right text-[9px] text-slate-500">{volume}</span>
            </div>
        </div>
    );
};

export default MusicDockControls;
