import React, { useState, useEffect, useRef } from 'react';
import { FaRobot, FaPaperPlane, FaSpinner, FaTimes, FaUser, FaRegCopy, FaCheck, FaDatabase, FaShieldAlt } from 'react-icons/fa';
import { HiSparkles, HiOutlineLightBulb } from 'react-icons/hi2';
import { MdOutlineCleaningServices, MdOutlineSecurity, MdOutlineAutoAwesome } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

/* ── Lightweight Markdown Formatter for AI Responses ── */
const MarkdownMessage = ({ text = '' }) => {
    const lines = text.split('\n');
    const elements = [];
    let inTable = false;
    let tableHeader = [];
    let tableRows = [];

    const formatInline = (str = '') => {
        let formatted = str.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffffff;font-weight:700">$1</strong>');
        formatted = formatted.replace(/\`([^\`]+)\`/g, '<code style="padding:2px 6px;background:#242c4a;border:1px solid rgba(99,102,241,0.5);color:#ffffff;border-radius:4px;font-family:monospace;font-size:11px;font-weight:600">$1</code>');
        return <span style={{ color: '#ffffff' }} dangerouslySetInnerHTML={{ __html: formatted }} />;
    };

    const flushTable = (key) => {
        if (tableRows.length > 0 || tableHeader.length > 0) {
            elements.push(
                <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-xl border border-indigo-500/30 bg-gray-950/90 shadow-md">
                    <table className="w-full text-left text-xs border-collapse" style={{ color: '#ffffff' }}>
                        {tableHeader.length > 0 && (
                            <thead className="bg-indigo-950/80 font-bold border-b border-indigo-700/50">
                                <tr>
                                    {tableHeader.map((th, i) => (
                                        <th key={i} className="px-3 py-2 whitespace-nowrap font-bold" style={{ color: '#ffffff' }}>{formatInline(th.trim())}</th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody className="divide-y divide-gray-800 font-medium">
                            {tableRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-indigo-900/30 transition-colors">
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="px-3 py-2 whitespace-nowrap" style={{ color: '#ffffff' }}>{formatInline(cell.trim())}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            tableHeader = [];
            tableRows = [];
        }
        inTable = false;
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
            if (trimmed.includes('---')) {
                return;
            }
            if (!inTable) {
                inTable = true;
                tableHeader = cells;
            } else {
                tableRows.push(cells);
            }
            return;
        } else if (inTable) {
            flushTable(idx);
        }

        if (trimmed.startsWith('### ')) {
            elements.push(
                <h3 key={idx} className="text-xs font-black mt-3 mb-1.5 pb-1 border-b border-indigo-800/60 flex items-center gap-1.5" style={{ color: '#ffffff' }}>
                    {formatInline(trimmed.replace('### ', ''))}
                </h3>
            );
        } else if (trimmed.startsWith('## ')) {
            elements.push(
                <h2 key={idx} className="text-sm font-black mt-3.5 mb-1.5" style={{ color: '#ffffff' }}>
                    {formatInline(trimmed.replace('## ', ''))}
                </h2>
            );
        } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            elements.push(
                <div key={idx} className="flex items-start gap-1.5 text-xs my-1 leading-relaxed" style={{ color: '#ffffff' }}>
                    <span className="text-indigo-400 mt-1 text-[9px]">•</span>
                    <div className="flex-1" style={{ color: '#ffffff' }}>{formatInline(trimmed.substring(2))}</div>
                </div>
            );
        } else if (trimmed.startsWith('> ')) {
            elements.push(
                <blockquote key={idx} className="border-l-2 border-indigo-400 pl-2.5 py-1.5 my-2 bg-indigo-950/50 rounded-r-xl text-xs italic" style={{ color: '#ffffff' }}>
                    {formatInline(trimmed.substring(2))}
                </blockquote>
            );
        } else if (trimmed.length > 0) {
            elements.push(<p key={idx} className="text-xs my-1 leading-relaxed font-khmer" style={{ color: '#ffffff' }}>{formatInline(trimmed)}</p>);
        }
    });

    if (inTable) {
        flushTable('last');
    }

    return <div className="space-y-0.5" style={{ color: '#ffffff' }}>{elements}</div>;
};


const AIAssistantDrawer = ({ isOpen, onClose }) => {
    const { user, API_BASE3 } = useAuth();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [quickPrompts, setQuickPrompts] = useState([]);
    const [messages, setMessages] = useState([
        {
            sender: 'ai',
            text: `👋 សួស្តី **${user?.name || user?.username || 'User'}**!\n\nខ្ញុំជា **MDM Smart AI Assistant** ដំណើរការដោយ Python Engine 3។\n\nខ្ញុំអាចជួយស្វែងរកទិន្នន័យអតិថិជន, Device Specs (IMEI/MEID), ប្រវត្តិនៃការបង់ប្រាក់ និងស្ថានភាព Lock ពី Database ដោយផ្ទាល់តាមសិទ្ធិរបស់គណនីអ្នក។`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const fetchPrompts = async () => {
            try {
                const res = await fetch(`${API_BASE3}/ai/quick-prompts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: user || {} })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.prompts && data.prompts.length > 0) {
                        setQuickPrompts(data.prompts);
                        return;
                    }
                }
            } catch {
                // Ignore network error and use fallback
            }

            // Fallback prompts
            if (user?.role === 'Administrator' || !user?.brand) {
                setQuickPrompts([
                    '📊 សង្ខេបទិន្នន័យកិច្ចសន្យា និងទូរស័ព្ទសរុប',
                    '💳 សង្ខេបប្រាក់ទទួលបានសរុបពីការបង់',
                    '🔒 តើមានទូរស័ព្ទប៉ុន្មានគ្រឿងជាប់ Lock?',
                    '🔍 ស្វែងរកអតិថិជនតាមឈ្មោះ ឬលេខទូរស័ព្ទ'
                ]);
            } else {
                setQuickPrompts([
                    `📊 សង្ខេបទិន្នន័យ Brand ${user.brand}`,
                    `📱 ចំនួនទូរស័ព្ទសកម្មក្នុង Brand ${user.brand}`,
                    '💳 ប្រវត្តិបង់ប្រាក់ក្នុង Brand ខ្ញុំ',
                    '🔒 ពិនិត្យទូរស័ព្ទជាប់ Lock ក្នុង Brand ខ្ញុំ'
                ]);
            }
        };
        fetchPrompts();
        setTimeout(() => inputRef.current?.focus(), 250);
    }, [isOpen, API_BASE3, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSendMessage = async (textToSend) => {
        const queryText = (textToSend || input).trim();
        if (!queryText || loading) return;

        const userMsg = {
            sender: 'user',
            text: queryText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE3}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: queryText,
                    user: user || {},
                    history: messages.slice(-6).map(m => ({ sender: m.sender, text: m.text }))
                })
            });

            if (res.ok) {
                const data = await res.json();
                const aiMsg = {
                    sender: 'ai',
                    text: data.answer || 'មិនមានទិន្នន័យឆ្លើយតប។',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: '⚠️ មានបញ្ហាក្នុងការទាក់ទងទៅកាន់ Python AI Backend Service (Port 5003)។ សូមពិនិត្យមើលសេវាកម្ម backend3។',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                sender: 'ai',
                text: '⚠️ មិនអាចភ្ជាប់ទៅកាន់ Python AI Backend បានទេ (Connection Error)។ សូមពិនិត្យមើល backend3 service។',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleClearChat = () => {
        setMessages([
            {
                sender: 'ai',
                text: '🧹 ការសន្ទនាត្រូវបានសម្អាតរួចរាល់! លោកអ្នកអាចសួរសំណួរថ្មីបានគ្រប់ពេល។',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ]);
    };

    const userBrand = user?.brand || '';
    const userRole = user?.role || 'Staff';
    const isMaster = user?.username === '@hakyonghouv' || user?.username === 'hakyonghouv' || user?.isImmutable || userRole === 'Administrator';

    return (
        <>
            {/* ━━━ Sliding Right Drawer ━━━ */}
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex justify-end animate-fade-in">
                    {/* Backdrop */}
                    <div
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300"
                    />

                    {/* Drawer Content */}
                    <div className="relative w-full sm:w-[460px] max-w-[95vw] h-full bg-[#0d111d] border-l border-indigo-500/30 shadow-2xl flex flex-col z-10 overflow-hidden text-gray-100 font-sans">

                        {/* ── Header ── */}
                        <div className="px-4 py-3.5 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-b border-indigo-950 flex items-center justify-between flex-shrink-0 shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center text-white text-lg">
                                    <FaRobot />
                                </div>
                                <div>
                                    <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 tracking-wide">
                                        <span>MDM AI Assistant</span>
                                        <HiSparkles className="text-amber-400 text-sm animate-pulse" />
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                        <span className="flex items-center gap-1 text-emerald-400 font-bold font-mono">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                            Online · Python v3
                                        </span>
                                        <span className="text-gray-600">•</span>
                                        <span className="text-gray-400 font-mono">{userRole}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleClearChat}
                                    className="p-2 bg-gray-800/80 hover:bg-indigo-900/60 text-gray-400 hover:text-indigo-200 rounded-xl text-xs transition-all cursor-pointer border border-gray-700/50 shadow-xs"
                                    title="Clear Chat History"
                                >
                                    <MdOutlineCleaningServices />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 bg-gray-800/80 hover:bg-red-950 text-gray-400 hover:text-red-300 rounded-xl text-xs transition-all cursor-pointer border border-gray-700/50 shadow-xs"
                                    title="Close AI Assistant"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </div>

                        {/* ── Security & Account Scope Banner ── */}
                        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/30 flex items-center justify-between text-[11px] text-indigo-300 flex-shrink-0 backdrop-blur-md">
                            <div className="flex items-center gap-1.5 font-khmer">
                                <MdOutlineSecurity className="text-indigo-400 text-sm" />
                                <span className="font-bold">ដែនកំណត់ទិន្នន័យ:</span>
                            </div>
                            <span className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border border-indigo-700/60 text-indigo-200 rounded-full font-bold text-[10px] shadow-xs">
                                {isMaster ? '👑 Global All Brands Scope' : `🏷️ Brand: ${userBrand || 'Restricted'}`}
                            </span>
                        </div>

                        {/* ── Chat Messages Stream ── */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0d111d] custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const isUser = msg.sender === 'user';
                                return (
                                    <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex-shrink-0 flex items-center justify-center text-white text-xs shadow-md mt-0.5">
                                                <FaRobot />
                                            </div>
                                        )}
                                        <div
                                            style={{ color: '#ffffff' }}
                                            className={`max-w-[86%] rounded-2xl p-3.5 text-xs shadow-xl relative group transition-all text-white ${isUser
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 rounded-tr-xs border border-indigo-400/20'
                                                : 'bg-[#1a1f35] border border-indigo-500/30 rounded-tl-xs'
                                                }`}
                                        >
                                            {isUser ? (
                                                <p className="whitespace-pre-wrap leading-relaxed font-khmer text-white" style={{ color: '#ffffff' }}>{msg.text}</p>
                                            ) : (
                                                <MarkdownMessage text={msg.text} />
                                            )}


                                            <div className={`flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t ${isUser ? 'border-indigo-400/30 text-indigo-200' : 'border-gray-800/80 text-gray-400'}`}>
                                                <span className="font-mono text-[9px] opacity-75">{msg.timestamp}</span>
                                                {!isUser && (
                                                    <button
                                                        onClick={() => handleCopy(msg.text, idx)}
                                                        className="opacity-70 hover:opacity-100 flex items-center gap-1 transition-all cursor-pointer text-[10px] text-indigo-300 hover:text-indigo-100 px-1.5 py-0.5 rounded hover:bg-gray-800"
                                                        title="Copy Answer"
                                                    >
                                                        {copiedIndex === idx ? <><FaCheck className="text-emerald-400" /> បាន Copy</> : <><FaRegCopy /> Copy</>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {isUser && (
                                            <div className="w-8 h-8 rounded-xl bg-gray-800 flex-shrink-0 flex items-center justify-center text-indigo-300 text-xs shadow-md mt-0.5 border border-gray-700">
                                                <FaUser />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Loading Indicator */}
                            {loading && (
                                <div className="flex items-center gap-2.5 justify-start">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex-shrink-0 flex items-center justify-center text-white text-xs animate-spin">
                                        <FaSpinner />
                                    </div>
                                    <div className="bg-gray-900/90 border border-indigo-500/30 rounded-2xl px-4 py-3 text-xs text-indigo-300 flex items-center gap-2.5 shadow-lg">
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]"></span>
                                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]"></span>
                                        <span className="text-xs font-khmer text-gray-300 ml-1">កំពុងស្វែងរកក្នុង MongoDB...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* ── Quick Suggested Prompts (Neat Compact Pills) ── */}
                        {quickPrompts.length > 0 && (
                            <div className="px-3 py-2.5 bg-gray-900/95 border-t border-gray-800/80 flex-shrink-0">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-1.5 font-khmer">
                                    <HiOutlineLightBulb className="text-amber-400 text-xs" />
                                    <span>សំណួរគំរូ (Quick Questions):</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                    {quickPrompts.map((prompt, pIdx) => (
                                        <button
                                            key={pIdx}
                                            onClick={() => handleSendMessage(prompt)}
                                            disabled={loading}
                                            className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-800/50 hover:border-indigo-400 rounded-lg text-[11px] font-khmer transition-all cursor-pointer disabled:opacity-40 text-left shadow-xs truncate max-w-full"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Message Input Bar ── */}
                        <div className="p-3 bg-gray-950 border-t border-indigo-950 flex-shrink-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2 bg-gray-900/90 border border-gray-800 focus-within:border-indigo-500 rounded-2xl p-1.5 transition-all shadow-inner">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="សួរសំណួរទៅកាន់ AI (ឈ្មោះ, IMEI, MEID, Serial, សង្ខេប...)"
                                    disabled={loading}
                                    className="flex-1 bg-transparent px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 outline-none font-khmer"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || loading}
                                    className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    {loading ? <FaSpinner className="animate-spin text-sm" /> : <FaPaperPlane className="text-xs" />}
                                </button>
                            </form>
                            <p className="text-[10px] text-gray-500 text-center mt-2 font-khmer flex items-center justify-center gap-1">
                                <FaShieldAlt className="text-indigo-400 text-[10px]" />
                                <span>AI ឆ្លើយតបដោយគោរពតាមច្បាប់សិទ្ធិ Account និង Brand យ៉ាងតឹងរ៉ឹង</span>
                            </p>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistantDrawer;
