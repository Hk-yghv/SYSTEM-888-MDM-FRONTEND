import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaShieldAlt,
    FaDesktop,
    FaFolder,
    FaFolderOpen,
    FaFileAlt,
    FaSync,
    FaDownload,
    FaFilter,
    FaSearch,
    FaTimes,
    FaExclamationTriangle,
    FaInfoCircle,
    FaTimesCircle,
    FaCheckCircle,
    FaCopy,
    FaChevronRight,
    FaChevronDown,
    FaUserShield,
    FaLaptopCode,
    FaDatabase,
    FaServer,
    FaMobileAlt,
    FaCloudUploadAlt,
    FaTrashAlt,
    FaMousePointer
} from 'react-icons/fa';
import { MdOutlineCleaningServices, MdOutlineViewStream, MdCode } from 'react-icons/md';
import { exportToExcel } from '../../../utils/exportUtils';

const SystemAuditLogs = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const isMasterAdmin = (
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin'
    );

    // Filter & Query States
    const [selectedCategory, setSelectedCategory] = useState('All'); // 'All', 'Security', 'Navigation', 'Contract', 'Device', 'System', 'UserActivity'
    const [selectedLevel, setSelectedLevel] = useState('All'); // 'All', 'Information', 'Warning', 'Error', 'SuccessAudit'
    const [selectedBrand, setSelectedBrand] = useState(isMasterAdmin ? '' : (user?.brand || ''));
    const [targetUser, setTargetUser] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ total: 0, securityCount: 0, errorCount: 0, contractCount: 0, navigationCount: 0 });
    const [brandsList, setBrandsList] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailTab, setDetailTab] = useState('general'); // 'general' or 'xml'
    const [copiedXml, setCopiedXml] = useState(false);

    // Archival State (7-Day Google Sheet Archival & DB Cleanup)
    const [archivalStatus, setArchivalStatus] = useState({ pendingCount: 0, totalCount: 0, cutoffDate: null, lastStatus: null });
    const [archiving, setArchiving] = useState(false);
    const [openArchivalModal, setOpenArchivalModal] = useState(false);
    const [archiveSuccessMsg, setArchiveSuccessMsg] = useState('');

    // Tree navigation expanded state
    const [treeOpen, setTreeOpen] = useState({
        root: true,
        windowsLogs: true,
        googleSheetFolder: true,
        appLogs: true
    });

    // Fetch Brands and Users for filtering
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const bRes = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    const brandCat = (bData.droplists || []).find(d => d.category === 'Brands');
                    if (brandCat && Array.isArray(brandCat.items)) {
                        setBrandsList(brandCat.items);
                    }
                }
                const uRes = await fetch(`${API_BASE}/users?limit=1000`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    const usersArr = Array.isArray(uData) ? uData : (Array.isArray(uData?.users) ? uData.users : []);
                    setUsersList(usersArr);
                }
            } catch (err) {
                console.error('Failed to load filter metadata:', err);
            }
        };
        fetchFilters();
    }, [API_BASE]);

    // Fetch Audit Logs (supports both MongoDB active store and Google Sheet archive)
    const fetchLogs = async () => {
        setLoading(true);
        try {
            const isGoogleSheetView = selectedCategory === 'GoogleSheetHistory';
            const params = new URLSearchParams({
                username: user?.username || '',
                userRole: user?.role || '',
                userBrand: user?.brand || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                limit: 300
            });

            if (selectedCategory && selectedCategory !== 'All' && selectedCategory !== 'GoogleSheetHistory') {
                params.set('category', selectedCategory);
            }
            if (selectedLevel && selectedLevel !== 'All') params.set('level', selectedLevel);
            if (selectedBrand) params.set('brand', selectedBrand);
            if (targetUser) params.set('targetUser', targetUser);
            if (searchTerm) params.set('search', searchTerm);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const endpoint = isGoogleSheetView
                ? `${API_BASE}/audit-logs/google-sheet-history`
                : `${API_BASE}/audit-logs`;

            const res = await fetch(`${endpoint}?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                setLogs(items);
                if (items.length > 0 && !selectedLog) {
                    setSelectedLog(items[0]);
                } else if (items.length > 0 && selectedLog) {
                    // Keep selection if exists in new set
                    const found = items.find(l => (l._id || l.eventId) === (selectedLog._id || selectedLog.eventId));
                    setSelectedLog(found || items[0]);
                } else {
                    setSelectedLog(null);
                }
            }

            // Also fetch stats for MongoDB if not in Google Sheet view
            if (!isGoogleSheetView) {
                const statsRes = await fetch(`${API_BASE}/audit-logs/stats?${params.toString()}`);
                if (statsRes.ok) {
                    const sData = await statsRes.json();
                    setStats(sData);
                }
            }
        } catch (err) {
            console.error('Fetch audit logs error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch 7-Day Archival Status
    const fetchArchivalStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/audit-logs/archive-status?days=7`);
            if (res.ok) {
                const data = await res.json();
                setArchivalStatus(data);
            }
        } catch (err) {
            console.error('Fetch archival status error:', err);
        }
    };

    // Trigger Manual 7-Day Archival to Google Sheet & Clean DB
    const handleTriggerArchival = async () => {
        setArchiving(true);
        setArchiveSuccessMsg('');
        try {
            const res = await fetch(`${API_BASE}/audit-logs/archive-7days`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: 7, username: user?.username || 'Admin' })
            });
            const data = await res.json();
            if (data.success) {
                setArchiveSuccessMsg(data.message || `Archived ${data.count} records to Google Sheet and cleaned from database.`);
                fetchLogs();
                fetchArchivalStatus();
            } else {
                alert('Archival failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Archival error: ' + err.message);
        } finally {
            setArchiving(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchArchivalStatus();
    }, [selectedCategory, selectedLevel, selectedBrand, targetUser, startDate, endDate]);

    // Format Date for Windows Explorer / Event Viewer style
    const formatEventTime = (timestamp) => {
        if (!timestamp) return '—';
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return String(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = d.getFullYear();
        const MM = pad(d.getMonth() + 1);
        const DD = pad(d.getDate());
        const hh = pad(d.getHours());
        const mm = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
    };

    // Get Event Icon and Colors based on Level
    const getLevelBadge = (level) => {
        switch (level) {
            case 'Error':
                return {
                    icon: <FaTimesCircle className="text-red-500 text-sm" />,
                    text: 'Error',
                    color: 'text-red-700 bg-red-50 border-red-200'
                };
            case 'Warning':
                return {
                    icon: <FaExclamationTriangle className="text-amber-500 text-sm" />,
                    text: 'Warning',
                    color: 'text-amber-800 bg-amber-50 border-amber-200'
                };
            case 'SuccessAudit':
                return {
                    icon: <FaCheckCircle className="text-emerald-500 text-sm" />,
                    text: 'Audit Success',
                    color: 'text-emerald-800 bg-emerald-50 border-emerald-200'
                };
            case 'AuditFailure':
                return {
                    icon: <FaTimesCircle className="text-red-600 text-sm" />,
                    text: 'Audit Failure',
                    color: 'text-red-800 bg-red-100 border-red-300'
                };
            case 'Information':
            default:
                return {
                    icon: <FaInfoCircle className="text-sky-500 text-sm" />,
                    text: 'Information',
                    color: 'text-sky-800 bg-sky-50 border-sky-200'
                };
        }
    };

    // Export Log to Excel / CSV
    const handleExport = () => {
        if (logs.length === 0) return alert('No logs to export.');
        const rows = logs.map((l, idx) => ({
            'Event No': idx + 1,
            'Event ID': l.eventId || `EVT-${1000 + idx}`,
            'Level': l.level || 'Information',
            'Date & Time': formatEventTime(l.timestamp),
            'Source': l.category || 'System',
            'Task Category': l.taskCategory || l.action || 'General',
            'User': l.username || 'System',
            'Role': l.role || 'Staff',
            'Brand': l.brand || 'Global',
            'IP Address': l.ip || '127.0.0.1',
            'Client Device': l.deviceInfo || 'Windows Client',
            'Description': l.description || ''
        }));
        exportToExcel(rows, `Windows_System_Event_Logs_${selectedCategory}`);
    };

    // Format log entry into Windows Event XML/JSON
    const formatXmlView = (log) => {
        if (!log) return '<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\n  <System>\n    <NoEventSelected />\n  </System>\n</Event>';
        const payloadJson = JSON.stringify(log.payload || {}, null, 2);
        return `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System>
    <Provider Name="SYSTEM_MDM_AUDIT_SERVICE" />
    <EventID Qualifiers="16384">${log.eventId || '4624'}</EventID>
    <Version>2</Version>
    <Level>${log.level === 'Error' ? 2 : log.level === 'Warning' ? 3 : 4}</Level>
    <Task>${log.taskCategory || log.action || '0'}</Task>
    <Opcode>Info</Opcode>
    <Keywords>0x8020000000000000</Keywords>
    <TimeCreated SystemTime="${new Date(log.timestamp).toISOString()}" />
    <EventRecordID>${log._id || '0'}</EventRecordID>
    <Correlation />
    <Execution ProcessID="4" ThreadID="128" />
    <Channel>SystemMDM/${log.category || 'Security'}</Channel>
    <Computer>MDM-SERVER-NODE1</Computer>
    <Security UserID="${log.username}" Role="${log.role || 'Staff'}" Brand="${log.brand || 'Global'}" />
  </System>
  <EventData>
    <Data Name="SubjectUserName">${log.username}</Data>
    <Data Name="SubjectUserSid">${log.role || 'Staff'}</Data>
    <Data Name="IpAddress">${log.ip || '127.0.0.1'}</Data>
    <Data Name="UserAgent">${log.deviceInfo || 'Windows PC'}</Data>
    <Data Name="Action">${log.action || 'GENERAL'}</Data>
    <Data Name="Description">${log.description || ''}</Data>
    <Data Name="ContractId">${log.contractId || '-'}</Data>
    <Data Name="PayloadJson">
${payloadJson.split('\n').map(l => '      ' + l).join('\n')}
    </Data>
  </EventData>
</Event>`;
    };

    const handleCopyXml = () => {
        if (!selectedLog) return;
        navigator.clipboard.writeText(formatXmlView(selectedLog));
        setCopiedXml(true);
        setTimeout(() => setCopiedXml(false), 2000);
    };

    // Active Menu Dropdown ('file', 'action', 'view', 'help', or null)
    const [activeMenu, setActiveMenu] = useState(null);

    // View toggles
    const [showConsoleTree, setShowConsoleTree] = useState(true);
    const [showToolbar, setShowToolbar] = useState(true);
    const [showPreviewPane, setShowPreviewPane] = useState(true);

    // Dialog Modals
    const [openHelpModal, setOpenHelpModal] = useState(false);
    const [openAboutModal, setOpenAboutModal] = useState(false);
    const [openOptionsModal, setOpenOptionsModal] = useState(false);
    const [openPropertiesModal, setOpenPropertiesModal] = useState(false);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.windows-menu-bar')) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] text-slate-800 font-sans select-none overflow-hidden border border-slate-300 shadow-xl rounded-none relative">
            {/* Windows 11 MMC Style Window Header */}
            <div className="h-8 bg-[#e1e4e8] border-b border-slate-300 flex items-center justify-between px-3 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                    <FaDesktop className="text-indigo-600 text-sm" />
                    <span>Event Viewer (Local) - [System Audit & Security Logs]</span>
                    <span className="text-[10px] bg-slate-200 border border-slate-300 px-1.5 py-0.2 rounded font-mono text-slate-600">
                        MMC v3.0
                    </span>
                    <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-800 px-2 py-0.2 rounded font-bold">
                        🔒 MongoDB Protected (Firebase Backup Excluded)
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                    <span className="px-2 py-0.5 hover:bg-slate-300 cursor-pointer rounded">_</span>
                    <span className="px-2 py-0.5 hover:bg-slate-300 cursor-pointer rounded">□</span>
                    <span className="px-2 py-0.5 hover:bg-red-500 hover:text-white cursor-pointer rounded" onClick={() => window.history.back()}>✕</span>
                </div>
            </div>

            {/* Menu Bar: File | Action | View | Help with Active Dropdowns */}
            <div className="h-6 bg-[#f7f8fa] border-b border-slate-300 flex items-center gap-1 px-2 text-[11px] text-slate-700 relative z-50 windows-menu-bar">
                {/* 1. FILE MENU */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${activeMenu === 'file' ? 'bg-[#0078d4] text-white' : 'hover:bg-slate-200'}`}
                    >
                        File
                    </button>
                    {activeMenu === 'file' && (
                        <div className="absolute left-0 top-6 w-52 bg-white border border-slate-300 shadow-2xl py-1 text-xs text-slate-800 z-[99999] rounded font-sans animate-in fade-in duration-100">
                            <button
                                onClick={() => { handleExport(); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center justify-between cursor-pointer"
                            >
                                <span className="flex items-center gap-2"><FaDownload size={11} /> Export List...</span>
                                <span className="text-[10px] text-slate-400 font-mono">Ctrl+S</span>
                            </button>
                            <button
                                onClick={() => { setOpenOptionsModal(true); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <FaServer size={11} /> Options & Storage...
                            </button>
                            <div className="my-1 border-t border-slate-200"></div>
                            <button
                                onClick={() => { window.location.href = '/dashboard'; }}
                                className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white flex items-center gap-2 cursor-pointer text-red-600"
                            >
                                <FaTimes size={11} /> Exit Console
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. ACTION MENU */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'action' ? null : 'action'); }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${activeMenu === 'action' ? 'bg-[#0078d4] text-white' : 'hover:bg-slate-200'}`}
                    >
                        Action
                    </button>
                    {activeMenu === 'action' && (
                        <div className="absolute left-0 top-6 w-56 bg-white border border-slate-300 shadow-2xl py-1 text-xs text-slate-800 z-[99999] rounded font-sans animate-in fade-in duration-100">
                            <button
                                onClick={() => { fetchLogs(); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center justify-between cursor-pointer"
                            >
                                <span className="flex items-center gap-2"><FaSync size={11} /> Refresh Events</span>
                                <span className="text-[10px] text-slate-400 font-mono">F5</span>
                            </button>
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setStartDate('');
                                    setEndDate('');
                                    if (isMasterAdmin) { setSelectedBrand(''); setTargetUser(''); }
                                    setSelectedCategory('All');
                                    setSelectedLevel('All');
                                    setActiveMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <MdOutlineCleaningServices size={13} /> Clear Filters
                            </button>
                            <div className="my-1 border-t border-slate-200"></div>
                            <button
                                onClick={() => {
                                    if (selectedLog) {
                                        setOpenPropertiesModal(true);
                                    } else {
                                        alert('Please select an event log row first.');
                                    }
                                    setActiveMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <FaInfoCircle size={11} /> Event Properties...
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedLog) {
                                        navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                                        alert('✅ Event details copied to clipboard as JSON!');
                                    } else {
                                        alert('Please select an event log row first.');
                                    }
                                    setActiveMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <FaCopy size={11} /> Copy Event as JSON
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. VIEW MENU */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'view' ? null : 'view'); }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${activeMenu === 'view' ? 'bg-[#0078d4] text-white' : 'hover:bg-slate-200'}`}
                    >
                        View
                    </button>
                    {activeMenu === 'view' && (
                        <div className="absolute left-0 top-6 w-56 bg-white border border-slate-300 shadow-2xl py-1 text-xs text-slate-800 z-[99999] rounded font-sans animate-in fade-in duration-100">
                            <button
                                onClick={() => { setShowConsoleTree(!showConsoleTree); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>{showConsoleTree ? '✓ Show Console Tree' : '  Show Console Tree'}</span>
                            </button>
                            <button
                                onClick={() => { setShowToolbar(!showToolbar); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>{showToolbar ? '✓ Show Action Toolbar' : '  Show Action Toolbar'}</span>
                            </button>
                            <button
                                onClick={() => { setShowPreviewPane(!showPreviewPane); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center justify-between cursor-pointer"
                            >
                                <span>{showPreviewPane ? '✓ Show Event Properties Pane' : '  Show Event Properties Pane'}</span>
                            </button>
                            <div className="my-1 border-t border-slate-200"></div>
                            <button
                                onClick={() => { setDetailTab(detailTab === 'general' ? 'xml' : 'general'); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <MdCode size={13} /> Switch Tab ({detailTab === 'general' ? 'Details XML' : 'General'})
                            </button>
                        </div>
                    )}
                </div>

                {/* 4. HELP MENU */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'help' ? null : 'help'); }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${activeMenu === 'help' ? 'bg-[#0078d4] text-white' : 'hover:bg-slate-200'}`}
                    >
                        Help
                    </button>
                    {activeMenu === 'help' && (
                        <div className="absolute left-0 top-6 w-52 bg-white border border-slate-300 shadow-2xl py-1 text-xs text-slate-800 z-[99999] rounded font-sans animate-in fade-in duration-100">
                            <button
                                onClick={() => { setOpenHelpModal(true); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <FaInfoCircle size={11} /> Help Topics (សៀវភៅណែនាំ)
                            </button>
                            <button
                                onClick={() => { setOpenAboutModal(true); setActiveMenu(null); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#0078d4] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                                <FaDesktop size={11} /> About Event Viewer...
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Toolbar Action Strip */}
            {showToolbar && (
            <div className="bg-[#f0f2f5] border-b border-slate-300 p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Left Controls & Search */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer active:translate-y-px"
                        title="Refresh Event Log (F5)"
                    >
                        <FaSync className={`text-indigo-600 ${loading ? 'animate-spin' : ''}`} size={11} />
                        <span>Refresh</span>
                    </button>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-emerald-700 shadow-2xs cursor-pointer active:translate-y-px"
                        title="Save All Events As Excel / CSV"
                    >
                        <FaDownload size={11} />
                        <span>Export List...</span>
                    </button>

                    <button
                        onClick={() => { fetchArchivalStatus(); setOpenArchivalModal(true); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-xs font-semibold shadow-xs cursor-pointer active:translate-y-px transition-all"
                        title="Auto-sync and cleanup logs older than 7 days to Google Sheets"
                    >
                        <FaCloudUploadAlt size={13} className="animate-pulse" />
                        <span>Google Sheet Archive (&gt;7 Days)</span>
                        {archivalStatus.pendingCount > 0 && (
                            <span className="bg-amber-300 text-slate-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                                {archivalStatus.pendingCount}
                            </span>
                        )}
                    </button>

                    {/* Date Range Inputs (ពីថ្ងៃណា ដល់ថ្ងៃណា) */}
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                        <span className="text-[11px] text-slate-500 font-medium">ពីថ្ងៃ:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-6 text-xs text-slate-800 bg-transparent outline-none font-mono cursor-pointer"
                        />
                        <span className="text-slate-400 text-xs">→</span>
                        <span className="text-[11px] text-slate-500 font-medium">ដល់ថ្ងៃ:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-6 text-xs text-slate-800 bg-transparent outline-none font-mono cursor-pointer"
                        />
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-slate-400 hover:text-red-500 text-xs ml-1 font-bold cursor-pointer"
                                title="Clear date filter"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setStartDate('');
                            setEndDate('');
                            setSelectedBrand('');
                            setTargetUser('');
                            setSelectedCategory('All');
                            setSelectedLevel('All');
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-600 shadow-2xs cursor-pointer active:translate-y-px"
                    >
                        <MdOutlineCleaningServices size={13} />
                        <span>Clear Filters</span>
                    </button>

                    {/* Quick Search */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                            placeholder="Filter current log (Type & press Enter)..."
                            className="w-56 h-7 pl-7 pr-3 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-indigo-500 font-sans"
                        />
                        <FaSearch className="absolute left-2.5 top-2 text-slate-400 text-xs pointer-events-none" />
                        {searchTerm && (
                            <button onClick={() => { setSearchTerm(''); fetchLogs(); }} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                <FaTimes size={10} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Filters (Brand, User, Severity) */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Brand Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">Brand:</span>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="h-7 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        >
                            <option value="">🌐 All Brands (ទាំងអស់)</option>
                            {brandsList.map((b, idx) => (
                                <option key={idx} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    {/* User Account Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">Account:</span>
                        <select
                            value={targetUser}
                            onChange={(e) => setTargetUser(e.target.value)}
                            className="h-7 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-indigo-500 font-semibold cursor-pointer max-w-[170px]"
                        >
                            <option value="">👥 All Accounts ({usersList.length})</option>
                            {usersList.map((u, idx) => (
                                <option key={u._id || u.userId || idx} value={u.username}>
                                    {u.username} {u.name ? `(${u.name})` : ''} - {u.role || 'Staff'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Severity Level */}
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">Level:</span>
                        <select
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            className="h-7 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        >
                            <option value="All">All Levels (គ្រប់កម្រិត)</option>
                            <option value="Information">ℹ️ Information</option>
                            <option value="Warning">⚠️ Warning</option>
                            <option value="Error">⛔ Error</option>
                            <option value="SuccessAudit">🛡️ Success Audit</option>
                        </select>
                    </div>
                </div>
            </div>
            )}

            {/* Main Windows Explorer Two-Pane Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Navigation Tree Pane */}
                {showConsoleTree && (
                    <div className="w-64 bg-white border-r border-slate-300 p-2 overflow-y-auto flex flex-col text-xs">
                        <div className="text-[11px] font-bold text-slate-500 uppercase px-2 py-1 mb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>Event Viewer Tree</span>
                            <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">Local</span>
                        </div>

                        {/* Console Root */}
                        <div className="space-y-0.5 font-sans">
                            {/* Root Node */}
                            <div
                                onClick={() => setTreeOpen(prev => ({ ...prev, root: !prev.root }))}
                                className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 rounded cursor-pointer font-semibold text-slate-800"
                            >
                                {treeOpen.root ? <FaChevronDown size={9} className="text-slate-400" /> : <FaChevronRight size={9} className="text-slate-400" />}
                                <FaServer className="text-indigo-600" size={12} />
                                <span>Event Viewer (Local)</span>
                            </div>

                            {treeOpen.root && (
                                <div className="ml-4 pl-2 border-l border-slate-200 space-y-0.5">
                                    {/* 1. Active MongoDB Logs Node */}
                                    <div
                                        onClick={() => setTreeOpen(prev => ({ ...prev, windowsLogs: !prev.windowsLogs }))}
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 rounded cursor-pointer font-semibold text-slate-700"
                                    >
                                        {treeOpen.windowsLogs ? <FaChevronDown size={9} className="text-slate-400" /> : <FaChevronRight size={9} className="text-slate-400" />}
                                        <FaFolderOpen className="text-amber-500" size={12} />
                                        <span>System MDM Logs (Active)</span>
                                    </div>

                                    {treeOpen.windowsLogs && (
                                        <div className="ml-4 pl-2 border-l border-slate-200 space-y-0.5">
                                            {/* Security */}
                                            <div
                                                onClick={() => setSelectedCategory('Security')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'Security' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaShieldAlt className={selectedCategory === 'Security' ? 'text-white' : 'text-emerald-600'} />
                                                    <span>Security (សុវត្ថិភាព)</span>
                                                </span>
                                                <span className="text-[10px] opacity-80">{stats.securityCount || 0}</span>
                                            </div>

                                            {/* Navigation */}
                                            <div
                                                onClick={() => setSelectedCategory('Navigation')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'Navigation' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaLaptopCode className={selectedCategory === 'Navigation' ? 'text-white' : 'text-sky-600'} />
                                                    <span>Navigation & Pages</span>
                                                </span>
                                                <span className="text-[10px] opacity-80">{stats.navigationCount || 0}</span>
                                            </div>

                                            {/* User Interactions & Clicks */}
                                            <div
                                                onClick={() => setSelectedCategory('UserActivity')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'UserActivity' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaMousePointer className={selectedCategory === 'UserActivity' ? 'text-white' : 'text-teal-600'} />
                                                    <span>Button Clicks & Actions</span>
                                                </span>
                                            </div>

                                            {/* Contract & Application */}
                                            <div
                                                onClick={() => setSelectedCategory('Contract')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'Contract' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaFileAlt className={selectedCategory === 'Contract' ? 'text-white' : 'text-indigo-600'} />
                                                    <span>Contracts & Edits</span>
                                                </span>
                                                <span className="text-[10px] opacity-80">{stats.contractCount || 0}</span>
                                            </div>

                                            {/* Device Management */}
                                            <div
                                                onClick={() => setSelectedCategory('Device')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'Device' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaMobileAlt className={selectedCategory === 'Device' ? 'text-white' : 'text-purple-600'} />
                                                    <span>Device Operations</span>
                                                </span>
                                            </div>

                                            {/* System & Storage */}
                                            <div
                                                onClick={() => setSelectedCategory('System')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'System' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaDatabase className={selectedCategory === 'System' ? 'text-white' : 'text-slate-600'} />
                                                    <span>Database & System</span>
                                                </span>
                                            </div>

                                            {/* All Logs */}
                                            <div
                                                onClick={() => setSelectedCategory('All')}
                                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${selectedCategory === 'All' ? 'bg-[#0078d4] text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <MdOutlineViewStream className={selectedCategory === 'All' ? 'text-white' : 'text-slate-500'} />
                                                    <span>All Event Logs (ទាំងអស់)</span>
                                                </span>
                                                <span className="text-[10px] opacity-80">{stats.total || logs.length}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. History Data Clear (Google Sheet Archive) Node */}
                                    <div
                                        onClick={() => setTreeOpen(prev => ({ ...prev, googleSheetFolder: !prev.googleSheetFolder }))}
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 rounded cursor-pointer font-semibold text-slate-700 mt-2 pt-1 border-t border-slate-200"
                                    >
                                        {treeOpen.googleSheetFolder ? <FaChevronDown size={9} className="text-slate-400" /> : <FaChevronRight size={9} className="text-slate-400" />}
                                        <FaCloudUploadAlt className="text-emerald-600" size={13} />
                                        <span>History data clear</span>
                                    </div>

                                    {treeOpen.googleSheetFolder && (
                                        <div className="ml-4 pl-2 border-l border-emerald-300 space-y-0.5">
                                            <div
                                                onClick={() => setSelectedCategory('GoogleSheetHistory')}
                                                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs ${selectedCategory === 'GoogleSheetHistory' ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-xs' : 'hover:bg-emerald-50 text-emerald-900'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FaCloudUploadAlt className={selectedCategory === 'GoogleSheetHistory' ? 'text-white' : 'text-emerald-600'} />
                                                    <span>Google Sheet Cleared</span>
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${selectedCategory === 'GoogleSheetHistory' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    &gt;7d
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* System Summary Card */}
                        <div className="mt-auto pt-3 border-t border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                            <div className="font-bold text-slate-800">Diagnostic Summary:</div>
                            <div className="flex justify-between"><span>Current User:</span> <strong className="text-slate-900 font-mono">{user?.username}</strong></div>
                            <div className="flex justify-between"><span>Role:</span> <span className="font-semibold text-indigo-700">{user?.role}</span></div>
                            <div className="flex justify-between"><span>Branch / Brand:</span> <span>{user?.brand || 'All Brands'}</span></div>
                            <div className="flex justify-between"><span>Log Engine:</span> <span className="text-emerald-700 font-bold">MongoDB Cluster</span></div>
                        </div>
                    </div>
                )}

                {/* Right Pane: Split Table View & Event Properties */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* Google Sheet History Active Banner */}
                    {selectedCategory === 'GoogleSheetHistory' && (
                        <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-1.5 flex items-center justify-between text-xs text-emerald-900 font-semibold select-text">
                            <span className="flex items-center gap-2">
                                <FaCloudUploadAlt className="text-emerald-600 text-sm animate-pulse" />
                                <span>🌐 History Data Cleared — កំពុងបង្ហាញទិន្នន័យដែលបានសម្អាត និងទាញយកផ្ទាល់ពី Google Sheet (Read-only mode មិនមែន Database ទេ)</span>
                            </span>
                            <span className="text-[11px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                                {logs.length} Google Sheet Records
                            </span>
                        </div>
                    )}

                    {/* Top Section: Event Records Grid */}
                    <div className="flex-1 overflow-auto border-b border-slate-300">
                        <table className="w-full text-left border-collapse text-xs font-sans">
                            <thead className="bg-[#f0f2f5] text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none">
                                <tr>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-28">Level</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-40">Date and Time</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-28">Source</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-24 text-center">Event ID</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-36">Task Category</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-28">User</th>
                                    <th className="px-3 py-1.5 font-semibold border-r border-slate-300 w-24">Brand</th>
                                    <th className="px-3 py-1.5 font-semibold">Action & Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-slate-500 font-medium">
                                            <div className="flex items-center justify-center gap-2 text-indigo-600">
                                                <FaSync className="animate-spin text-sm" />
                                                <span>Querying system event records from MongoDB...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                                            No events recorded matching the current filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log, idx) => {
                                        const badge = getLevelBadge(log.level);
                                        const isSelected = selectedLog && (selectedLog._id === log._id || selectedLog.eventId === log.eventId);

                                        return (
                                            <tr
                                                key={log._id || log.eventId || idx}
                                                onClick={() => setSelectedLog(log)}
                                                className={`cursor-pointer transition-colors ${isSelected
                                                    ? 'bg-[#0078d4] text-white font-semibold'
                                                    : idx % 2 === 0 ? 'bg-white hover:bg-slate-100' : 'bg-[#fafbfc] hover:bg-slate-100'
                                                    }`}
                                            >
                                                {/* Level */}
                                                <td className="px-3 py-1.5 whitespace-nowrap flex items-center gap-1.5 border-r border-slate-200">
                                                    {badge.icon}
                                                    <span className={isSelected ? 'text-white' : ''}>{badge.text}</span>
                                                </td>

                                                {/* Date and Time */}
                                                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] border-r border-slate-200">
                                                    {formatEventTime(log.timestamp)}
                                                </td>

                                                {/* Source */}
                                                <td className="px-3 py-1.5 whitespace-nowrap border-r border-slate-200">
                                                    {log.category || 'System'}
                                                </td>

                                                {/* Event ID */}
                                                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-center font-bold border-r border-slate-200">
                                                    {log.eventId || `EVT-${1000 + idx}`}
                                                </td>

                                                {/* Task Category */}
                                                <td className="px-3 py-1.5 whitespace-nowrap border-r border-slate-200 truncate max-w-[150px]">
                                                    {log.taskCategory || log.action || 'General'}
                                                </td>

                                                {/* User */}
                                                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px] border-r border-slate-200">
                                                    {log.username || 'System'}
                                                </td>

                                                {/* Brand */}
                                                <td className="px-3 py-1.5 whitespace-nowrap text-[11px] border-r border-slate-200">
                                                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                        {log.brand || 'Global'}
                                                    </span>
                                                </td>

                                                {/* Action & Details */}
                                                <td className="px-3 py-1.5 truncate max-w-[300px]" title={log.description}>
                                                    {log.description || log.action || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Split Pane: Event Properties Inspector */}
                    {showPreviewPane && (
                    <div className="h-64 bg-[#f7f8fa] border-t-2 border-slate-300 flex flex-col">
                        {/* Event Properties Tabs */}
                        <div className="flex items-center justify-between border-b border-slate-300 px-3 pt-1 bg-[#eef1f4]">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setDetailTab('general')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-t cursor-pointer border-t border-x ${detailTab === 'general' ? 'bg-[#f7f8fa] border-slate-300 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                                >
                                    General (លម្អិតព្រឹត្តិការណ៍)
                                </button>
                                <button
                                    onClick={() => setDetailTab('xml')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-t cursor-pointer border-t border-x ${detailTab === 'xml' ? 'bg-[#f7f8fa] border-slate-300 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                                >
                                    Details (XML / JSON Structured View)
                                </button>
                            </div>

                            {selectedLog && (
                                <div className="text-[11px] text-slate-500 font-mono">
                                    Event ID: <strong className="text-slate-800">{selectedLog.eventId || 'EVT-1001'}</strong> &bull; Log Name: <span className="text-indigo-600 font-semibold">{selectedLog.category || 'System'}</span>
                                </div>
                            )}
                        </div>

                        {/* Inspector Content Area */}
                        <div className="flex-1 p-3 overflow-y-auto font-sans text-xs">
                            {selectedLog ? (
                                detailTab === 'general' ? (
                                    <div className="space-y-2">
                                        <div className="p-2.5 bg-white border border-slate-300 rounded shadow-2xs">
                                            <p className="font-semibold text-slate-900 leading-relaxed text-sm">
                                                {selectedLog.description || selectedLog.action}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                            <div className="p-2 bg-white border border-slate-200 rounded">
                                                <span className="text-slate-400 block font-semibold uppercase text-[9px]">Logged User</span>
                                                <strong className="text-slate-800 font-mono">{selectedLog.username}</strong> ({selectedLog.role || 'Staff'})
                                            </div>
                                            <div className="p-2 bg-white border border-slate-200 rounded">
                                                <span className="text-slate-400 block font-semibold uppercase text-[9px]">IP & Client Device</span>
                                                <strong className="text-slate-800 font-mono">{selectedLog.ip || '127.0.0.1'}</strong> &bull; {selectedLog.deviceInfo || 'Windows PC'}
                                            </div>
                                            <div className="p-2 bg-white border border-slate-200 rounded">
                                                <span className="text-slate-400 block font-semibold uppercase text-[9px]">Brand / Branch</span>
                                                <strong className="text-indigo-600">{selectedLog.brand || 'Global Master'}</strong>
                                            </div>
                                            <div className="p-2 bg-white border border-slate-200 rounded">
                                                <span className="text-slate-400 block font-semibold uppercase text-[9px]">Contract / Customer Ref</span>
                                                <strong className="text-slate-800 font-mono">{selectedLog.contractId || selectedLog.customerId || 'N/A'}</strong>
                                            </div>
                                        </div>

                                        {/* Structured Field Modification Diff Table (Old vs New) */}
                                        {selectedLog.payload?.diff && Array.isArray(selectedLog.payload.diff) && selectedLog.payload.diff.length > 0 && (
                                            <div className="bg-white border border-amber-300 rounded overflow-hidden shadow-2xs">
                                                <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-200 flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                                                        <span>🔄</span> កំណត់ត្រាបម្រែបម្រួលទិន្នន័យ (Field Modification Diff / Old vs New)
                                                    </span>
                                                    <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-bold font-mono">
                                                        {selectedLog.payload.diff.length} changes
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto max-h-48">
                                                    <table className="w-full text-[11px] text-left">
                                                        <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-bold border-b border-slate-200 sticky top-0">
                                                            <tr>
                                                                <th className="py-1.5 px-2.5">Field / Attribute</th>
                                                                <th className="py-1.5 px-2.5 text-rose-700 bg-rose-50/50">តម្លៃចាស់ (Previous / Old Value)</th>
                                                                <th className="py-1.5 px-2.5 text-emerald-700 bg-emerald-50/50">តម្លៃថ្មី (Updated / New Value)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 font-mono">
                                                            {selectedLog.payload.diff.map((d, dIdx) => (
                                                                <tr key={dIdx} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="py-1.5 px-2.5 font-bold text-slate-800 font-sans">
                                                                        {d.field}
                                                                    </td>
                                                                    <td className="py-1.5 px-2.5 text-rose-600 bg-rose-50/20 font-medium">
                                                                        <span className="line-through mr-1 opacity-70">
                                                                            {d.oldValue !== undefined && d.oldValue !== null && d.oldValue !== '' ? String(d.oldValue) : '(empty)'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-1.5 px-2.5 text-emerald-600 bg-emerald-50/20 font-bold">
                                                                        <span>
                                                                            {d.newValue !== undefined && d.newValue !== null && d.newValue !== '' ? String(d.newValue) : '(empty)'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Pre-Deletion Data Snapshot Display */}
                                        {(selectedLog.payload?.deletedData || selectedLog.payload?.deletedRecord || selectedLog.payload?.previousData) && (
                                            <div className="bg-rose-50/80 border border-rose-300 rounded overflow-hidden shadow-2xs">
                                                <div className="bg-rose-100 px-3 py-1.5 border-b border-rose-200 flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                                                        <FaTrashAlt className="text-rose-600" />
                                                        <span>ទិន្នន័យមុនពេលលុប (Pre-Deletion Data Snapshot Record)</span>
                                                    </span>
                                                    <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold font-mono">
                                                        Deleted Item Snapshot
                                                    </span>
                                                </div>
                                                <div className="p-3 bg-white space-y-2">
                                                    <div className="text-xs text-rose-800 font-semibold">
                                                        ⚠️ ទិន្នន័យខាងក្រោមនេះត្រូវបានកត់ត្រាទុកយ៉ាងលម្អិតមុនពេលប្រតិបត្តិការលុបចេញពី Database ដើម្បីដឹងច្បាស់ថាទិន្នន័យណាខ្លះត្រូវបានលុប៖
                                                    </div>
                                                    <div className="overflow-x-auto max-h-56 bg-slate-900 text-rose-300 font-mono text-[11px] p-2.5 rounded border border-slate-800">
                                                        <pre>{JSON.stringify(selectedLog.payload?.deletedData || selectedLog.payload?.deletedRecord || selectedLog.payload?.previousData, null, 2)}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 && !selectedLog.payload?.deletedData && (
                                            <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded border border-slate-800 overflow-x-auto">
                                                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Attached Payload:</div>
                                                <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={handleCopyXml}
                                            className="absolute right-2 top-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] flex items-center gap-1.5 shadow z-10 cursor-pointer"
                                        >
                                            <FaCopy size={11} />
                                            <span>{copiedXml ? 'Copied XML!' : 'Copy XML'}</span>
                                        </button>
                                        <pre className="p-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[11px] rounded border border-slate-700 overflow-x-auto leading-relaxed">
                                            {formatXmlView(selectedLog)}
                                        </pre>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-10 text-slate-400 italic">
                                    Select an event log entry from the table above to view its system properties.
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Bottom Windows Status Bar */}
            <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] font-mono select-none">
                <div className="flex items-center gap-4">
                    <span>Number of events: <strong>{logs.length}</strong></span>
                    <span>|</span>
                    <span>Storage Engine: <strong>MongoDB Cluster Local</strong></span>
                    <span>|</span>
                    <span>Firebase Sync: <strong>Excluded (Non-destructive)</strong></span>
                </div>
                <div className="flex items-center gap-3">
                    <span>Scope: <strong>{isMasterAdmin ? (selectedBrand ? `Brand: ${selectedBrand}` : 'Master SuperAdmin (All)') : `User: ${user?.username}`}</strong></span>
                    <span>|</span>
                    <span>Ready</span>
                </div>
            </div>

            {/* ── WINDOWS DIALOG MODAL: ABOUT EVENT VIEWER ── */}
            {openAboutModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#f0f2f5] border border-slate-400 rounded shadow-2xl w-full max-w-md overflow-hidden text-slate-800 text-xs font-sans animate-in zoom-in-95 duration-100">
                        <div className="bg-[#0078d4] text-white px-3 py-1.5 flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-2"><FaDesktop /> About System MDM Event Viewer</span>
                            <button onClick={() => setOpenAboutModal(false)} className="hover:bg-red-500 px-2 py-0.5 rounded cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 space-y-3 bg-white">
                            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                                <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded flex items-center justify-center text-indigo-600 text-2xl">
                                    <FaDesktop />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900">SYSTEM MDM Windows Event Viewer</h4>
                                    <p className="text-[11px] text-slate-500 font-mono">Microsoft Management Console v3.0 Compatible</p>
                                    <p className="text-[11px] text-indigo-600 font-semibold">Version 26.2.92 (Build 2026.09)</p>
                                </div>
                            </div>
                            <div className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                                <p>• <strong>High-Security Audit Trail</strong>: Records full user activity, authentication logs, contract revisions, and device locks.</p>
                                <p>• <strong>Isolation Policy</strong>: Branch staff access strictly scoped logs; Master SuperAdmin manages centralized telemetry.</p>
                                <p>• <strong>Non-Destructive Storage</strong>: Saved directly in MongoDB cluster storage. Excluded from Firebase backups to maintain ultra-fast performance.</p>
                            </div>
                        </div>
                        <div className="bg-[#f0f2f5] px-4 py-2 flex justify-end border-t border-slate-300">
                            <button onClick={() => setOpenAboutModal(false)} className="px-5 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer shadow-xs">OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── WINDOWS DIALOG MODAL: HELP TOPICS ── */}
            {openHelpModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#f0f2f5] border border-slate-400 rounded shadow-2xl w-full max-w-lg overflow-hidden text-slate-800 text-xs font-sans animate-in zoom-in-95 duration-100">
                        <div className="bg-[#0078d4] text-white px-3 py-1.5 flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-2"><FaInfoCircle /> Event Viewer Help & Documentation</span>
                            <button onClick={() => setOpenHelpModal(false)} className="hover:bg-red-500 px-2 py-0.5 rounded cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 space-y-3 bg-white max-h-[70vh] overflow-y-auto">
                            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">📚 ការណែនាំអំពីប្រភេទកំណត់ហេតុ (Log Categories):</h4>
                            <div className="space-y-2 text-[11px] leading-relaxed text-slate-700">
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <strong className="text-emerald-700 font-bold">1. Security (សុវត្ថិភាព):</strong> កត់ត្រារាល់ពេល Login, ការស្នើសុំ OTP, ការ Login បរាជ័យ, និងការផ្លាស់ប្តូរលេខសម្ងាត់។
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <strong className="text-sky-700 font-bold">2. Navigation & Pages:</strong> កត់ត្រារាល់ការបើកទំព័រនានាក្នុងប្រព័ន្ធ (User Access Trail) ជាមួយ IP និង Device។
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <strong className="text-indigo-700 font-bold">3. Contracts & Edits:</strong> កត់ត្រាការបង្កើតកុងត្រាថ្មី, ការកែប្រែទិន្នន័យ (Edit History), និងការបង់ប្រាក់។
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <strong className="text-purple-700 font-bold">4. Device Operations:</strong> កត់ត្រាការបញ្ជា Lock Phone, Unlock Phone, និង Set Wallpaper ទៅកាន់ទូរស័ព្ទភ្ញៀវ។
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <strong className="text-slate-800 font-bold">5. Database & System:</strong> កត់ត្រាសកម្មភាព Restore ពី Firebase និងការកែសម្រួលប្រព័ន្ធ Control System។
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#f0f2f5] px-4 py-2 flex justify-end border-t border-slate-300">
                            <button onClick={() => setOpenHelpModal(false)} className="px-5 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer shadow-xs">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── WINDOWS DIALOG MODAL: OPTIONS & STORAGE ── */}
            {openOptionsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#f0f2f5] border border-slate-400 rounded shadow-2xl w-full max-w-md overflow-hidden text-slate-800 text-xs font-sans animate-in zoom-in-95 duration-100">
                        <div className="bg-[#0078d4] text-white px-3 py-1.5 flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-2"><FaServer /> Event Viewer Storage Configuration</span>
                            <button onClick={() => setOpenOptionsModal(false)} className="hover:bg-red-500 px-2 py-0.5 rounded cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 space-y-3 bg-white">
                            <div className="space-y-2 text-xs">
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Primary Log Database Engine</label>
                                    <input type="text" readOnly value="MongoDB Multi-DB Triple Cluster" className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded font-mono text-slate-800 font-semibold" />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Firebase Sync Policy</label>
                                    <input type="text" readOnly value="Excluded (Preserves high database performance)" className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded text-amber-800 font-semibold font-mono" />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1">Event Cache Buffer Limit</label>
                                    <input type="text" readOnly value="2,000 Recent Events In-Memory + Unlimited MongoDB Store" className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded font-mono text-slate-800" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#f0f2f5] px-4 py-2 flex justify-end gap-2 border-t border-slate-300">
                            <button onClick={() => setOpenOptionsModal(false)} className="px-5 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer shadow-xs">OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── WINDOWS DIALOG MODAL: EVENT PROPERTIES ── */}
            {openPropertiesModal && selectedLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#f0f2f5] border border-slate-400 rounded shadow-2xl w-full max-w-lg overflow-hidden text-slate-800 text-xs font-sans animate-in zoom-in-95 duration-100">
                        <div className="bg-[#0078d4] text-white px-3 py-1.5 flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-2"><FaInfoCircle /> Event {selectedLog.eventId || 'EVT'} Properties</span>
                            <button onClick={() => setOpenPropertiesModal(false)} className="hover:bg-red-500 px-2 py-0.5 rounded cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 space-y-3 bg-white max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-400 block font-semibold text-[10px]">EVENT ID</span>
                                    <strong className="font-mono text-slate-900">{selectedLog.eventId || 'EVT-1001'}</strong>
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-400 block font-semibold text-[10px]">LOG LEVEL</span>
                                    <strong className="text-slate-900">{selectedLog.level || 'Information'}</strong>
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-400 block font-semibold text-[10px]">DATE & TIME</span>
                                    <span className="font-mono text-slate-900">{formatEventTime(selectedLog.timestamp)}</span>
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-400 block font-semibold text-[10px]">SOURCE / CATEGORY</span>
                                    <span className="text-indigo-700 font-semibold">{selectedLog.category || 'System'}</span>
                                </div>
                            </div>
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1">
                                <span className="text-slate-400 block font-semibold text-[10px]">DESCRIPTION</span>
                                <p className="text-slate-900 font-semibold leading-relaxed">{selectedLog.description}</p>
                            </div>
                            <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded border border-slate-800 overflow-x-auto">
                                <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
                            </div>
                        </div>
                        <div className="bg-[#f0f2f5] px-4 py-2 flex justify-between items-center border-t border-slate-300">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                                    alert('Copied event properties!');
                                }}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer"
                            >
                                Copy Details
                            </button>
                            <button onClick={() => setOpenPropertiesModal(false)} className="px-5 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer shadow-xs">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── WINDOWS DIALOG MODAL: GOOGLE SHEET 7-DAY ARCHIVE & PURGE ── */}
            {openArchivalModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#f0f2f5] border border-slate-400 rounded shadow-2xl w-full max-w-lg overflow-hidden text-slate-800 text-xs font-sans animate-in zoom-in-95 duration-100">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-3 py-2 flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-2"><FaCloudUploadAlt size={15} /> 7-Day Retention & Google Sheet Archival (កំណត់ហេតុលើសពី ៧ថ្ងៃ)</span>
                            <button onClick={() => { setOpenArchivalModal(false); setArchiveSuccessMsg(''); }} className="hover:bg-red-500 px-2 py-0.5 rounded cursor-pointer">✕</button>
                        </div>
                        <div className="p-4 space-y-3 bg-white max-h-[75vh] overflow-y-auto">
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 space-y-1 text-xs">
                                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                                    <FaCheckCircle className="text-emerald-600" />
                                    <span>គោលការណ៍រក្សាទុក និងសម្អាតអូតូ (Auto 7-Day Retention Policy):</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-700">
                                    • រាល់កំណត់ហេតុសកម្មភាព (System Event Logs) ដែលមានអាយុកាលលើសពី <strong>៧ ថ្ងៃ</strong> នឹងត្រូវ <strong>បញ្ចូលទៅកាន់ Google Sheet អូតូម៉ាទិក</strong> និងបម្រុងទុក Safety CSV Backup។<br />
                                    • បន្ទាប់ពីការបញ្ចូលទៅ Google Sheet ជោគជ័យ ប្រព័ន្ធនឹង <strong>លុបសម្អាតចេញពី Database</strong> ដោយស្វ័យប្រវត្តិដើម្បីរក្សាល្បឿនលឿននៃប្រព័ន្ធ។
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-500 block text-[10px] uppercase font-bold">កំណត់ត្រាលើសពី ៧ថ្ងៃ (Ready to Archive)</span>
                                    <strong className="text-lg font-mono text-amber-600 font-bold">{archivalStatus.pendingCount || 0}</strong>
                                    <span className="text-[10px] text-slate-500 block">កត់ត្រាមុន {archivalStatus.cutoffDate ? new Date(archivalStatus.cutoffDate).toLocaleDateString() : '7 days ago'}</span>
                                </div>
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-slate-500 block text-[10px] uppercase font-bold">ចំនួនកំណត់ត្រាសរុប (Total in Database)</span>
                                    <strong className="text-lg font-mono text-indigo-700 font-bold">{archivalStatus.totalCount || logs.length}</strong>
                                    <span className="text-[10px] text-slate-500 block">MongoDB Active Cluster</span>
                                </div>
                            </div>

                            {archiveSuccessMsg && (
                                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-semibold text-xs flex items-center gap-2">
                                    <FaCheckCircle className="text-emerald-600 text-base shrink-0" />
                                    <span>{archiveSuccessMsg}</span>
                                </div>
                            )}

                            <div className="p-2.5 bg-slate-100 border border-slate-300 rounded text-[11px] text-slate-600 space-y-1">
                                <div className="font-semibold text-slate-800">⚙️ កាលវិភាគដំណើរការអូតូ (Auto Scheduler Status):</div>
                                <div>• ដំណើរការស្វ័យប្រវត្តិកំណត់រៀងរាល់ <strong>៦ ម៉ោងម្តង</strong> និងពេល Server ចាប់ផ្តើមដំណើរការ។</div>
                                <div>• Google Sheet Target ID: <code className="text-indigo-600 font-mono text-[10px]">process.env.GOOGLE_SHEET_ID</code></div>
                            </div>
                        </div>

                        <div className="bg-[#f0f2f5] px-4 py-2.5 flex justify-between items-center border-t border-slate-300">
                            <button
                                onClick={handleTriggerArchival}
                                disabled={archiving || archivalStatus.pendingCount === 0}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs active:translate-y-px transition-all"
                            >
                                {archiving ? (
                                    <>
                                        <FaSync className="animate-spin" size={11} />
                                        <span>កំពុងបញ្ចូល Google Sheet & លុបសម្អាត...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaCloudUploadAlt size={13} />
                                        <span>🚀 Sync Google Sheet & Clean DB Now</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => { setOpenArchivalModal(false); setArchiveSuccessMsg(''); }}
                                className="px-5 py-1.5 bg-white hover:bg-slate-100 border border-slate-400 rounded text-xs font-semibold cursor-pointer shadow-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemAuditLogs;
