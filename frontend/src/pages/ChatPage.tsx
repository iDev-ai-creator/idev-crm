import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { chatApi, type ChatChannel, type ChatMessage, type ChatUser } from '../api/chat'
import { aiApi, type SentimentResult } from '../api/ai'
import { useChatSocket } from '../hooks/useChatSocket'
import EmojiPicker from '../components/chat/EmojiPicker'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

/** Render message text with `@handle` tokens highlighted. */
function renderWithMentions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const re = /@([A-Za-z0-9_.\-]+)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push(
      <span
        key={`m-${i++}`}
        className="bg-[var(--accent)]/20 text-[var(--accent)] rounded px-0.5 font-medium"
      >
        @{m[1]}
      </span>,
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface AttachmentBubbleProps {
  url: string
  name: string
  size: number
  mime: string
  onOpenImage: (url: string) => void
}

function AttachmentBubble({ url, name, size, mime, onOpenImage }: AttachmentBubbleProps) {
  if (isImageMime(mime)) {
    return (
      <button
        type="button"
        onClick={() => onOpenImage(url)}
        className="block rounded-xl overflow-hidden max-w-[260px] max-h-[260px] bg-[var(--bg-hover)] hover:opacity-95 transition-opacity"
      >
        <img src={url} alt={name} className="block w-full h-full object-cover" loading="lazy" />
      </button>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-main)] transition-colors min-w-[200px] max-w-[300px]"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-medium text-[var(--text)] truncate">{name}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{formatFileSize(size)}</div>
      </div>
    </a>
  )
}

interface CtxMenu {
  x: number
  y: number
  msg: ChatMessage
}

