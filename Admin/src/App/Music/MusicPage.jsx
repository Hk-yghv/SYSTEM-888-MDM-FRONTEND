import React, { useState } from 'react';
import {
    FaMusic, FaPlay, FaPause, FaStepBackward, FaStepForward, FaTrash,
    FaRandom, FaRedo, FaVolumeUp, FaVolumeDown, FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import { extractYouTubeVideoId, useMusicPlayer } from '../../context/MusicPlayerContext';

const MusicPage = () => {
    const {
        tracks,
        currentTrack,
        currentIndex,
        volume,
        repeat,
        shuffle,
        isPlaying,
        playerError,
        playerReady,
        addTrack,
        removeTrack,
        moveTrack,
        playTrackAt,
        playNext,
        playPrevious,
        togglePlayPause,
        setVolume,
        setRepeat,
        setShuffle
    } = useMusicPlayer();
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [formError, setFormError] = useState('');

    const handleAddTrack = (event) => {
        event.preventDefault();
        const videoId = extractYouTubeVideoId(url);
        if (!videoId) {
            setFormError('សូមបញ្ចូល URL ឬ Video ID របស់ YouTube ដែលត្រឹមត្រូវ។');
            return;
        }
        addTrack(videoId, title);
        setUrl('');
        setTitle('');
        setFormError('');
    };

    return (
        <main className="min-h-full bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-4xl space-y-5">
                <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                            <FaMusic size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Music Player</h1>
                            <p className="mt-1 text-sm text-slate-500">រក្សាទុក Playlist ក្នុងម៉ាស៊ីននេះ ហើយស្តាប់បន្តពេលប្តូរ Page។</p>
                        </div>
                    </div>
                    <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
                        ចាក់បទតាម YouTube embed ផ្លូវការ។ URL ត្រូវបានរក្សាទុកក្នុង Local Storage របស់ Browser នេះប៉ុណ្ណោះ។
                    </p>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-bold text-slate-800">បន្ថែមបទពី YouTube</h2>
                    <form onSubmit={handleAddTrack} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <input
                            type="url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="YouTube URL (youtube.com / youtu.be)"
                            aria-label="YouTube URL"
                            className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="ចំណងជើងបទ (អាចទុកទទេ)"
                            aria-label="Track title"
                            className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                        <button
                            type="submit"
                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                        >
                            បន្ថែមបទ
                        </button>
                    </form>
                    {formError && <p className="mt-2 text-xs text-rose-600" role="alert">{formError}</p>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Playlist ({tracks.length})</h2>
                            <p className="mt-1 text-xs text-slate-500">បទបន្ទាប់នឹងចាក់តាមលំដាប់ក្នុងបញ្ជី លុះត្រាតែបើក Shuffle។</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setRepeat(value => !value)}
                                aria-pressed={repeat}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${repeat ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                <FaRedo /> Loop {repeat ? 'On' : 'Off'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShuffle(value => !value)}
                                aria-pressed={shuffle}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${shuffle ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                <FaRandom /> Shuffle {shuffle ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={playPrevious} aria-label="Previous track" disabled={!tracks.length} className="rounded-md p-2 text-slate-600 hover:bg-white disabled:opacity-40">
                                <FaStepBackward />
                            </button>
                            <button type="button" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause music' : 'Play music'} disabled={!tracks.length} className="rounded-full bg-violet-600 p-3 text-white hover:bg-violet-700 disabled:opacity-40">
                                {isPlaying ? <FaPause /> : <FaPlay />}
                            </button>
                            <button type="button" onClick={playNext} aria-label="Next track" disabled={!tracks.length} className="rounded-md p-2 text-slate-600 hover:bg-white disabled:opacity-40">
                                <FaStepForward />
                            </button>
                        </div>
                        <div className="min-w-[150px] flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">{currentTrack?.title || 'មិនទាន់មានបទកំពុងចាក់'}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                                {playerError ? playerError : playerReady ? (isPlaying ? 'កំពុងចាក់' : 'រួចរាល់') : 'កំពុងភ្ជាប់ YouTube Player...'}
                            </p>
                        </div>
                        <div className="flex min-w-[150px] flex-1 items-center gap-2">
                            {volume < 50 ? <FaVolumeDown className="text-slate-500" /> : <FaVolumeUp className="text-slate-500" />}
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={(event) => setVolume(event.target.value)}
                                aria-label="Music volume"
                                className="w-full accent-violet-600"
                            />
                            <span className="w-9 text-right text-[10px] text-slate-500">{volume}%</span>
                        </div>
                    </div>

                    {playerError && (
                        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
                            មិនអាចចាក់ YouTube បានទេ៖ {playerError} សូមពិនិត្យ Internet ឬសាកបទផ្សេង។
                        </p>
                    )}

                    <div className="mt-4 space-y-2">
                        {tracks.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
                                Playlist ទទេ។ បញ្ចូល YouTube URL ខាងលើដើម្បីចាប់ផ្តើម។
                            </div>
                        ) : tracks.map((track, index) => (
                            <div
                                key={track.id}
                                className={`flex items-center gap-2 rounded-xl border p-3 ${index === currentIndex ? 'border-violet-300 bg-violet-50/70' : 'border-slate-200 bg-white'}`}
                            >
                                <span className="w-7 text-center text-xs font-mono text-slate-400">{index + 1}</span>
                                <button type="button" onClick={() => playTrackAt(index)} className="min-w-0 flex-1 text-left">
                                    <span className="block truncate text-sm font-semibold text-slate-800">{track.title}</span>
                                    <span className="mt-0.5 block text-[10px] text-slate-400">YouTube • {track.videoId}</span>
                                </button>
                                <button type="button" onClick={() => moveTrack(index, -1)} disabled={index === 0} aria-label="Move track up" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                                    <FaArrowUp size={11} />
                                </button>
                                <button type="button" onClick={() => moveTrack(index, 1)} disabled={index === tracks.length - 1} aria-label="Move track down" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                                    <FaArrowDown size={11} />
                                </button>
                                <button type="button" onClick={() => removeTrack(track.id)} aria-label={`Remove ${track.title}`} className="rounded-md p-2 text-rose-500 hover:bg-rose-50">
                                    <FaTrash size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default MusicPage;
