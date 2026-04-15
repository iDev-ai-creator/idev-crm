import api from './client'

export interface ChatUser {
  id: number
  email: string
  full_name: string
  avatar: string | null
}

export interface ChatReaction {
  id: number
  emoji: string
  user: ChatUser
}

export interface ReplyPreview {
  id: number
  text: string
  author: string
}

export interface ChatMessage {
  id: number
  channel: number
  author: ChatUser | null
  text: string
  reply_to: number | null
  reply_to_preview: ReplyPreview | null
  is_edited: boolean
  reactions: ChatReaction[]
  created_at: string
  updated_at: string
}

export interface ChatChannel {
  id: number
  name: string
  channel_type: 'direct' | 'group'
  members: ChatUser[]
  last_message: { text: string; author: string; created_at: string } | null
  unread_count: number
  created_at: string
}

export const chatApi = {
  channels: {
    list: async (): Promise<ChatChannel[]> => {
      const { data } = await api.get('/chat/')
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (payload: { name: string; channel_type: string; member_ids: number[] }): Promise<ChatChannel> => {
      const { data } = await api.post('/chat/', payload)
      return data
    },
    direct: async (userId: number): Promise<ChatChannel> => {
      const { data } = await api.post('/chat/direct/', { user_id: userId })
      return data
    },
  },
  messages: {
    list: async (channelId: number): Promise<ChatMessage[]> => {
      const { data } = await api.get(`/chat/${channelId}/messages/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    pin: async (messageId: number): Promise<void> => {
      await api.patch(`/chat/messages/${messageId}/pin/`)
    },
    forward: async (messageId: number, targetChannelId: number): Promise<void> => {
      await api.post(`/chat/messages/${messageId}/forward/`, { channel_id: targetChannelId })
    },
  },
}
