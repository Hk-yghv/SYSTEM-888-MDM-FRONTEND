import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  FaTelegramPlane,
  FaPlus,
  FaTrash,
  FaEdit,
  FaSearch,
  FaSmile,
  FaTimes,
  FaUser,
  FaUsers,
  FaRobot,
  FaBullhorn,
  FaLock,
  FaKey,
  FaCog,
  FaCheck,
  FaCheckDouble,
  FaSyncAlt,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaPaperPlane,
  FaInfoCircle,
  FaCopy,
  FaEye,
  FaEyeSlash,
  FaCircle,
  FaRegSmile,
  FaChevronDown,
  FaChevronUp,
  FaEllipsisV,
  FaPlay,
  FaPause,
  FaMicrophone,
  FaImage,
  FaPaperclip,
  FaDownload,
  FaFileAlt,
  FaVideo,
  FaMusic
} from "react-icons/fa";
import {
  MdOutlineSend,
  MdChatBubbleOutline,
  MdOutlineSmartToy,
  MdAttachFile,
  MdAudiotrack,
  MdInsertDriveFile,
  MdDownload
} from "react-icons/md";

const COLOR_PALETTE = [
  "#0284c7", // Sky Blue
  "#059669", // Emerald Green
  "#7c3aed", // Violet
  "#d97706", // Amber
  "#e11d48", // Rose
  "#0891b2", // Cyan
  "#4f46e5"  // Indigo
];

// Popular emojis for quick picker
const POPULAR_EMOJIS = [
  "👍", "❤️", "🔥", "🎉", "👏", "😊", "🙏", "✅",
  "👌", "😍", "🤣", "🙌", "💯", "🚀", "💡", "⭐",
  "🤝", "💬", "📞", "📦", "💵", "🕒", "📍", "⚠️"
];

