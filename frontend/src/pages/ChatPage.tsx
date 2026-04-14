import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { chatApi, type ChatChannel, type ChatMessage } from '../api/chat'
import { useChatSocket } from '../hooks/useChatSocket'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥']

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load channels
  useEffect(() => {
    chatApi.channels.list().then(setChannels).finally(() => setLoadingChannels(false))
  }, [])

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return
    setLoadingMessages(true)
    setMessages([])
    chatApi.messages.list(activeChannelId).then(setMessages).finally(() => setLoadingMessages(false))
  }, [activeChannelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.channel === activeChannelId) {
      setMessages((prev) => [...prev, msg])
    }
    // Update last_message in channels list
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === msg.channel
          ? {
              ...ch,
              last_message: {
                text: msg.text,
                author: msg.author?.full_name ?? '',
                created_at: msg.created_at,
              },
            }
          : ch
      )
    )
  }, [activeChannelId])

  const handleReaction = useCallback(() => {
    // Refetch messages to get updated reactions
    if (activeChannelId) chatApi.messages.list(activeChannelId).then(setMessages)
  }, [activeChannelId])

  const { connected, sendMessage, sendReaction } = useChatSocket({
    channelId: activeChannelId,
    onMessage: handleNewMessage,
    onReaction: handleReaction,
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input.trim(), replyTo?.id)
    setInput('')
    setReplyTo(null)
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] rounded-[var(--radius-xl)] border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
      {/* Sidebar — channels list */}
      <div className="w-64 border-r border-[var(--border)] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)]">{t('nav.chat')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChannels ? (
            <div className="p-4 text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-xs text-[var(--text-secondary)]">No channels yet</div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannelId(ch.id)}
                className={`w-full text-left px-4 py-3 transition-colors border-b border-[var(--border)]/50
                  ${activeChannelId === ch.id ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ch.channel_type === 'direct' ? '👤' : '👥'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text)] truncate">
                      {ch.channel_type === 'direct'
                        ? ch.members.find((m) => m.id !== user?.id)?.full_name || ch.name || 'Direct'
                        : ch.name || `Group #${ch.id}`}
                    </div>
                    {ch.last_message && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {ch.last_message.text}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages area */}
      {activeChannelId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {activeChannel?.channel_type === 'direct'
                  ? activeChannel.members.find((m) => m.id !== user?.id)?.full_name
                  : activeChannel?.name}
              </div>
              <div
                className={`text-xs ${connected ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}
              >
                {connected ? 'Connected' : 'Reconnecting...'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-center text-[var(--text-secondary)] py-8">
                No messages yet — say hi!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.author?.id === user?.id
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} group`}>
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
                      {msg.author?.full_name?.[0] ?? '?'}
                    </div>
                    <div
                      className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}
                    >
                      {msg.reply_to_preview && (
                        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded px-2 py-1 border-l-2 border-[var(--accent)]">
                          ↩ {msg.reply_to_preview.author}: {msg.reply_to_preview.text}
                        </div>
                      )}
                      <div
                        className={`rounded-[var(--radius-lg)] px-3 py-2 text-sm
                          ${isOwn ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-hover)] text-[var(--text)]'}`}
                      >
                        {!isOwn && (
                          <div className="text-xs font-semibold mb-0.5 opacity-70">
                            {msg.author?.full_name}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div
                          className={`text-xs mt-0.5 ${isOwn ? 'text-white/60' : 'text-[var(--text-secondary)]'}`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(
                            msg.reactions.reduce(
                              (acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
                                return acc
                              },
                              {} as Record<string, number>
                            )
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

                      {/* Quick actions (on hover) */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        {QUICK_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => sendReaction(msg.id, e)}
                            className="text-xs hover:scale-125 transition-transform"
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] px-1"
                        >
                          ↩
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--bg-hover)]">
              <div className="flex-1 text-xs text-[var(--text-secondary)] truncate">
                ↩ Replying to <strong>{replyTo.author?.full_name}</strong>: {replyTo.text}
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="px-4 py-3 border-t border-[var(--border)] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-4 py-2.5 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || !connected}
              className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-lg)] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">💬</div>
            <div className="text-sm text-[var(--text-secondary)]">Select a channel to start chatting</div>
          </div>
        </div>
      )}
    </div>
  )
}