export default function ChatPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set())
  const [pinnedIdx, setPinnedIdx] = useState(0)
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null)
  const [sentimentLoading, setSentimentLoading] = useState(false)

  // Reset sentiment when switching channel
  useEffect(() => {
    setSentiment(null)
  }, [activeChannelId])

  const runSentiment = async () => {
    if (!activeChannelId) return
    setSentimentLoading(true)
    try {
      const r = await aiApi.chatSentiment(activeChannelId)
      setSentiment(r)
    } finally {
      setSentimentLoading(false)
    }
  }

  useEffect(() => {
    chatApi.channels.list().then((list) => {
      setChannels(list)
      if (list.length > 0) {
        setActiveChannelId((current) => current ?? list[0].id)
      }
    }).finally(() => setLoadingChannels(false))
  }, [])

  useEffect(() => {
    if (!activeChannelId) return
    setLoadingMessages(true)
    setMessages([])
    chatApi.messages.list(activeChannelId).then(setMessages).finally(() => setLoadingMessages(false))
  }, [activeChannelId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.channel === activeChannelId) {
      setMessages((prev) => [...prev, msg])
    }
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === msg.channel
          ? { ...ch, last_message: { text: msg.text, author: msg.author?.full_name ?? '', created_at: msg.created_at } }
          : ch
      )
    )
  }, [activeChannelId])

  const handleReaction = useCallback(() => {
    if (activeChannelId) chatApi.messages.list(activeChannelId).then(setMessages)
  }, [activeChannelId])

  const { connected, sendMessage, sendReaction } = useChatSocket({
    channelId: activeChannelId,
    onMessage: handleNewMessage,
    onReaction: handleReaction,
  })

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeChannelId) return
    if (pendingFile) {
      setUploading(true)
      try {
        await chatApi.messages.sendWithAttachment(
          activeChannelId,
          input.trim(),
          pendingFile,
          replyTo?.id,
        )
        // Message will arrive via WS; clear state
        setPendingFile(null)
        if (pendingPreview) URL.revokeObjectURL(pendingPreview)
        setPendingPreview(null)
        setInput('')
        setReplyTo(null)
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      return
    }
    if (!input.trim()) return
    sendMessage(input.trim(), replyTo?.id)
    setInput('')
    setReplyTo(null)
  }

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    if (file.type.startsWith('image/')) {
      setPendingPreview(URL.createObjectURL(file))
    } else {
      setPendingPreview(null)
    }
  }

  const clearPendingFile = () => {
    setPendingFile(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji)
  }

  // @mention autocomplete — scans the last "@token" before the caret
  const [mentionState, setMentionState] = useState<{ query: string; start: number } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeChannel = channels.find((c) => c.id === activeChannelId)
  const mentionCandidates = (activeChannel?.members ?? []).filter((m) => {
    if (!mentionState) return false
    const q = mentionState.query.toLowerCase()
    return (
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.email || '').split('@')[0].toLowerCase().includes(q)
    )
  }).slice(0, 5)

  const updateMentionState = (value: string, caret: number) => {
    // Find the nearest "@" before the caret that still has no space between it and the caret
    const before = value.slice(0, caret)
    const atIdx = before.lastIndexOf('@')
    if (atIdx === -1) { setMentionState(null); return }
    const segment = before.slice(atIdx + 1)
    if (/\s/.test(segment) || segment.length > 30) { setMentionState(null); return }
    // '@' must be at start or after whitespace
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) { setMentionState(null); return }
    setMentionState({ query: segment, start: atIdx })
    setMentionIdx(0)
  }

  const pickMention = (user: ChatUser) => {
    if (!mentionState) return
    const handle = (user.email || '').split('@')[0] || user.full_name.split(' ')[0]
    const before = input.slice(0, mentionState.start)
    const after = input.slice(inputRef.current?.selectionStart ?? input.length)
    const next = `${before}@${handle} ${after}`
    setInput(next)
    setMentionState(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault()
    // Ensure menu stays within viewport
    const menuW = 200, menuH = 280
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
    setCtxMenu({ x, y, msg })
  }

  const ctxReply = () => {
    if (!ctxMenu) return
    setReplyTo(ctxMenu.msg)
    setCtxMenu(null)
  }

  const ctxForward = () => {
    if (!ctxMenu) return
    setForwardMsg(ctxMenu.msg)
    setCtxMenu(null)
  }

  const ctxPin = () => {
    if (!ctxMenu) return
    const id = ctxMenu.msg.id
    setPinnedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    chatApi.messages.pin(id).catch(() => {})
    setCtxMenu(null)
  }

  const ctxCopy = () => {
    if (!ctxMenu) return
    navigator.clipboard.writeText(ctxMenu.msg.text).catch(() => {})
    setCtxMenu(null)
  }

  const ctxReact = (emoji: string) => {
    if (!ctxMenu) return
    sendReaction(ctxMenu.msg.id, emoji)
    setCtxMenu(null)
  }

  const handleForward = (targetChannelId: number) => {
    if (!forwardMsg) return
    setInput(`↪ ${forwardMsg.author?.full_name ?? 'Someone'}: ${forwardMsg.text}`)
    if (targetChannelId !== activeChannelId) setActiveChannelId(targetChannelId)
    chatApi.messages.forward(forwardMsg.id, targetChannelId).catch(() => {})
    setForwardMsg(null)
  }

  const scrollToPinned = useCallback(() => {
    const arr = Array.from(pinnedIds)
    if (arr.length === 0) return
    const idx = pinnedIdx % arr.length
    const id = arr[idx]
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('msg-highlight')
      void el.offsetWidth
      el.classList.add('msg-highlight')
    }
    setPinnedIdx((i) => (i + 1) % arr.length)
  }, [pinnedIds, pinnedIdx])

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] rounded-[var(--radius-xl)] border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">

      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--border)] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">{t('nav.chat')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChannels ? (
            <div className="p-4 text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-xs text-[var(--text-secondary)]">{t('chat.noChannels')}</div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannelId(ch.id)}
                className={`w-full text-left px-4 py-3 transition-colors border-b border-[var(--border)]/50
                  ${activeChannelId === ch.id ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'}`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                    ${ch.channel_type === 'direct' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                    {ch.channel_type === 'direct'
                      ? (ch.members.find((m) => m.id !== user?.id)?.full_name?.[0] ?? '?')
                      : ch.name?.[0] ?? '#'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text)] truncate">
                      {ch.channel_type === 'direct'
                        ? ch.members.find((m) => m.id !== user?.id)?.full_name || 'Direct'
                        : ch.name || `Group #${ch.id}`}
                    </div>
                    {ch.last_message && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">{ch.last_message.text}</div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {activeChannelId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-sm font-semibold text-[var(--accent)]">
              {activeChannel?.channel_type === 'direct'
                ? activeChannel.members.find((m) => m.id !== user?.id)?.full_name?.[0] ?? '?'
                : activeChannel?.name?.[0] ?? '#'}
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {activeChannel?.channel_type === 'direct'
                  ? activeChannel.members.find((m) => m.id !== user?.id)?.full_name
                  : activeChannel?.name}
              </div>
              <div className={`text-xs ${connected ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                {connected ? t('chat.online') : t('chat.connecting')}
              </div>
            </div>
            <button
              onClick={runSentiment}
              disabled={sentimentLoading}
              className="ml-2 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 transition-opacity"
              title="AI анализ тональности переписки"
            >
              {sentimentLoading ? '...' : 'AI sentiment'}
            </button>
            {/* Pinned banner */}
            {pinnedIds.size > 0 && (() => {
              const arr = Array.from(pinnedIds)
              const currentId = arr[pinnedIdx % arr.length]
              const currentMsg = messages.find((m) => m.id === currentId)
              return (
                <button
                  type="button"
                  onClick={scrollToPinned}
                  className="ml-auto flex items-center gap-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-full px-3 py-1.5 transition-colors text-left min-w-0 max-w-xs"
                >
                  <span className="text-xs shrink-0">📌</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--accent)]">
                      {t('chat.pinned')}{arr.length > 1 ? ` (${pinnedIdx % arr.length + 1}/${arr.length})` : ''}
                    </div>
                    {currentMsg && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">{currentMsg.text}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPinnedIds(new Set()); setPinnedIdx(0) }}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] shrink-0 ml-1"
                  >✕</button>
                </button>
              )
            })()}
          </div>

          {/* Sentiment banner */}
          {sentiment && (
            <div className={`px-4 py-3 border-b border-[var(--border)] ${
              sentiment.sentiment === 'negative' || sentiment.sentiment === 'at_risk'
                ? 'bg-red-500/10'
                : sentiment.sentiment === 'positive'
                ? 'bg-green-500/10'
                : sentiment.sentiment === 'mixed'
                ? 'bg-orange-500/10'
                : 'bg-[var(--bg-hover)]'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">
                  {sentiment.sentiment === 'positive' && '😊'}
                  {sentiment.sentiment === 'neutral' && '😐'}
                  {sentiment.sentiment === 'mixed' && '😕'}
                  {sentiment.sentiment === 'negative' && '😟'}
                  {sentiment.sentiment === 'at_risk' && '🚨'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Sentiment: {sentiment.sentiment} · score {sentiment.score}
                  </div>
                  {sentiment.reason && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sentiment.reason}</p>}
                  {sentiment.signals && sentiment.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {sentiment.signals.slice(0, 5).map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]">"{s.slice(0, 60)}"</span>
                      ))}
                    </div>
                  )}
                  {sentiment.recommended_action && (
                    <p className="text-xs text-[var(--accent)] mt-1.5"><b>Action:</b> {sentiment.recommended_action}</p>
                  )}
                </div>
                <button onClick={() => setSentiment(null)} className="text-[var(--text-secondary)] hover:text-[var(--danger)] shrink-0" title="Закрыть">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {loadingMessages ? (
              <div className="text-xs text-[var(--text-secondary)] text-center py-8">{t('common.loading')}</div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-center text-[var(--text-secondary)] py-12">
                <div className="text-3xl mb-2">💬</div>
                {t('chat.noMessagesHint')}
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.author?.id === user?.id
                const prevMsg = messages[idx - 1]
                const sameAuthor = prevMsg && prevMsg.author?.id === msg.author?.id
                const isPinned = pinnedIds.has(msg.id)

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${sameAuthor ? 'mt-0.5' : 'mt-3'}`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                  >
                    {/* Avatar — show only for first in a group */}
                    <div className="w-8 shrink-0">
                      {!sameAuthor && !isOwn && (
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                          {msg.author?.full_name?.[0] ?? '?'}
                        </div>
                      )}
                    </div>

                    <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                      {/* Sender name */}
                      {!sameAuthor && !isOwn && (
                        <span className="text-xs font-semibold text-[var(--accent)] px-1">{msg.author?.full_name}</span>
                      )}

                      {/* Reply preview */}
                      {msg.reply_to_preview && (
                        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-lg px-2.5 py-1.5 border-l-2 border-[var(--accent)] max-w-full">
                          <span className="font-medium">{msg.reply_to_preview.author}</span>
                          <p className="truncate opacity-80">{msg.reply_to_preview.text}</p>
                        </div>
                      )}

                      {/* Attachment (if image → previewed above bubble) */}
                      {msg.attachment_url && isImageMime(msg.attachment_mime) && (
                        <AttachmentBubble
                          url={msg.attachment_url}
                          name={msg.attachment_name}
                          size={msg.attachment_size}
                          mime={msg.attachment_mime}
                          onOpenImage={setLightbox}
                        />
                      )}

                      {/* Bubble — render only if there's text OR a non-image attachment */}
                      {(msg.text || (msg.attachment_url && !isImageMime(msg.attachment_mime))) && (
                      <div className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed
                        ${isOwn ? 'bg-[var(--accent)] text-white rounded-tr-sm' : 'bg-[var(--bg-hover)] text-[var(--text)] rounded-tl-sm'}
                        ${isPinned ? 'ring-1 ring-[var(--accent)]/40' : ''}`}>
                        {isPinned && <span className="absolute -top-1.5 -right-1 text-xs">📌</span>}
                        {msg.attachment_url && !isImageMime(msg.attachment_mime) && (
                          <div className="mb-1.5">
                            <AttachmentBubble
                              url={msg.attachment_url}
                              name={msg.attachment_name}
                              size={msg.attachment_size}
                              mime={msg.attachment_mime}
                              onOpenImage={setLightbox}
                            />
                          </div>
                        )}
                        {msg.text && <p className="whitespace-pre-wrap break-words">{renderWithMentions(msg.text)}</p>}
                        <span className={`text-[10px] mt-0.5 float-right ml-3 ${isOwn ? 'text-white/60' : 'text-[var(--text-secondary)]'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      )}

                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                          ).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={() => sendReaction(msg.id, emoji)}
                              className="text-xs bg-[var(--bg-hover)] border border-[var(--border)] rounded-full px-1.5 py-0.5 hover:border-[var(--accent)] transition-colors"
                            >
                              {emoji} {count}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply strip */}
          {replyTo && (
            <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--bg-hover)]">
              <div className="w-0.5 h-8 bg-[var(--accent)] rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--accent)]">{replyTo.author?.full_name}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{replyTo.text}</div>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-[var(--text-secondary)] hover:text-[var(--danger)] p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Pending attachment preview */}
          {pendingFile && (
            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-hover)] flex items-center gap-3">
              {pendingPreview ? (
                <img src={pendingPreview} alt={pendingFile.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text)] truncate">{pendingFile.name}</div>
                <div className="text-xs text-[var(--text-secondary)]">{formatFileSize(pendingFile.size)}</div>
              </div>
              <button
                type="button"
                onClick={clearPendingFile}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                title={t('common.cancel')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="px-4 py-3 border-t border-[var(--border)] flex gap-2 items-end relative">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handlePickFile}
            />

            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              title={t('chat.attach')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {/* Emoji button */}
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              title={t('chat.emoji')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>

            <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={insertEmoji} />

            {/* Mention autocomplete */}
            {mentionState && mentionCandidates.length > 0 && (
              <div className="absolute bottom-14 left-24 z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl w-64 overflow-hidden">
                {mentionCandidates.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickMention(u) }}
                    onMouseEnter={() => setMentionIdx(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                      i === mentionIdx ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                      {(u.full_name || u.email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[var(--text)] truncate">{u.full_name || u.email}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">@{(u.email || '').split('@')[0]}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length)
              }}
              onKeyDown={(e) => {
                if (mentionState && mentionCandidates.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionCandidates.length); return }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    pickMention(mentionCandidates[mentionIdx])
                    return
                  }
                  if (e.key === 'Escape') { setMentionState(null); return }
                }
              }}
              onSelect={(e) => {
                const t = e.currentTarget
                updateMentionState(t.value, t.selectionStart ?? t.value.length)
              }}
              placeholder={t('chat.writePlaceholder')}
              className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-4 py-2.5 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingFile) || uploading}
              className="bg-[var(--accent)] text-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-30">💬</div>
            <div className="text-sm text-[var(--text-secondary)]">{t('chat.pickChannelToStart')}</div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] py-1 w-52 overflow-hidden"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {/* Quick reactions row */}
          <div className="flex items-center justify-around px-3 py-2 border-b border-[var(--border)]">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => ctxReact(emoji)}
                className="text-lg hover:scale-125 transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Actions */}
          {[
            { icon: '↩', label: t('chat.reply'), action: ctxReply },
            { icon: '⤴', label: t('chat.forward'), action: ctxForward },
            { icon: '📌', label: pinnedIds.has(ctxMenu.msg.id) ? t('chat.unpin') : t('chat.pin'), action: ctxPin },
            { icon: '📋', label: t('chat.copy'), action: ctxCopy },
          ].map(({ icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setForwardMsg(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-3">{t('chat.forwardTitle')}</h3>
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-xl p-2 mb-4 line-clamp-3">{forwardMsg.text}</div>
            <p className="text-xs text-[var(--text-secondary)] mb-2">{t('chat.pickChannel')}</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleForward(ch.id)}
                  className="w-full text-left text-sm px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text)] transition-colors flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
                    {ch.channel_type === 'direct'
                      ? ch.members.find((m) => m.id !== user?.id)?.full_name?.[0] ?? '?'
                      : ch.name?.[0] ?? '#'}
                  </div>
                  <span>{ch.channel_type === 'direct'
                    ? ch.members.find((m) => m.id !== user?.id)?.full_name || 'Direct'
                    : ch.name || `Group #${ch.id}`}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setForwardMsg(null)} className="mt-3 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] w-full text-center">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