// Format bytes into human-readable size
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format seconds into MM:SS
const formatDuration = (secs) => {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

// Inline Voice Note Player Component
const VoiceNotePlayer = ({ audioUrl, duration, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Audio play error:", err);
          setIsPlaying(false);
        });
    }
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer ${
          isMe
            ? "bg-white text-sky-600 hover:bg-sky-50"
            : "bg-sky-600 text-white hover:bg-sky-700"
        }`}
      >
        {isPlaying ? <FaPause className="text-xs" /> : <FaPlay className="text-xs ml-0.5" />}
      </button>

      {/* Waveform / Progress Bar */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div
          onClick={(e) => {
            if (!audioRef.current || !totalDuration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = pos * totalDuration;
          }}
          className={`h-2 rounded-full overflow-hidden cursor-pointer ${
            isMe ? "bg-white/30" : "bg-slate-200"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isMe ? "bg-white" : "bg-sky-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className={`flex items-center justify-between text-[10px] font-mono leading-none ${
            isMe ? "text-sky-100" : "text-slate-500"
          }`}
        >
          <span className="flex items-center gap-1">
            <FaMicrophone className="text-[9px]" />
            <span>{formatDuration(isPlaying ? currentTime : totalDuration)}</span>
          </span>
          <span>Voice</span>
        </div>
      </div>
    </div>
  );
};

const TelegramPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const isSyncingRef = useRef(false);
  const accountDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaCacheRef = useRef({});

  // Storage key is scoped to the logged-in system user
  const storageKey = `telegram_real_accounts_${user?.username || "default"}`;

  // Accounts state (Max 5 real accounts)
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 5);
        }
      }
    } catch (e) {
      console.error("Failed to parse saved telegram accounts:", e);
    }
    return [];
  });

  const [activeAccountId, setActiveAccountId] = useState(() => {
    return accounts[0]?.id || null;
  });

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all"); // all, personal, group, channel, bot
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Lightbox Preview Modal State
  const [previewImage, setPreviewImage] = useState(null);

  // Account Modal States
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [modalAccountName, setModalAccountName] = useState("");
  const [modalBotToken, setModalBotToken] = useState("");
  const [modalBotUsername, setModalBotUsername] = useState("");
  const [modalColor, setModalColor] = useState(COLOR_PALETTE[0]);
  const [showTokenPassword, setShowTokenPassword] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verifiedBotInfo, setVerifiedBotInfo] = useState(null);
  const [verifyError, setVerifyError] = useState("");

  // New Chat Modal States
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatTargetId, setNewChatTargetId] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatType, setNewChatType] = useState("personal"); // personal, group, channel
  const [newChatInitialMessage, setNewChatInitialMessage] = useState("");
  const [isSendingNewChat, setIsSendingNewChat] = useState(false);
  const [newChatError, setNewChatError] = useState("");

  // Click outside to close account dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save accounts to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(accounts));
    } catch (e) {
      console.error("Failed to save telegram accounts:", e);
    }
  }, [accounts, storageKey]);

  // Set active account if none selected
  useEffect(() => {
    if (accounts.length > 0 && (!activeAccountId || !accounts.some((a) => a.id === activeAccountId))) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId]);

  // Set active chat when switching accounts
  useEffect(() => {
    if (activeAccount?.chats?.length > 0) {
      if (!activeAccount.chats.some((c) => c.id === activeChatId)) {
        setActiveChatId(activeAccount.chats[0].id);
      }
    } else {
      setActiveChatId(null);
    }
  }, [activeAccountId, activeAccount, activeChatId]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, activeAccount?.chats]);

  const activeChat = activeAccount?.chats?.find((c) => c.id === activeChatId) || null;

  // Resolve Telegram File ID to direct playable/downloadable URL
  const resolveTelegramFileUrl = useCallback(async (botToken, fileId) => {
    if (!botToken || !fileId) return null;
    if (mediaCacheRef.current[fileId]) {
      return mediaCacheRef.current[fileId];
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const data = await res.json();
      if (data.ok && data.result?.file_path) {
        const fullUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
        mediaCacheRef.current[fileId] = fullUrl;
        return fullUrl;
      }
    } catch (err) {
      console.error("Failed to resolve telegram file URL:", err);
    }
    return null;
  }, []);

  // Real Telegram API: Fetch updates with 409 Conflict handling & media URL resolution
  const syncTelegramUpdates = useCallback(
    async (account) => {
      if (!account || !account.botToken) return;
      if (isSyncingRef.current) return; // Prevent concurrent overlapping requests

      isSyncingRef.current = true;

      try {
        const offset = account.lastUpdateId ? account.lastUpdateId + 1 : 0;
        // Use timeout=0 to prevent server lockup and eliminate 409 conflict
        const res = await fetch(
          `https://api.telegram.org/bot${account.botToken}/getUpdates?offset=${offset}&timeout=0`
        );

        // Handle 409 Conflict (e.g. Webhook is active or concurrent request)
        if (res.status === 409) {
          try {
            // Delete active webhook if it was set previously
            await fetch(
              `https://api.telegram.org/bot${account.botToken}/deleteWebhook?drop_pending_updates=false`
            );
          } catch (e) {}
          return;
        }

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (!data.ok) {
          return;
        }

        setSyncError(null);
        const updates = data.result || [];
        if (updates.length === 0) return;

        let maxUpdateId = account.lastUpdateId || 0;

        // Process all updates and resolve media URLs
        const processedUpdates = [];

        for (const update of updates) {
          if (update.update_id > maxUpdateId) {
            maxUpdateId = update.update_id;
          }

          const msg = update.message || update.channel_post || update.edited_message;
          if (!msg || !msg.chat) continue;

          const chatId = String(msg.chat.id);
          const chatTitle =
            msg.chat.title ||
            [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(" ") ||
            msg.chat.username ||
            `Chat ${chatId}`;

          let chatType = "personal";
          if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
            chatType = "group";
          } else if (msg.chat.type === "channel") {
            chatType = "channel";
          } else if (msg.from?.is_bot) {
            chatType = "bot";
          }

          // Extract Media Information
          let mediaType = null;
          let mediaFileId = null;
          let mediaFileName = null;
          let mediaFileSize = null;
          let mediaDuration = null;
          let mediaMimeType = null;

          if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            mediaType = "photo";
            // Get highest resolution photo
            const highestPhoto = msg.photo[msg.photo.length - 1];
            mediaFileId = highestPhoto.file_id;
            mediaFileSize = highestPhoto.file_size;
          } else if (msg.voice) {
            mediaType = "voice";
            mediaFileId = msg.voice.file_id;
            mediaDuration = msg.voice.duration;
            mediaFileSize = msg.voice.file_size;
            mediaMimeType = msg.voice.mime_type || "audio/ogg";
          } else if (msg.audio) {
            mediaType = "audio";
            mediaFileId = msg.audio.file_id;
            mediaFileName =
              [msg.audio.performer, msg.audio.title].filter(Boolean).join(" - ") ||
              msg.audio.file_name ||
              "Audio.mp3";
            mediaDuration = msg.audio.duration;
            mediaFileSize = msg.audio.file_size;
            mediaMimeType = msg.audio.mime_type || "audio/mpeg";
          } else if (msg.video) {
            mediaType = "video";
            mediaFileId = msg.video.file_id;
            mediaDuration = msg.video.duration;
            mediaFileSize = msg.video.file_size;
            mediaMimeType = msg.video.mime_type || "video/mp4";
          } else if (msg.document) {
            mediaType = "document";
            mediaFileId = msg.document.file_id;
            mediaFileName = msg.document.file_name || "Document";
            mediaFileSize = msg.document.file_size;
            mediaMimeType = msg.document.mime_type;
          } else if (msg.sticker) {
            mediaType = "sticker";
            mediaFileId = msg.sticker.thumb?.file_id || msg.sticker.file_id;
          }

          // Resolve direct media URL from Telegram API
          let mediaUrl = null;
          if (mediaFileId) {
            mediaUrl = await resolveTelegramFileUrl(account.botToken, mediaFileId);
          }

          let defaultText = msg.text || msg.caption || "";
          if (!defaultText) {
            if (mediaType === "photo") defaultText = "📷 [រូបភាព]";
            else if (mediaType === "voice") defaultText = "🎤 [សារជាសម្លេង / Voice Note]";
            else if (mediaType === "audio") defaultText = `🎵 [តន្ត្រី] ${mediaFileName || ""}`;
            else if (mediaType === "video") defaultText = "🎥 [វីដេអូ]";
            else if (mediaType === "document") defaultText = `📄 [ឯកសារ] ${mediaFileName || ""}`;
            else if (mediaType === "sticker") defaultText = "🏷️ [Sticker]";
            else defaultText = "សារ Telegram";
          }

          const msgTime = new Date((msg.date || Date.now() / 1000) * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });

          const newMsgObj = {
            id: `tg_${msg.message_id || Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            messageId: msg.message_id,
            sender: msg.from?.id === account.botInfo?.id ? "me" : "them",
            senderName:
              [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
              msg.from?.username ||
              "Telegram User",
            text: defaultText,
            mediaType,
            mediaFileId,
            mediaUrl,
            mediaFileName,
            mediaFileSize,
            mediaDuration,
            mediaMimeType,
            time: msgTime,
            status: "read",
            rawDate: msg.date
          };

          processedUpdates.push({
            chatId,
            chatTitle,
            chatType,
            chatUsername: msg.chat.username ? `@${msg.chat.username}` : "",
            msgObj: newMsgObj
          });
        }

        // Apply new messages to accounts state
        setAccounts((prevAccounts) =>
          prevAccounts.map((acc) => {
            if (acc.id !== account.id) return acc;

            let updatedChats = [...(acc.chats || [])];

            processedUpdates.forEach(({ chatId, chatTitle, chatType, chatUsername, msgObj }) => {
              const existingChatIndex = updatedChats.findIndex((c) => String(c.id) === chatId);

              if (existingChatIndex >= 0) {
                const existingChat = updatedChats[existingChatIndex];
                const msgExists = existingChat.messages?.some(
                  (m) => m.messageId && m.messageId === msgObj.messageId
                );

                if (!msgExists) {
                  const newMessages = [...(existingChat.messages || []), msgObj];
                  const isCurrentlyActive = activeChatId === chatId && activeAccountId === acc.id;
                  updatedChats[existingChatIndex] = {
                    ...existingChat,
                    name: chatTitle,
                    username: chatUsername || existingChat.username,
                    unreadCount: isCurrentlyActive
                      ? 0
                      : (existingChat.unreadCount || 0) + (msgObj.sender === "them" ? 1 : 0),
                    messages: newMessages
                  };
                }
              } else {
                // Create new chat
                updatedChats.unshift({
                  id: chatId,
                  name: chatTitle,
                  type: chatType,
                  username: chatUsername,
                  unreadCount: msgObj.sender === "them" ? 1 : 0,
                  color: COLOR_PALETTE[updatedChats.length % COLOR_PALETTE.length],
                  messages: [msgObj]
                });
              }
            });

            return {
              ...acc,
              lastUpdateId: maxUpdateId,
              chats: updatedChats
            };
          })
        );
      } catch (err) {
        // Silently catch polling errors
      } finally {
        isSyncingRef.current = false;
      }
    },
    [activeChatId, activeAccountId, resolveTelegramFileUrl]
  );

  // On mount/account switch: re-resolve any messages with mediaFileId but missing/stale blob mediaUrl
  useEffect(() => {
    if (!activeAccount?.botToken || !activeAccount?.chats?.length) return;

    const resolveStaleMedia = async () => {
      const botToken = activeAccount.botToken;
      const accountId = activeAccount.id;

      // Gather all messages with a file_id but no valid (non-blob) URL
      const toResolve = [];
      for (const chat of activeAccount.chats) {
        for (const msg of chat.messages || []) {
          if (
            msg.mediaFileId &&
            (!msg.mediaUrl || msg.mediaUrl.startsWith("blob:"))
          ) {
            toResolve.push({ chatId: chat.id, msgId: msg.id, fileId: msg.mediaFileId });
          }
        }
      }

      if (toResolve.length === 0) return;

      // Resolve each stale file_id in parallel (up to 8 at once)
      const chunks = [];
      for (let i = 0; i < toResolve.length; i += 8) chunks.push(toResolve.slice(i, i + 8));

      const resolved = {};
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async ({ chatId, msgId, fileId }) => {
            const url = await resolveTelegramFileUrl(botToken, fileId);
            if (url) resolved[msgId] = url;
          })
        );
      }

      if (Object.keys(resolved).length === 0) return;

      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id !== accountId) return acc;
          return {
            ...acc,
            chats: acc.chats.map((chat) => ({
              ...chat,
              messages: (chat.messages || []).map((msg) =>
                resolved[msg.id] ? { ...msg, mediaUrl: resolved[msg.id] } : msg
              )
            }))
          };
        })
      );
    };

    resolveStaleMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.id, activeAccount?.botToken]);

  // Real-Time Polling Effect for active account (Every 4 seconds, safe non-overlapping)
  useEffect(() => {
    if (!activeAccount?.botToken) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Initial sync
    syncTelegramUpdates(activeAccount);

    pollingRef.current = setInterval(() => {
      syncTelegramUpdates(activeAccount);
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeAccount?.id, activeAccount?.botToken, syncTelegramUpdates]);

  // Manual Refresh Button
  const handleManualSync = async () => {
    if (!activeAccount?.botToken) return;
    setIsSyncing(true);
    await syncTelegramUpdates(activeAccount);
    setIsSyncing(false);
  };

  // Real Telegram API: Verify Token & fetch Bot Info
  const handleVerifyToken = async (tokenToVerify) => {
    const token = (tokenToVerify || modalBotToken).trim();
    if (!token) {
      setVerifyError("សូមបញ្ចូល Telegram Bot Token");
      return null;
    }

    setVerifyingToken(true);
    setVerifyError("");
    setVerifiedBotInfo(null);

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();

      if (data.ok && data.result) {
        setVerifiedBotInfo(data.result);
        if (!modalAccountName) {
          setModalAccountName(data.result.first_name || data.result.username || "Telegram Bot");
        }
        if (!modalBotUsername && data.result.username) {
          setModalBotUsername(`@${data.result.username}`);
        }
        return data.result;
      } else {
        setVerifyError(data.description || "Token មិនត្រឹមត្រូវ សូមពិនិត្យម្តងទៀត");
        return null;
      }
    } catch (err) {
      setVerifyError("មិនអាចភ្ជាប់ទៅកាន់ Telegram Server បានទេ សូមពិនិត្យមើល Internet");
      return null;
    } finally {
      setVerifyingToken(false);
    }
  };

  // Save Account (Add or Edit with Custom Bot Name and Custom Username)
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const token = modalBotToken.trim();
    if (!token) {
      setVerifyError("សូមបញ្ចូល Telegram Bot Token");
      return;
    }

    // Format username with @
    let cleanUsername = modalBotUsername.trim();
    if (cleanUsername && !cleanUsername.startsWith("@")) {
      cleanUsername = `@${cleanUsername}`;
    }

    let botInfo = verifiedBotInfo;
    if (!botInfo) {
      botInfo = await handleVerifyToken(token);
    }

    const finalUsername = cleanUsername || (botInfo?.username ? `@${botInfo.username}` : "");
    const accountName = modalAccountName.trim() || botInfo?.first_name || finalUsername || "Telegram Bot";

    if (editingAccountId) {
      // Edit existing
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccountId
            ? {
                ...a,
                name: accountName,
                botToken: token,
                color: modalColor,
                botInfo: botInfo || a.botInfo,
                username: finalUsername
              }
            : a
        )
      );
    } else {
      // Add new (Limit to 5)
      if (accounts.length >= 5) {
        alert("អ្នកអាចភ្ជាប់គណនី Telegram បានអតិបរមាត្រឹមតែ 5 Accounts ប៉ុណ្ណោះ។");
        return;
      }

      const newId = `acc_${Date.now()}`;
      const newAccount = {
        id: newId,
        name: accountName,
        botToken: token,
        color: modalColor,
        botInfo: botInfo || { first_name: accountName, username: finalUsername.replace("@", "") },
        username: finalUsername,
        lastUpdateId: 0,
        chats: []
      };

      setAccounts((prev) => [...prev, newAccount]);
      setActiveAccountId(newId);
    }

    closeAccountModal();
  };

  // Delete Account
  const handleDeleteAccount = (accId, e) => {
    e?.stopPropagation();
    if (window.confirm("តើលោកអ្នកពិតជាចង់លុបគណនី Telegram នេះចេញពីប្រព័ន្ធមែនទេ?")) {
      setAccounts((prev) => prev.filter((a) => a.id !== accId));
      if (activeAccountId === accId) {
        const remaining = accounts.filter((a) => a.id !== accId);
        setActiveAccountId(remaining[0]?.id || null);
      }
    }
  };

  // Open Edit Modal
  const openEditAccountModal = (acc, e) => {
    e?.stopPropagation();
    setIsAccountDropdownOpen(false);
    setEditingAccountId(acc.id);
    setModalAccountName(acc.name || "");
    setModalBotToken(acc.botToken || "");
    setModalBotUsername(acc.username || (acc.botInfo?.username ? `@${acc.botInfo.username}` : ""));
    setModalColor(acc.color || COLOR_PALETTE[0]);
    setVerifiedBotInfo(acc.botInfo || null);
    setVerifyError("");
    setShowTokenPassword(false);
    setIsAccountModalOpen(true);
  };

  // Open Add Modal
  const openAddAccountModal = () => {
    setIsAccountDropdownOpen(false);
    if (accounts.length >= 5) {
      alert("អ្នកអាចភ្ជាប់គណនី Telegram បានអតិបរមាត្រឹមតែ 5 Accounts ប៉ុណ្ណោះ។");
      return;
    }
    setEditingAccountId(null);
    setModalAccountName("");
    setModalBotToken("");
    setModalBotUsername("");
    setModalColor(COLOR_PALETTE[accounts.length % COLOR_PALETTE.length]);
    setVerifiedBotInfo(null);
    setVerifyError("");
    setShowTokenPassword(false);
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccountId(null);
    setModalAccountName("");
    setModalBotToken("");
    setModalBotUsername("");
    setVerifiedBotInfo(null);
    setVerifyError("");
    setShowTokenPassword(false);
  };

  // Real Telegram API: Send Text Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = messageInput.trim();
    if (!text || !activeChat || !activeAccount?.botToken) return;

    setMessageInput("");
    setShowEmojiPicker(false);

    const tempMsgId = `temp_${Date.now()}`;
    const newMsgObj = {
      id: tempMsgId,
      sender: "me",
      senderName: activeAccount.name,
      text: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sending"
    };

    // Optimistically add message
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === activeAccountId) {
          const updatedChats = acc.chats.map((c) => {
            if (c.id === activeChat.id) {
              return {
                ...c,
                messages: [...(c.messages || []), newMsgObj]
              };
            }
            return c;
          });
          return { ...acc, chats: updatedChats };
        }
        return acc;
      })
    );

    try {
      const res = await fetch(`https://api.telegram.org/bot${activeAccount.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: activeChat.id,
          text: text
        })
      });

      const data = await res.json();

      if (data.ok && data.result) {
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === activeAccountId) {
              const updatedChats = acc.chats.map((c) => {
                if (c.id === activeChat.id) {
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === tempMsgId
                        ? {
                            ...m,
                            id: `tg_${data.result.message_id}`,
                            messageId: data.result.message_id,
                            status: "delivered"
                          }
                        : m
                    )
                  };
                }
                return c;
              });
              return { ...acc, chats: updatedChats };
            }
            return acc;
          })
        );
      } else {
        alert(`ផ្ញើសារមិនជោគជ័យ៖ ${data.description || "Telegram API Error"}`);
      }
    } catch (err) {
      console.error("Failed to send telegram message:", err);
      alert("ផ្ញើសារមិនជោគជ័យ៖ មិនអាចភ្ជាប់ទៅកាន់ Telegram Server");
    }
  };

  // Real Telegram API: Send Photo / Audio / Document File Attachment
  const handleSendFileAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !activeAccount?.botToken) return;

    // Reset input value so user can pick same file again if desired
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    const mediaType = isImage ? "photo" : isAudio ? "audio" : isVideo ? "video" : "document";

    const localBlobUrl = URL.createObjectURL(file);
    const tempMsgId = `temp_file_${Date.now()}`;

    const newMsgObj = {
      id: tempMsgId,
      sender: "me",
      senderName: activeAccount.name,
      text: file.name,
      mediaType: mediaType,
      mediaUrl: localBlobUrl,
      mediaFileName: file.name,
      mediaFileSize: file.size,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sending"
    };

    // Optimistically add
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === activeAccountId) {
          const updatedChats = acc.chats.map((c) => {
            if (c.id === activeChat.id) {
              return {
                ...c,
                messages: [...(c.messages || []), newMsgObj]
              };
            }
            return c;
          });
          return { ...acc, chats: updatedChats };
        }
        return acc;
      })
    );

    setIsUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append("chat_id", activeChat.id);

      let apiMethod = "sendDocument";
      if (isImage) {
        apiMethod = "sendPhoto";
        formData.append("photo", file);
      } else if (isAudio) {
        apiMethod = "sendAudio";
        formData.append("audio", file);
      } else if (isVideo) {
        apiMethod = "sendVideo";
        formData.append("video", file);
      } else {
        apiMethod = "sendDocument";
        formData.append("document", file);
      }

      const res = await fetch(`https://api.telegram.org/bot${activeAccount.botToken}/${apiMethod}`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.ok && data.result) {
        // Extract the file_id from the Telegram API response so we can resolve a persistent URL
        const result = data.result;
        let sentFileId = null;
        if (isImage && result.photo?.length > 0) {
          sentFileId = result.photo[result.photo.length - 1].file_id;
        } else if (isAudio && result.audio) {
          sentFileId = result.audio.file_id;
        } else if (isVideo && result.video) {
          sentFileId = result.video.file_id;
        } else if (result.document) {
          sentFileId = result.document.file_id;
        }

        // Resolve the persistent Telegram CDN URL (replaces the transient blob URL)
        let persistentUrl = localBlobUrl;
        if (sentFileId && activeAccount?.botToken) {
          const resolved = await resolveTelegramFileUrl(activeAccount.botToken, sentFileId);
          if (resolved) persistentUrl = resolved;
        }

        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === activeAccountId) {
              const updatedChats = acc.chats.map((c) => {
                if (c.id === activeChat.id) {
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === tempMsgId
                        ? {
                            ...m,
                            id: `tg_${data.result.message_id}`,
                            messageId: data.result.message_id,
                            mediaFileId: sentFileId || m.mediaFileId,
                            mediaUrl: persistentUrl,
                            status: "delivered"
                          }
                        : m
                    )
                  };
                }
                return c;
              });
              return { ...acc, chats: updatedChats };
            }
            return acc;
          })
        );
      } else {
        alert(`ផ្ញើ File មិនជោគជ័យ៖ ${data.description || "Telegram API Error"}`);
      }
    } catch (err) {
      console.error("Failed to upload attachment to telegram:", err);
      alert("ផ្ញើ File មិនជោគជ័យ៖ មិនអាចភ្ជាប់ទៅកាន់ Telegram Server");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Real Telegram API: Create New Chat and Send First Message
  const handleCreateNewChat = async (e) => {
    e.preventDefault();
    const targetChatId = newChatTargetId.trim();
    if (!targetChatId || !activeAccount?.botToken) {
      setNewChatError("សូមបញ្ចូល Telegram Chat ID ឬ Username");
      return;
    }

    setIsSendingNewChat(true);
    setNewChatError("");

    try {
      const initialText =
        newChatInitialMessage.trim() ||
        `សួស្តី! ខ្ញុំកំពុងទាក់ទងមកពីប្រព័ន្ធ System MDM (${activeAccount.name})។`;

      const res = await fetch(`https://api.telegram.org/bot${activeAccount.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: initialText
        })
      });

      const data = await res.json();

      if (data.ok && data.result) {
        const sentChat = data.result.chat;
        const chatIdStr = String(sentChat.id);
        const resolvedName =
          newChatName.trim() ||
          sentChat.title ||
          [sentChat.first_name, sentChat.last_name].filter(Boolean).join(" ") ||
          sentChat.username ||
          `Chat ${chatIdStr}`;

        const newMsgObj = {
          id: `tg_${data.result.message_id}`,
          messageId: data.result.message_id,
          sender: "me",
          senderName: activeAccount.name,
          text: initialText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered"
        };

        const newChatObj = {
          id: chatIdStr,
          name: resolvedName,
          type: newChatType,
          username: sentChat.username ? `@${sentChat.username}` : "",
          unreadCount: 0,
          color: COLOR_PALETTE[(activeAccount.chats?.length || 0) % COLOR_PALETTE.length],
          messages: [newMsgObj]
        };

        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === activeAccountId) {
              const existingIdx = acc.chats.findIndex((c) => String(c.id) === chatIdStr);
              let newChats;
              if (existingIdx >= 0) {
                newChats = acc.chats.map((c, idx) =>
                  idx === existingIdx
                    ? { ...c, messages: [...(c.messages || []), newMsgObj] }
                    : c
                );
              } else {
                newChats = [newChatObj, ...(acc.chats || [])];
              }
              return { ...acc, chats: newChats };
            }
            return acc;
          })
        );

        setActiveChatId(chatIdStr);
        setIsNewChatModalOpen(false);
        setNewChatTargetId("");
        setNewChatName("");
        setNewChatInitialMessage("");
      } else {
        const desc = data.description || "";
        if (desc.includes("bot can't initiate conversation") || desc.includes("Forbidden")) {
          const botUser = activeAccount?.botInfo?.username || activeAccount?.username?.replace("@", "");
          setNewChatError(
            `bot_cant_initiate:${botUser || ""}`
          );
        } else {
          setNewChatError(desc || "មិនអាចផ្ញើសារបានទេ សូមពិនិត្យមើល Chat ID ម្តងទៀត។");
        }
      }
    } catch (err) {
      setNewChatError("បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ Telegram Server");
    } finally {
      setIsSendingNewChat(false);
    }
  };

  // Filter chats by category & search query
  const filteredChats = (activeAccount?.chats || []).filter((chat) => {
    if (filterCategory !== "all" && chat.type !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = chat.name?.toLowerCase().includes(q);
      const matchUser = chat.username?.toLowerCase().includes(q);
      const matchMsg = chat.messages?.some((m) => m.text?.toLowerCase().includes(q));
      return matchName || matchUser || matchMsg;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans select-none min-h-0">
      
      {/* ── TOP BAR: Compact Header with Bot Droplist Selector ── */}
      <div className="h-11 flex-shrink-0 bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between shadow-2xs z-30">
        
        {/* Left: Brand Identity & Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <FaTelegramPlane className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Telegram Messenger
            </span>
            {activeAccount && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online / Active"></span>
            )}
            <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
              ({accounts.length}/5 Bot)
            </span>
          </div>
        </div>

        {/* Right: Bot Account Droplist + Copy Link + Sync */}
        <div className="flex items-center gap-2">
          
          {/* Account Droplist Selector */}
          {accounts.length > 0 ? (
            <div className="relative" ref={accountDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-2xs group"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs"
                  style={{ backgroundColor: activeAccount?.color || "#0284c7" }}
                ></span>
                
                <span className="max-w-[130px] sm:max-w-[170px] truncate text-slate-900 font-black">
                  {activeAccount?.name || "ជ្រើសរើស Bot"}
                </span>

                {activeAccount?.username && (
                  <span className="text-[10px] text-sky-700 bg-sky-100/70 px-1.5 py-0.2 rounded font-mono hidden md:inline">
                    {activeAccount.username}
                  </span>
                )}

                <FaChevronDown className={`text-[9px] text-slate-400 group-hover:text-slate-700 transition-transform ${isAccountDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Droplist Menu Popup */}
              {isAccountDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      គណនី Bot ({accounts.length}/5)
                    </span>
                    <button
                      onClick={openAddAccountModal}
                      disabled={accounts.length >= 5}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer flex items-center gap-1"
                    >
                      <FaPlus className="text-[9px]" />
                      <span>ភ្ជាប់ Bot ថ្មី</span>
                    </button>
                  </div>

                  {/* List of Accounts */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
                    {accounts.map((acc) => {
                      const isCurrent = acc.id === activeAccountId;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            setActiveAccountId(acc.id);
                            setIsAccountDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                            isCurrent
                              ? "bg-sky-50/80 text-sky-950 font-bold border border-sky-200/60"
                              : "hover:bg-slate-50 text-slate-700 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 shadow-2xs"
                              style={{ backgroundColor: acc.color || "#0284c7" }}
                            ></span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-slate-900">{acc.name}</div>
                              {acc.username && (
                                <div className="text-[10px] text-sky-700 font-mono truncate">{acc.username}</div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isCurrent && (
                              <span className="text-[10px] text-sky-600 font-bold bg-white px-1.5 py-0.5 rounded-md border border-sky-200 mr-1 shadow-2xs">
                                ដំណើរការ
                              </span>
                            )}
                            <button
                              title="កែសម្រួលគណនី Bot"
                              onClick={(e) => openEditAccountModal(acc, e)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            <button
                              title="លុបគណនី Bot"
                              onClick={(e) => handleDeleteAccount(acc.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={openAddAccountModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 border border-dashed border-sky-300 hover:bg-sky-100 transition-all cursor-pointer shadow-2xs"
            >
              <FaPlus className="text-[10px]" />
              <span>+ ភ្ជាប់ Telegram Bot</span>
            </button>
          )}

          {/* Copy Bot Link Button */}
          {activeAccount?.username && (
            <button
              onClick={() => {
                const url = `https://t.me/${activeAccount.username.replace("@", "")}`;
                navigator.clipboard.writeText(url);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2500);
              }}
              title="ចម្លង Link Bot ដើម្បីផ្ញើឱ្យ User ចុច START"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 transition-all border border-sky-200 cursor-pointer shadow-2xs"
            >
              <FaExternalLinkAlt className="text-[9px]" />
              <span className="hidden sm:inline">
                {copiedId ? "បាន Copy!" : activeAccount.username}
              </span>
            </button>
          )}

          {/* Sync Button */}
          {activeAccount?.botToken && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="ទាញយកសារថ្មីៗពី Telegram Server"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-2xs"
            >
              <FaSyncAlt className={`text-xs ${isSyncing ? "animate-spin text-sky-600" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN MESSENGER BODY (Split View: Left Chat List | Right Large Chat Window) ── */}
      {accounts.length === 0 ? (
        /* Empty State: Prompt to connect first Telegram account */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-50 to-slate-100 min-h-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center text-3xl mb-3 shadow-xl shadow-sky-500/25">
            <FaTelegramPlane />
          </div>
          <h2 className="text-base font-black text-slate-900 mb-1">
            ភ្ជាប់ Telegram Bot របស់អ្នក (Custom Bot Name & Username)
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mb-4 leading-relaxed">
            ដើម្បីផ្ញើ និងទទួលសារ Telegram ផ្ទាល់ក្នុងប្រព័ន្ធ MDM សូមបញ្ចូល <strong>Bot Token</strong>, <strong>Username</strong>, និង <strong>ឈ្មោះ Bot តាមចិត្តរបស់អ្នក</strong>។ អ្នកអាចភ្ជាប់បានរហូតដល់ <strong>5 Bots</strong> ផ្សេងគ្នា។
          </p>

          <button
            onClick={openAddAccountModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
          >
            <FaPlus />
            <span>+ ភ្ជាប់ Telegram Bot ឥឡូវនេះ</span>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* ── LEFT COLUMN: Chat List & Search (បញ្ជីឆាតនៅខាងឆ្វេង) ── */}
          <div className="w-80 md:w-84 lg:w-92 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xs z-10 min-h-0">
            
            {/* 1. Category Filter Tabs AT THE TOP */}
            <div className="flex items-center justify-between p-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 gap-1 flex-shrink-0">
              {[
                { id: "all", label: "ទាំងអស់" },
                { id: "personal", label: "ឯកជន" },
                { id: "group", label: "ក្រុម" },
                { id: "channel", label: "ប៉ុស្តិ៍" },
                { id: "bot", label: "Bots" }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center whitespace-nowrap cursor-pointer text-[11px] ${
                    filterCategory === cat.id
                      ? "bg-sky-600 text-white shadow-xs font-black"
                      : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 2. Search & New Chat Button */}
            <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
              <div className="flex-1 relative">
                <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="ស្វែងរកសារ ឬឈ្មោះ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                title="ផ្ញើសារទៅកាន់ Telegram Chat ID ថ្មី"
                className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all shadow-xs cursor-pointer flex-shrink-0"
              >
                <FaPlus className="text-xs" />
              </button>
            </div>

            {/* Sync Alert Banner if error */}
            {syncError && (
              <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 text-[10px] text-amber-900 flex items-center gap-1.5 flex-shrink-0">
                <FaExclamationTriangle className="text-amber-600 flex-shrink-0 text-xs" />
                <span className="truncate">{syncError}</span>
              </div>
            )}

            {/* Chats List Feed */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 flex flex-col justify-start min-h-0">
              {filteredChats.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-lg">
                    <MdChatBubbleOutline />
                  </div>
                  <div className="text-xs font-bold text-slate-800 mb-1">
                    មិនទាន់មានការសន្ទនានៅឡើយទេ
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2.5 max-w-[190px] mx-auto">
                    ចុចប៊ូតុង <strong>+</strong> ខាងលើដើម្បីចាប់ផ្តើមឆាត ឬឱ្យ User ចុច Start ក្នុង Bot។
                  </div>
                  <button
                    onClick={() => setIsNewChatModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer"
                  >
                    <FaPlus className="text-[9px]" />
                    <span>+ ចាប់ផ្តើមឆាតថ្មី</span>
                  </button>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const isSelected = chat.id === activeChatId;
                  const lastMsg = chat.messages?.[chat.messages.length - 1];

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        setActiveChatId(chat.id);
                        // Clear unread
                        setAccounts((prev) =>
                          prev.map((acc) => {
                            if (acc.id === activeAccountId) {
                              return {
                                ...acc,
                                chats: acc.chats.map((c) =>
                                  c.id === chat.id ? { ...c, unreadCount: 0 } : c
                                )
                              };
                            }
                            return acc;
                          })
                        );
                      }}
                      className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? "bg-sky-50/90 border-sky-600 shadow-2xs"
                          : "hover:bg-slate-50 border-transparent"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: chat.color || "#0284c7" }}
                      >
                        {chat.type === "group" ? (
                          <FaUsers />
                        ) : chat.type === "channel" ? (
                          <FaBullhorn />
                        ) : chat.type === "bot" ? (
                          <FaRobot />
                        ) : (
                          chat.name?.charAt(0)?.toUpperCase() || <FaUser />
                        )}
                      </div>

                      {/* Chat Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {chat.name}
                          </h4>
                          {lastMsg && (
                            <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                              {lastMsg.time}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500 truncate font-normal">
                            {lastMsg ? (
                              <>
                                {lastMsg.sender === "me" && (
                                  <span className="text-sky-600 font-bold mr-1">អ្នក៖</span>
                                )}
                                {lastMsg.text}
                              </>
                            ) : (
                              <span className="italic text-slate-400">គ្មានសារ</span>
                            )}
                          </p>

                          {chat.unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[9px] font-bold flex-shrink-0">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Large Live Chat Window (ផ្ទាំងឆាតនៅខាងស្តាំ) ── */}
          {activeChat ? (
            <div className="flex-1 flex flex-col h-full bg-[#f1f5f9] relative min-w-0 min-h-0 overflow-hidden">
              
              {/* Active Chat Top Bar */}
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-2xs z-10 flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center text-xs shadow-xs flex-shrink-0"
                    style={{ backgroundColor: activeChat.color || "#0284c7" }}
                  >
                    {activeChat.type === "group" ? (
                      <FaUsers />
                    ) : activeChat.type === "channel" ? (
                      <FaBullhorn />
                    ) : (
                      activeChat.name?.charAt(0)?.toUpperCase() || <FaUser />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">{activeChat.name}</h3>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase flex-shrink-0">
                        {activeChat.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.2 truncate">
                      <span>Chat ID:</span>
                      <code className="text-sky-700 font-bold bg-sky-50 px-1 py-0.2 rounded font-mono">{activeChat.id}</code>
                      {activeChat.username && <span>• {activeChat.username}</span>}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setShowChatInfo(!showChatInfo)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    title="ព័ត៌មានលម្អិត Chat"
                  >
                    <FaInfoCircle className="text-sm" />
                  </button>
                </div>
              </div>

              {/* Messages Feed (Supports Voice Notes, Photos, Audios, Documents, Videos) */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2.5 bg-[#e5ebee]/40 min-h-0 flex flex-col justify-start">
                {activeChat.messages?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-white text-sky-500 flex items-center justify-center shadow-sm mb-2.5 text-xl">
                      <FaTelegramPlane />
                    </div>
                    <div className="text-xs font-bold text-slate-800">ចាប់ផ្តើមការសន្ទនាផ្ទាល់</div>
                    <div className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                      សារទាំងអស់ត្រូវបានផ្ញើ និងទទួលផ្ទាល់ពី Telegram របស់ភាគីម្ខាងទៀត។
                    </div>
                  </div>
                ) : (
                  activeChat.messages?.map((msg) => {
                    const isMe = msg.sender === "me";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {!isMe && (
                          <span className="text-[10px] font-bold text-slate-600 mb-0.5 ml-2">
                            {msg.senderName || activeChat.name}
                          </span>
                        )}

                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-2.5 text-xs shadow-xs leading-relaxed relative ${
                            isMe
                              ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-tr-xs"
                              : "bg-white text-slate-900 rounded-tl-xs border border-slate-200/80"
                          }`}
                        >
                          {/* 1. PHOTO MESSAGE */}
                          {msg.mediaType === "photo" && (
                            <div className="mb-1.5 rounded-xl overflow-hidden max-w-sm">
                              {msg.mediaUrl ? (
                                <img
                                  src={msg.mediaUrl}
                                  alt="Telegram Photo"
                                  onClick={() => setPreviewImage(msg.mediaUrl)}
                                  className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity bg-slate-900/10"
                                />
                              ) : (
                                <div className="p-4 bg-slate-100 text-slate-600 text-center rounded-xl flex items-center justify-center gap-2">
                                  <FaImage className="text-base" />
                                  <span>កំពុងទាញយករូបភាព...</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. VOICE NOTE MESSAGE */}
                          {msg.mediaType === "voice" && (
                            <div className="mb-1">
                              {msg.mediaUrl ? (
                                <VoiceNotePlayer
                                  audioUrl={msg.mediaUrl}
                                  duration={msg.mediaDuration}
                                  isMe={isMe}
                                />
                              ) : (
                                <div className="p-2 text-center text-xs opacity-75">
                                  🎤 សារសម្លេង (Voice Note)
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. AUDIO TRACK MESSAGE */}
                          {msg.mediaType === "audio" && (
                            <div className="mb-1.5 p-2 rounded-xl bg-black/5 flex flex-col gap-1.5 max-w-xs">
                              <div className="flex items-center gap-2">
                                <FaMusic className="text-sky-500 text-sm flex-shrink-0" />
                                <span className="text-xs font-bold truncate">
                                  {msg.mediaFileName || "Audio Track"}
                                </span>
                              </div>
                              {msg.mediaUrl && (
                                <audio controls src={msg.mediaUrl} className="w-full h-8" />
                              )}
                            </div>
                          )}

                          {/* 4. VIDEO MESSAGE */}
                          {msg.mediaType === "video" && (
                            <div className="mb-1.5 rounded-xl overflow-hidden max-w-sm">
                              {msg.mediaUrl ? (
                                <video
                                  controls
                                  src={msg.mediaUrl}
                                  className="w-full max-h-72 rounded-xl bg-black"
                                />
                              ) : (
                                <div className="p-4 bg-slate-100 text-slate-600 text-center rounded-xl flex items-center justify-center gap-2">
                                  <FaVideo className="text-base" />
                                  <span>កំពុងទាញយកវីដេអូ...</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 5. DOCUMENT / FILE MESSAGE */}
                          {msg.mediaType === "document" && (
                            <div className={`p-2.5 rounded-xl mb-1.5 flex items-center justify-between gap-3 ${isMe ? "bg-white/15" : "bg-slate-50 border border-slate-200"}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? "bg-white text-sky-600" : "bg-sky-100 text-sky-700"}`}>
                                  <FaFileAlt className="text-sm" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{msg.mediaFileName || "File"}</div>
                                  <div className={`text-[10px] ${isMe ? "text-sky-100" : "text-slate-500"}`}>
                                    {formatFileSize(msg.mediaFileSize)}
                                  </div>
                                </div>
                              </div>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  download={msg.mediaFileName || "file"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-lg transition-colors cursor-pointer ${isMe ? "bg-white text-sky-600 hover:bg-sky-50" : "bg-sky-600 text-white hover:bg-sky-700"}`}
                                  title="ទាញយកឯកសារ"
                                >
                                  <FaDownload className="text-xs" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* TEXT CONTENT */}
                          {msg.text && (
                            <p className="whitespace-pre-wrap break-words px-1">{msg.text}</p>
                          )}

                          {/* TIMESTAMP & STATUS */}
                          <div
                            className={`flex items-center justify-end gap-1.5 mt-1 px-1 text-[9px] font-medium ${
                              isMe ? "text-sky-100" : "text-slate-400"
                            }`}
                          >
                            <span>{msg.time}</span>
                            {isMe && (
                              <span>
                                {msg.status === "sending" ? (
                                  "..."
                                ) : msg.status === "error" ? (
                                  "⚠️"
                                ) : (
                                  <FaCheckDouble className="inline text-[9px]" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Emoji Picker Popup */}
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-4 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl z-30 w-72 grid grid-cols-6 gap-2">
                  {POPULAR_EMOJIS.map((em, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMessageInput((prev) => prev + em);
                        setShowEmojiPicker(false);
                      }}
                      className="text-xl p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-center cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Hidden File Input for Attachments */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleSendFileAttachment}
                className="hidden"
                accept="image/*,audio/*,video/*,application/*,text/*"
              />

              {/* Bottom Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="bg-white border-t border-slate-200 p-2.5 flex items-center gap-1.5 shadow-xs flex-shrink-0"
              >
                {/* Emoji Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                  title="Emoji"
                >
                  <FaSmile className="text-lg" />
                </button>

                {/* Attachment Button (Send Photo/Audio/File) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                  title="ភ្ជាប់រូបភាព ឬឯកសារ (Attach File/Photo/Audio)"
                >
                  <MdAttachFile className="text-xl transform rotate-45" />
                </button>

                <input
                  type="text"
                  placeholder={`ផ្ញើសារ Telegram ទៅកាន់ ${activeChat.name}...`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-medium"
                />

                <button
                  type="submit"
                  disabled={!messageInput.trim() || isUploadingFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs md:text-sm font-bold rounded-lg transition-all shadow-md shadow-sky-600/20 cursor-pointer flex-shrink-0"
                >
                  <MdOutlineSend className="text-base" />
                  <span className="hidden sm:inline">ផ្ញើ</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-500 p-6 min-h-0">
              <div className="w-14 h-14 rounded-2xl bg-white text-sky-500 flex items-center justify-center text-3xl shadow-sm mb-2.5">
                <FaTelegramPlane />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">សូមជ្រើសរើសការសន្ទនា</h3>
              <p className="text-xs text-slate-500">
                ជ្រើសរើស Chat ពីបញ្ជីខាងឆ្វេង ឬបង្កើត Chat ថ្មីដើម្បីចាប់ផ្តើមឆាត។
              </p>
            </div>
          )}

          {/* ── RIGHT COLUMN: Chat & Account Information Drawer ── */}
          {showChatInfo && activeChat && (
            <div className="w-72 bg-white border-l border-slate-200 p-4 flex flex-col justify-between overflow-y-auto shadow-2xs z-20">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h4 className="text-xs font-bold text-slate-900">ព័ត៌មាន Chat</h4>
                  <button
                    onClick={() => setShowChatInfo(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>

                <div className="text-center mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl text-white font-bold flex items-center justify-center text-lg mx-auto shadow-xs mb-2"
                    style={{ backgroundColor: activeChat.color || "#0284c7" }}
                  >
                    {activeChat.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <h3 className="text-xs font-black text-slate-900">{activeChat.name}</h3>
                  {activeChat.username && (
                    <div className="text-[11px] text-sky-700 font-mono mt-0.5">
                      {activeChat.username}
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Telegram Chat ID:</span>
                    <span className="font-mono text-slate-900 select-all font-bold text-[11px]">
                      {activeChat.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">ប្រភេទ Chat:</span>
                    <span className="text-slate-900 font-bold uppercase text-[10px] bg-slate-200/70 px-1.5 py-0.5 rounded">
                      {activeChat.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">ចំនួនសារសរុប:</span>
                    <span className="text-slate-900 font-bold">
                      {activeChat.messages?.length || 0} សារ
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm("តើលោកអ្នកចង់សម្អាតសារក្នុង Chat នេះមែនទេ?")) {
                    setAccounts((prev) =>
                      prev.map((acc) => {
                        if (acc.id === activeAccountId) {
                          return {
                            ...acc,
                            chats: acc.chats.map((c) =>
                              c.id === activeChat.id ? { ...c, messages: [] } : c
                            )
                          };
                        }
                        return acc;
                      })
                    );
                  }
                }}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FaTrash className="text-[11px]" />
                <span>សម្អាតប្រវត្តិសារ</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FULLSCREEN IMAGE LIGHTBOX / PREVIEW MODAL ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
          >
            <div className="absolute -top-10 right-0 flex items-center gap-3">
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                download="telegram_photo.jpg"
                className="text-white hover:text-sky-300 p-2 text-base transition-colors flex items-center gap-1.5 bg-white/10 rounded-lg backdrop-blur-md"
              >
                <FaDownload className="text-xs" />
                <span className="text-xs font-bold">ទាញយក</span>
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-white hover:text-rose-400 p-2 text-lg transition-colors bg-white/10 rounded-lg backdrop-blur-md cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/20"
            />
          </div>
        </div>
      )}

      {/* ── MODAL: Connect / Edit Telegram Bot ── */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <FaTelegramPlane className="text-sm" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">
                    {editingAccountId ? "កែសម្រួលគណនី Bot" : "ភ្ជាប់ Telegram Bot ថ្មី"}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    កំណត់ Token, Username, និងឈ្មោះ Bot តាមចិត្ត
                  </p>
                </div>
              </div>
              <button
                onClick={closeAccountModal}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-3.5">
              
              {/* 1. Bot Token Input */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  1. Telegram Bot API Token <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showTokenPassword ? "text" : "password"}
                      placeholder="ឧ. 7123456789:AAHKlQp9..."
                      value={modalBotToken}
                      onChange={(e) => setModalBotToken(e.target.value)}
                      required
                      className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokenPassword(!showTokenPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showTokenPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifyToken()}
                    disabled={verifyingToken || !modalBotToken.trim()}
                    className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-xs rounded-lg transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <FaSyncAlt className={`text-[10px] ${verifyingToken ? "animate-spin text-sky-600" : ""}`} />
                    <span>{verifyingToken ? "កំពុងពិនិត្យ..." : "ពិនិត្យ Token"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  យក Token ពី <strong>@BotFather</strong> ក្នុង Telegram
                </p>
              </div>

              {/* Verified Result Banner */}
              {verifiedBotInfo && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                  <FaCheck className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-black text-emerald-900">បានផ្ទៀងផ្ទាត់ដោយជោគជ័យ!</div>
                    <div className="text-[11px] text-emerald-800">
                      Bot: <strong>{verifiedBotInfo.first_name}</strong> • Username: @{verifiedBotInfo.username}
                    </div>
                  </div>
                </div>
              )}

              {/* Verify Error Banner */}
              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
                  <FaExclamationTriangle className="text-rose-600 flex-shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* 2. Bot Username Input */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  2. Bot Username
                </label>
                <input
                  type="text"
                  placeholder="ឧ. @my_mdm_system_bot"
                  value={modalBotUsername}
                  onChange={(e) => setModalBotUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              {/* 3. Custom Bot Name / Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  3. ឈ្មោះ Bot ដោយខ្លួនឯង (Custom Bot Display Name) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ឧ. Bot ជំនួយការលក់, MDM System Bot, Bot សាខាទី១..."
                  value={modalAccountName}
                  onChange={(e) => setModalAccountName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                />
              </div>

              {/* Color Badge Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  ពណ៌សម្គាល់ (Color Badge)
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((color, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setModalColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer shadow-xs ${
                        modalColor === color ? "scale-125 ring-2 ring-slate-900" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={verifyingToken}
                  className="px-5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-sky-600/25 cursor-pointer"
                >
                  {editingAccountId ? "រក្សាទុកការកែប្រែ" : "រក្សាទុក & ភ្ជាប់ Bot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Send Message to New Telegram Chat ID ── */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaPaperPlane className="text-sky-600 text-sm" />
                <h3 className="text-xs font-black text-slate-900">
                  ចាប់ផ្តើមឆាតទៅកាន់ Telegram ថ្មី
                </h3>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateNewChat} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Telegram Chat ID ឬ Username <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ឧ. 123456789 ឬ -100123456789 ឬ @username"
                  value={newChatTargetId}
                  onChange={(e) => setNewChatTargetId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  ឈ្មោះសម្គាល់ (Optional)
                </label>
                <input
                  type="text"
                  placeholder="ឧ. អតិថិជន សុខ ចាន់ណា"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  ប្រភេទ Chat
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "personal", label: "ឯកជន", icon: FaUser },
                    { id: "group", label: "ក្រុម", icon: FaUsers },
                    { id: "channel", label: "ប៉ុស្តិ៍", icon: FaBullhorn }
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewChatType(t.id)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          newChatType === t.id
                            ? "bg-sky-50 border-sky-400 text-sky-700 shadow-xs"
                            : "border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <Icon className="text-xs" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  សារដំបូង
                </label>
                <textarea
                  rows={2}
                  placeholder="បញ្ចូលសារដើម្បីចាប់ផ្តើមការសន្ទនា..."
                  value={newChatInitialMessage}
                  onChange={(e) => setNewChatInitialMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium resize-none"
                />
              </div>

              {newChatError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                  {newChatError.startsWith("bot_cant_initiate") ? (
                    <div>
                      <strong>មិនអាចចាប់ផ្តើមឆាតមុនបានទេ៖</strong>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Telegram Bot មិនអាចផ្ញើសារទៅកាន់ User មុនបានទេ លុះត្រាតែ User នោះបានចុច <strong>START</strong> ក្នុង Bot ជាមុនសិន។
                      </p>
                      {activeAccount?.username && (
                        <div className="mt-2">
                          <a
                            href={`https://t.me/${activeAccount.username.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-700 font-bold underline text-[11px]"
                          >
                            <span>ផ្ញើ Link នេះឱ្យគាត់ចុច Start: t.me/{activeAccount.username.replace("@", "")}</span>
                            <FaExternalLinkAlt className="text-[9px]" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span>{newChatError}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSendingNewChat}
                  className="px-4 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-sky-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FaPaperPlane className="text-[10px]" />
                  <span>{isSendingNewChat ? "កំពុងផ្ញើ..." : "ចាប់ផ្តើមឆាត"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TelegramPage;
