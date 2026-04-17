import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { calendarApi, type CalendarEvent } from '../api/calendar'
import { tasksApi, type Task } from '../api/tasks'
import { dealsApi, type Deal } from '../api/deals'

// ─── Constants ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8..21
const HOUR_HEIGHT = 64 // px per hour
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const COLOR_OPTIONS = [
  { value: 'blue',   bg: '#3b82f6', label: 'Синий' },
  { value: 'green',  bg: '#22c55e', label: 'Зелёный' },
  { value: 'orange', bg: '#f97316', label: 'Оранжевый' },
  { value: 'red',    bg: '#ef4444', label: 'Красный' },
  { value: 'purple', bg: '#a855f7', label: 'Фиолетовый' },
  { value: 'pink',   bg: '#ec4899', label: 'Розовый' },
  { value: 'teal',   bg: '#14b8a6', label: 'Бирюзовый' },
]

function colorToBg(color: string): string {
  const found = COLOR_OPTIONS.find(c => c.value === color)
  return found ? found.bg : '#3b82f6'
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayYMD(): string {
  return toYMD(new Date())
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const start = getWeekStart(firstDay)

  const endRef = new Date(lastDay)
  const endDay = endRef.getDay()
  const daysUntilSun = endDay === 0 ? 0 : 7 - endDay
  const end = new Date(lastDay)
  end.setDate(end.getDate() + daysUntilSun)

  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function formatWeekRange(weekDays: Date[]): string {
  if (!weekDays.length) return ''
  const first = weekDays[0]
  const last = weekDays[weekDays.length - 1]
  const sameMonth = first.getMonth() === last.getMonth()
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
  }
  return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`
}

function parseLocalDatetime(iso: string): Date {
  if (!iso) return new Date()
  // Explicit UTC / offset → native parse
  if (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso)
  // Naive "YYYY-MM-DDTHH:mm[:ss]" → local wall clock (matches Apple-style calendar)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      m[6] ? Number(m[6]) : 0,
      0,
    )
  }
  return new Date(iso)
}

function formatLocalDatetime(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${da}T${h}:${mi}:${s}`
}

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000

function eventEndMs(ev: CalendarEvent): number {
  const st = parseLocalDatetime(ev.start_datetime).getTime()
  if (ev.end_datetime) return parseLocalDatetime(ev.end_datetime).getTime()
  return st + DEFAULT_EVENT_DURATION_MS
}

function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  const as = parseLocalDatetime(a.start_datetime).getTime()
  const ae = eventEndMs(a)
  const bs = parseLocalDatetime(b.start_datetime).getTime()
  const be = eventEndMs(b)
  return as < be && bs < ae
}

/** Connected components by overlap — layout width is per cluster, not whole day */
function clusterDayEvents(events: CalendarEvent[]): CalendarEvent[][] {
  const byId = new Map(events.map(e => [e.id, e]))
  const visited = new Set<number>()
  const clusters: CalendarEvent[][] = []

  const dfs = (id: number, acc: CalendarEvent[]) => {
    if (visited.has(id)) return
    visited.add(id)
    const ev = byId.get(id)
    if (!ev) return
    acc.push(ev)
    for (const o of events) {
      if (!visited.has(o.id) && eventsOverlap(ev, o)) dfs(o.id, acc)
    }
  }

  for (const ev of events) {
    if (visited.has(ev.id)) continue
    const acc: CalendarEvent[] = []
    dfs(ev.id, acc)
    clusters.push(acc)
  }
  return clusters
}

/** Greedy lanes inside one overlap cluster; returns lane + column count for each id */
function layoutOverlapCluster(cluster: CalendarEvent[]): Map<number, { lane: number; cols: number }> {
  const sorted = [...cluster].sort(
    (a, b) => parseLocalDatetime(a.start_datetime).getTime() - parseLocalDatetime(b.start_datetime).getTime(),
  )
  type Active = { end: number; lane: number }
  const active: Active[] = []
  const result = new Map<number, { lane: number; cols: number }>()
  let peak = 0

  for (const ev of sorted) {
    const st = parseLocalDatetime(ev.start_datetime).getTime()
    const en = eventEndMs(ev)
    const still: Active[] = []
    for (const a of active) {
      if (a.end > st) still.push(a)
    }
    active.length = 0
    active.push(...still)

    const used = new Set(active.map(a => a.lane))
    let lane = 0
    while (used.has(lane)) lane++
    active.push({ end: en, lane })
    peak = Math.max(peak, active.length)
    result.set(ev.id, { lane, cols: 0 })
  }
  for (const [, v] of result) v.cols = peak
  return result
}

function buildDayEventLayout(dayEvents: CalendarEvent[]): Map<number, { lane: number; cols: number }> {
  const out = new Map<number, { lane: number; cols: number }>()
  for (const c of clusterDayEvents(dayEvents)) {
    const m = layoutOverlapCluster(c)
    for (const [id, v] of m) out.set(id, v)
  }
  return out
}

function ymdUnderPointer(clientX: number, clientY: number, validYmds: Set<string>): string | null {
  const nodes = document.elementsFromPoint(clientX, clientY)
  for (const n of nodes) {
    const el = n as HTMLElement
    const c = el.closest?.('[data-calendar-day]') as HTMLElement | null
    const y = c?.dataset.calendarDay
    if (y && validYmds.has(y)) return y
  }
  return null
}

function dayDiffYmd(fromYmd: string, toYmd: string): number {
  const [y0, m0, d0] = fromYmd.split('-').map(Number)
  const [y1, m1, d1] = toYmd.split('-').map(Number)
  const t0 = Date.UTC(y0, m0 - 1, d0)
  const t1 = Date.UTC(y1, m1 - 1, d1)
  return Math.round((t1 - t0) / 86400000)
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000)
}

function shiftDateByDays(d: Date, deltaDays: number): Date {
  const o = new Date(d.getTime())
  o.setDate(o.getDate() + deltaDays)
  return o
}

/** Keep timed events inside the visible 8:00–21:45 grid when dropping */
function clampToVisibleGrid(d: Date): Date {
  const o = new Date(d)
  let total = o.getHours() * 60 + o.getMinutes()
  const lo = 8 * 60
  const hi = 21 * 60 + 45
  total = Math.max(lo, Math.min(hi, total))
  o.setHours(Math.floor(total / 60), total % 60, 0, 0)
  return o
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month'

interface ContextMenu {
  x: number
  y: number
  date: string
  time?: string // HH:MM
}

interface CreateModal {
  date: string
  time: string
  endTime?: string
  type: 'event' | 'reminder' | 'busy'
}

interface DetailPopup {
  event: CalendarEvent
  x: number
  y: number
}

interface AllDayItem {
  key: string
  title: string
  date: string
  kind: 'task' | 'deal'
  id: number
  isOverdue?: boolean
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// ─── Event block positioning ─────────────────────────────────────────────────

function getEventPosition(start: Date, end: Date | null) {
  const startHour = start.getHours()
  const startMin = start.getMinutes()
  const top = (startHour - 8) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT

  let height = HOUR_HEIGHT // default 1 hour
  if (end) {
    const endHour = end.getHours()
    const endMin = end.getMinutes()
    const durationMins = (endHour - startHour) * 60 + (endMin - startMin)
    height = Math.max(30, (durationMins / 60) * HOUR_HEIGHT)
  }
  return { top: Math.max(0, top), height }
}

// ─── Week Time Grid ───────────────────────────────────────────────────────────

/** Compact all-day stack: shows max 2, then a "+N ещё" toggle that expands the rest. */
function AllDayStack({ items }: { items: AllDayItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const MAX = 2
  const shown = expanded ? items : items.slice(0, MAX)
  const hidden = Math.max(0, items.length - MAX)
  return (
    <div style={{ padding: '2px 2px 4px', minHeight: 4 }}>
      {shown.map((item) => (
        <div
          key={item.key}
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '1px 4px',
            borderRadius: 3,
            marginBottom: 1,
            background: item.kind === 'task' ? 'rgba(253,116,72,0.2)' : 'rgba(99,102,241,0.2)',
            color: item.kind === 'task' ? '#fd7448' : '#818cf8',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            cursor: 'default',
          }}
          title={item.title}
        >
          {item.kind === 'task' ? '✓ ' : '◆ '}{item.title}
        </div>
      ))}
      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 4px',
            borderRadius: 3,
            background: 'rgba(100,116,139,0.12)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            width: '100%',
            border: 'none',
          }}
        >
          +{hidden} ещё
        </button>
      )}
      {expanded && items.length > MAX && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
          style={{
            fontSize: 10,
            padding: '1px 4px',
            color: 'var(--text-secondary)',
            background: 'transparent',
            cursor: 'pointer',
            width: '100%',
            border: 'none',
          }}
        >
          свернуть
        </button>
      )}
    </div>
  )
}

interface WeekGridProps {
  weekDays: Date[]
  events: CalendarEvent[]
  allDayItems: AllDayItem[]
  today: string
  onSlotDoubleClick: (date: string, time: string, endTime?: string) => void
  onSlotContextMenu: (date: string, time: string, x: number, y: number) => void
  onEventClick: (event: CalendarEvent, x: number, y: number) => void
  onEventMove: (event: CalendarEvent, newStart: Date, newEnd: Date | null) => void
  onEventResize?: (event: CalendarEvent, newEnd: Date) => void
}

function timeFromRelY(relY: number): string {
  const totalMin = Math.round((relY / HOUR_HEIGHT) * 4) * 15 + 8 * 60
  const clamped = Math.max(8 * 60, Math.min(22 * 60, totalMin))
  const hour = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function timeFromSlotPointer(e: React.MouseEvent<HTMLDivElement>): string {
  const rect = e.currentTarget.getBoundingClientRect()
  return timeFromRelY(e.clientY - rect.top)
}

function WeekGrid({
  weekDays,
  events,
  allDayItems,
  today,
  onSlotDoubleClick,
  onSlotContextMenu,
  onEventClick,
  onEventMove,
  onEventResize,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nowTick, setNowTick] = useState(() => new Date())

  // Keep "now" indicator fresh
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll smartly: to "now" if today is in the week, otherwise to earliest event, otherwise 9:00
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayYMD = toYMD(new Date())
    const isThisWeek = weekDays.some((d) => toYMD(d) === todayYMD)
    let targetHour = 9
    if (isThisWeek) {
      targetHour = Math.max(8, new Date().getHours() - 1)
    } else {
      const earliest = events
        .filter((ev) => !ev.all_day)
        .map((ev) => parseLocalDatetime(ev.start_datetime).getHours())
        .sort((a, b) => a - b)[0]
      if (earliest !== undefined) targetHour = Math.max(8, earliest - 1)
    }
    el.scrollTop = Math.max(0, (targetHour - 8) * HOUR_HEIGHT - 40)
  }, [weekDays, events])

  const eventsForDay = (dayYMD: string) =>
    events.filter(ev => {
      const d = parseLocalDatetime(ev.start_datetime)
      return toYMD(d) === dayYMD && !ev.all_day
    })

  const allDayForDay = (dayYMD: string) =>
    allDayItems.filter(item => item.date === dayYMD)

  const typeStyle = (ev: CalendarEvent): React.CSSProperties => {
    if (ev.event_type === 'busy') {
      return {
        background: 'rgba(100,116,139,0.35)',
        borderLeft: '3px solid #64748b',
        color: '#94a3b8',
      }
    }
    if (ev.event_type === 'reminder') {
      return {
        background: 'rgba(251,146,60,0.2)',
        borderLeft: '3px solid #fb923c',
        color: '#fb923c',
      }
    }
    const bg = colorToBg(ev.color)
    return {
      background: `${bg}22`,
      borderLeft: `3px solid ${bg}`,
      color: bg,
    }
  }

  const weekYmdSet = useMemo(() => new Set(weekDays.map(d => toYMD(d))), [weekDays])

  const dragRef = useRef<{
    pointerId: number
    startY: number
    startX: number
    ev: CalendarEvent
    originYmd: string
    origStart: Date
    origEnd: Date | null
    durationMs: number
    moved: boolean
    captureEl: HTMLElement
  } | null>(null)

  const [draggingEvId, setDraggingEvId] = useState<number | null>(null)
  // Resize state (separate from drag — acts on the bottom edge only)
  const resizeRef = useRef<{
    pointerId: number
    startY: number
    ev: CalendarEvent
    origStart: Date
    origEnd: Date
    origHeight: number
    cardEl: HTMLElement
    captureEl: HTMLElement
  } | null>(null)
  const [resizingEvId, setResizingEvId] = useState<number | null>(null)

  // Drag-to-create selection (Apple Calendar-style)
  const [selectionDrag, setSelectionDrag] = useState<{
    ymd: string
    startRelY: number
    currentRelY: number
  } | null>(null)

  const bindSlotPointerDragCreate = useCallback(
    (down: React.MouseEvent<HTMLDivElement>, ymd: string) => {
      if (down.button !== 0) return
      // Skip when user clicks on an event card or its resize handle
      const target = down.target as HTMLElement
      if (target.closest('.event-card') || target.closest('.resize-handle')) return

      const columnEl = down.currentTarget
      const rect = columnEl.getBoundingClientRect()
      const startRelY = down.clientY - rect.top
      let dragged = false

      const move = (me: MouseEvent) => {
        const currentRelY = me.clientY - rect.top
        if (!dragged && Math.abs(currentRelY - startRelY) > 4) dragged = true
        if (dragged) {
          setSelectionDrag({ ymd, startRelY, currentRelY })
        }
      }

      const finish = (me: MouseEvent) => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', finish)
        const currentRelY = me.clientY - rect.top
        setSelectionDrag(null)
        if (!dragged) return
        const lo = Math.min(startRelY, currentRelY)
        const hi = Math.max(startRelY, currentRelY)
        const startTime = timeFromRelY(lo)
        let endTime = timeFromRelY(hi)
        if (endTime === startTime) {
          const [h, m] = startTime.split(':').map(Number)
          const next = h * 60 + m + 30
          endTime = `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
        }
        onSlotDoubleClick(ymd, startTime, endTime)
      }

      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', finish)
    },
    [onSlotDoubleClick],
  )

  const bindEventPointerResize = useCallback(
    (down: React.MouseEvent<HTMLDivElement>, ev: CalendarEvent) => {
      if (down.button !== 0) return
      // Stop propagation so the outer drag handler does not also activate
      down.stopPropagation()
      down.preventDefault()
      const handleEl = down.currentTarget
      const cardEl = handleEl.closest<HTMLElement>('.event-card')
      if (!cardEl) return

      const origStart = parseLocalDatetime(ev.start_datetime)
      const origEnd = ev.end_datetime
        ? parseLocalDatetime(ev.end_datetime)
        : new Date(origStart.getTime() + DEFAULT_EVENT_DURATION_MS)

      const startY = down.clientY
      const origHeight = cardEl.getBoundingClientRect().height
      resizeRef.current = {
        pointerId: 0, startY, ev, origStart, origEnd, origHeight, cardEl, captureEl: handleEl,
      }
      setResizingEvId(ev.id)

      const move = (me: MouseEvent) => {
        const next = Math.max(15, origHeight + (me.clientY - startY))
        cardEl.style.height = `${next}px`
      }

      const finish = (me: MouseEvent) => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', finish)
        cardEl.style.height = ''
        resizeRef.current = null
        setResizingEvId(null)

        const dMin = Math.round(((me.clientY - startY) / HOUR_HEIGHT) * (60 / 15)) * 15
        let newEnd = addMinutes(origEnd, dMin)
        const minEnd = addMinutes(origStart, 15)
        if (newEnd.getTime() < minEnd.getTime()) newEnd = minEnd
        if (newEnd.getTime() !== origEnd.getTime() && onEventResize) {
          onEventResize(ev, newEnd)
        }
      }

      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', finish)
    },
    [onEventResize],
  )

  const bindEventPointerDrag = useCallback(
    (down: React.MouseEvent<HTMLDivElement>, ev: CalendarEvent, originYmd: string) => {
      if (down.button !== 0) return
      down.stopPropagation()
      const el = down.currentTarget

      const origStart = parseLocalDatetime(ev.start_datetime)
      const origEnd = ev.end_datetime ? parseLocalDatetime(ev.end_datetime) : null
      const durationMs = origEnd ? origEnd.getTime() - origStart.getTime() : DEFAULT_EVENT_DURATION_MS

      const startX = down.clientX
      const startY = down.clientY
      dragRef.current = {
        pointerId: 0, startY, startX, ev, originYmd, origStart, origEnd, durationMs,
        moved: false, captureEl: el,
      }
      setDraggingEvId(ev.id)

      const move = (me: MouseEvent) => {
        const dx = me.clientX - startX
        const dy = me.clientY - startY
        if (Math.hypot(dx, dy) > 5 && dragRef.current) {
          dragRef.current.moved = true
          // Disable pointer events on the card so elementsFromPoint (for day detection) sees the columns underneath
          el.style.pointerEvents = 'none'
        }
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      }

      const finish = (me: MouseEvent) => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', finish)
        el.style.transform = ''
        el.style.pointerEvents = ''
        const s = dragRef.current
        dragRef.current = null
        setDraggingEvId(null)
        if (!s) return
        // rebind remaining handlers to the captured snapshot `s`
        const pe = me as unknown as { clientX: number; clientY: number; type: string }

        if (pe.type === 'pointercancel') return

        const dist = Math.hypot(pe.clientX - s.startX, pe.clientY - s.startY)
        const isDrag = s.moved || dist > 5

        if (isDrag) {
          const dMin = Math.round(((pe.clientY - s.startY) / HOUR_HEIGHT) * (60 / 15)) * 15
          const targetYmd = ymdUnderPointer(pe.clientX, pe.clientY, weekYmdSet) ?? s.originYmd
          const dayShift = dayDiffYmd(s.originYmd, targetYmd)
          let newStart = addMinutes(s.origStart, dMin)
          newStart = shiftDateByDays(newStart, dayShift)
          newStart = clampToVisibleGrid(newStart)
          const newEnd =
            s.origEnd != null ? new Date(newStart.getTime() + s.durationMs) : null
          if (newStart.getTime() !== s.origStart.getTime()) onEventMove(s.ev, newStart, newEnd)
        } else {
          onEventClick(s.ev, pe.clientX, pe.clientY)
        }
      }

      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', finish)
    },
    [onEventClick, onEventMove, weekYmdSet],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Day header row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Time gutter spacer */}
        <div style={{ width: 56, flexShrink: 0 }} />
        {weekDays.map((day) => {
          const ymd = toYMD(day)
          const isToday = ymd === today
          const dayNum = day.getDate()
          const dayName = DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div
              key={ymd}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px 4px',
                borderLeft: '1px solid var(--border)',
                background: isWeekend ? 'rgba(0,0,0,0.02)' : undefined,
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 500,
                color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {dayName}
              </div>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '2px auto 0',
                fontSize: 16,
                fontWeight: isToday ? 700 : 400,
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? '#fff' : 'var(--text)',
              }}>
                {dayNum}
              </div>

              {/* All-day items (compact: max 2, then "+N ещё") */}
              <AllDayStack items={allDayForDay(ymd)} />
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', minHeight: HOURS.length * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div style={{ width: 56, flexShrink: 0, position: 'relative' }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: (hour - 8) * HOUR_HEIGHT - 8,
                  right: 8,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const ymd = toYMD(day)
            const isToday = ymd === today
            const isWeekend = day.getDay() === 0 || day.getDay() === 6
            const dayEvents = eventsForDay(ymd)
            const overlapLayout = buildDayEventLayout(dayEvents)
            const nowTop = isToday
              ? (nowTick.getHours() - 8) * HOUR_HEIGHT + (nowTick.getMinutes() / 60) * HOUR_HEIGHT
              : null

            return (
              <div
                key={ymd}
                data-calendar-day={ymd}
                onMouseDown={(e) => bindSlotPointerDragCreate(e, ymd)}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  onSlotDoubleClick(ymd, timeFromSlotPointer(e))
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onSlotContextMenu(ymd, timeFromSlotPointer(e), e.clientX, e.clientY)
                }}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderLeft: '1px solid var(--border)',
                  cursor: 'default',
                  background: isWeekend
                    ? 'rgba(0,0,0,0.015)'
                    : isToday
                    ? 'rgba(253,116,72,0.03)'
                    : undefined,
                  minHeight: HOURS.length * HOUR_HEIGHT,
                }}
              >
                {/* Now indicator (only on today, only if within visible hours) */}
                {isToday && nowTop !== null && nowTop >= 0 && nowTop <= HOURS.length * HOUR_HEIGHT && (
                  <div
                    data-testid="now-line"
                    style={{
                      position: 'absolute',
                      top: nowTop,
                      left: 0,
                      right: 0,
                      height: 0,
                      borderTop: '2px solid #ef4444',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      left: -6, top: -6,
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: '#ef4444',
                    }} />
                  </div>
                )}

                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: (hour - 8) * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      borderTop: '1px solid var(--border)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={`${hour}h`}
                    style={{
                      position: 'absolute',
                      top: (hour - 8) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      left: 8,
                      right: 0,
                      borderTop: '1px solid var(--border)',
                      opacity: 0.4,
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Drag-to-create ghost selection */}
                {selectionDrag && selectionDrag.ymd === ymd && (() => {
                  const lo = Math.min(selectionDrag.startRelY, selectionDrag.currentRelY)
                  const hi = Math.max(selectionDrag.startRelY, selectionDrag.currentRelY)
                  const startTimeLabel = timeFromRelY(lo)
                  const endTimeLabel = timeFromRelY(hi)
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: lo,
                        left: 3,
                        right: 3,
                        height: Math.max(15, hi - lo),
                        background: 'rgba(253,116,72,0.18)',
                        border: '2px solid var(--accent)',
                        borderRadius: 5,
                        zIndex: 15,
                        pointerEvents: 'none',
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--accent)',
                      }}
                    >
                      {startTimeLabel} – {endTimeLabel}
                    </div>
                  )
                })()}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const start = parseLocalDatetime(ev.start_datetime)
                  const end = ev.end_datetime ? parseLocalDatetime(ev.end_datetime) : null
                  const { top, height } = getEventPosition(start, end)
                  const style = typeStyle(ev)
                  const L = overlapLayout.get(ev.id) ?? { lane: 0, cols: 1 }
                  const cols = Math.max(1, L.cols)
                  const lane = Math.min(L.lane, cols - 1)
                  const isDragging = draggingEvId === ev.id
                  const isResizing = resizingEvId === ev.id
                  const wPct = (100 / cols)
                  const leftPct = lane * wPct
                  const displayHeight = Math.max(15, height)

                  return (
                    <div
                      key={ev.id}
                      className="event-card"
                      data-testid={`event-${ev.id}`}
                      data-event-id={ev.id}
                      onMouseDown={e => bindEventPointerDrag(e, ev, ymd)}
                      onDoubleClick={e => e.stopPropagation()}
                      onContextMenu={e => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top,
                        willChange: isDragging || isResizing ? 'transform, height' : undefined,
                        left: `calc(${leftPct}% + 3px)`,
                        width: `calc(${wPct}% - 6px)`,
                        height: displayHeight,
                        borderRadius: 5,
                        padding: '2px 6px',
                        overflow: 'hidden',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        touchAction: 'none',
                        zIndex: isDragging || isResizing ? 20 : 1 + lane,
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        boxShadow: (isDragging || isResizing) ? '0 6px 20px rgba(0,0,0,0.18)' : undefined,
                        ...style,
                      }}
                      title={ev.title}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.event_type === 'reminder' && '🔔 '}
                        {ev.event_type === 'busy' && '⛔ '}
                        {ev.title}
                      </div>
                      {height > 36 && (
                        <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 400 }}>
                          {start.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {end && ` – ${end.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                        </div>
                      )}
                      {/* Resize handle (bottom 8px). Only for events with an end time. */}
                      {end && (
                        <div
                          className="resize-handle"
                          data-testid={`resize-${ev.id}`}
                          onMouseDown={(e) => bindEventPointerResize(e, ev)}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 8,
                            cursor: 'ns-resize',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent)',
                            borderBottomLeftRadius: 5,
                            borderBottomRightRadius: 5,
                          }}
                          title="Потяните, чтобы изменить длительность"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

interface MonthGridProps {
  year: number
  month: number
  events: CalendarEvent[]
  allDayItems: AllDayItem[]
  today: string
  onDayDoubleClick: (date: string) => void
  onDayContextMenu: (date: string, x: number, y: number) => void
  onEventClick: (event: CalendarEvent, x: number, y: number) => void
}

function MonthGrid({ year, month, events, allDayItems, today, onDayDoubleClick, onDayContextMenu, onEventClick }: MonthGridProps) {
  const days = getMonthGrid(year, month)

  const eventsForDay = (ymd: string) => events.filter(ev => toYMD(parseLocalDatetime(ev.start_datetime)) === ymd)
  const allDayForDay = (ymd: string) => allDayItems.filter(item => item.date === ymd)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
      }}>
        {DAY_NAMES.map(name => (
          <div key={name} style={{
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        flex: 1,
        overflow: 'auto',
      }}>
        {days.map((day) => {
          const ymd = toYMD(day)
          const isToday = ymd === today
          const isCurrentMonth = day.getMonth() === month
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const dayEvents = eventsForDay(ymd)
          const dayAllDay = allDayForDay(ymd)
          const allItems = [...dayAllDay, ...dayEvents.map(ev => ({ ...ev, kind: 'event' as const }))]

          return (
            <div
              key={ymd}
              data-calendar-day={ymd}
              onDoubleClick={(e) => {
                e.preventDefault()
                onDayDoubleClick(ymd)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                onDayContextMenu(ymd, e.clientX, e.clientY)
              }}
              style={{
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: '6px',
                minHeight: 100,
                cursor: 'default',
                background: isWeekend && isCurrentMonth
                  ? 'rgba(0,0,0,0.015)'
                  : !isCurrentMonth
                  ? 'rgba(0,0,0,0.025)'
                  : undefined,
                opacity: isCurrentMonth ? 1 : 0.5,
                position: 'relative',
              }}
            >
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: isToday ? 700 : 400,
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? '#fff' : isCurrentMonth ? 'var(--text)' : 'var(--text-secondary)',
                marginBottom: 4,
              }}>
                {day.getDate()}
              </div>

              {allItems.slice(0, 3).map((item, idx) => {
                const isCalEv = 'event_type' in item
                if (isCalEv) {
                  const ev = item as CalendarEvent
                  const bg = ev.event_type === 'busy' ? '#64748b'
                    : ev.event_type === 'reminder' ? '#fb923c'
                    : colorToBg(ev.color)
                  return (
                    <div
                      key={`ev-${ev.id}`}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev, e.clientX, e.clientY) }}
                      onDoubleClick={e => e.stopPropagation()}
                      onContextMenu={e => e.stopPropagation()}
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 5px',
                        borderRadius: 3,
                        marginBottom: 2,
                        background: `${bg}22`,
                        color: bg,
                        borderLeft: `2px solid ${bg}`,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  )
                }
                const ai = item as AllDayItem
                return (
                  <div
                    key={`ai-${idx}`}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: '1px 5px',
                      borderRadius: 3,
                      marginBottom: 2,
                      background: ai.kind === 'task' ? 'rgba(253,116,72,0.15)' : 'rgba(99,102,241,0.15)',
                      color: ai.kind === 'task' ? '#fd7448' : '#818cf8',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                    title={ai.title}
                  >
                    {ai.title}
                  </div>
                )
              })}
              {allItems.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  +{allItems.length - 3} ещё
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

interface CreateModalProps {
  initial: CreateModal
  onSave: (payload: Partial<CalendarEvent>) => Promise<void>
  onClose: () => void
}

function CreateEventModal({ initial, onSave, onClose }: CreateModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'event' | 'reminder' | 'busy'>(initial.type)
  const [date, setDate] = useState(initial.date)
  const [startTime, setStartTime] = useState(initial.time)
  const [endTime, setEndTime] = useState(() => {
    if (initial.endTime) return initial.endTime
    const [h, m] = initial.time.split(':').map(Number)
    const endH = h + 1
    return `${String(endH > 23 ? 23 : endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('blue')
  const [allDay, setAllDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Укажите название'); return }
    setSaving(true)
    try {
      const payload: Partial<CalendarEvent> = {
        title: title.trim(),
        event_type: type,
        description,
        color,
        all_day: allDay,
        start_datetime: `${date}T${startTime}:00`,
        end_datetime: allDay ? null : `${date}T${endTime}:00`,
      }
      await onSave(payload)
      onClose()
    } catch {
      setError('Не удалось сохранить событие')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: '24px',
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {type === 'reminder' ? 'Новое напоминание' : type === 'busy' ? 'Занят' : 'Новое событие'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['event', 'reminder', 'busy'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === t ? 'rgba(253,116,72,0.12)' : 'transparent',
                  color: type === t ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'event' ? 'Событие' : t === 'reminder' ? 'Напоминание' : 'Занят'}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              Название *
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'reminder' ? 'Текст напоминания...' : type === 'busy' ? 'Занят' : 'Название события...'}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date + All day */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Дата
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              cursor: 'pointer', paddingBottom: 9,
            }}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Весь день
            </label>
          </div>

          {/* Time */}
          {!allDay && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  Начало
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  Конец
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              Описание
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Необязательные заметки..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Color (only for event type) */}
          {type === 'event' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Цвет
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: c.bg,
                      border: color === c.value ? '3px solid var(--text)' : '3px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Event Detail Popup ───────────────────────────────────────────────────────

interface DetailPopupProps {
  event: CalendarEvent
  x: number
  y: number
  onDelete: (id: number) => Promise<void>
  onClose: () => void
}

function EventDetailPopup({ event, x, y, onDelete, onClose }: DetailPopupProps) {
  const [deleting, setDeleting] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Reposition to stay in viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 200,
    top: Math.min(y, window.innerHeight - 240),
    left: Math.min(x, window.innerWidth - 280),
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '16px',
    width: 260,
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  }

  const bg = event.event_type === 'busy' ? '#64748b'
    : event.event_type === 'reminder' ? '#fb923c'
    : colorToBg(event.color)

  const start = parseLocalDatetime(event.start_datetime)
  const end = event.end_datetime ? parseLocalDatetime(event.end_datetime) : null

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(event.id)
    onClose()
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={popupRef} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: bg, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {event.title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 2,
            display: 'flex', alignItems: 'center',
          }}
        >
          <XIcon />
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {event.all_day ? (
          <span>Весь день · {start.toLocaleDateString('ru', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        ) : (
          <span>
            {start.toLocaleDateString('ru', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {start.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', hour12: false })}
            {end && ` – ${end.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {event.event_type === 'busy' ? 'Занят'
          : event.event_type === 'reminder' ? 'Напоминание'
          : 'Событие'}
        {event.created_by_name && ` · ${event.created_by_name}`}
      </div>

      {event.description && (
        <div style={{
          fontSize: 12,
          color: 'var(--text)',
          marginBottom: 12,
          padding: '8px',
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 6,
          lineHeight: 1.5,
        }}>
          {event.description}
        </div>
      )}

      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 6,
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.08)',
          color: '#ef4444',
          cursor: deleting ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          width: '100%',
          justifyContent: 'center',
          opacity: deleting ? 0.6 : 1,
        }}
      >
        <TrashIcon />
        {deleting ? 'Удаление...' : 'Удалить событие'}
      </button>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  menu: ContextMenu
  onNewEvent: () => void
  onNewReminder: () => void
  onClose: () => void
}

function ContextMenuPopup({ menu, onNewEvent, onNewReminder, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const items = [
    { label: 'Новое событие', icon: '📅', action: onNewEvent },
    { label: 'Новое напоминание', icon: '🔔', action: onNewReminder },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: Math.min(menu.y, window.innerHeight - 100),
        left: Math.min(menu.x, window.innerWidth - 200),
        zIndex: 150,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '4px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        minWidth: 180,
      }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main CalendarPage ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t } = useTranslation()
  const today = todayYMD()

  // View state
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(new Date())

  // Data
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)

  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [createModal, setCreateModal] = useState<CreateModal | null>(null)
  const [detailPopup, setDetailPopup] = useState<DetailPopup | null>(null)

  // Derived dates
  const weekDays = getWeekDays(anchor)
  const monthYear = { year: anchor.getFullYear(), month: anchor.getMonth() }

  // Date range for fetching
  const { dateFrom, dateTo } = (() => {
    if (view === 'week') {
      return { dateFrom: toYMD(weekDays[0]), dateTo: toYMD(weekDays[6]) }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { dateFrom: toYMD(first), dateTo: toYMD(last) }
  })()

  // Fetch calendar events
  useEffect(() => {
    setLoading(true)
    calendarApi.list(dateFrom, dateTo)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  // Fetch tasks and deals (once per mount — no date filter needed, we filter by deadline)
  useEffect(() => {
    tasksApi.list({ page_size: '200' })
      .then(res => setTasks(Array.isArray(res) ? res : res.results ?? []))
      .catch(() => setTasks([]))

    dealsApi.list({ page_size: '200' })
      .then(res => setDeals(Array.isArray(res) ? res : res.results ?? []))
      .catch(() => setDeals([]))
  }, [])

  // Build all-day items from tasks + deals
  const allDayItems: AllDayItem[] = [
    ...tasks
      .filter(t => t.deadline)
      .map(t => ({
        key: `task-${t.id}`,
        title: t.title,
        date: t.deadline!.slice(0, 10),
        kind: 'task' as const,
        id: t.id,
        isOverdue: t.is_overdue,
      })),
    ...deals
      .filter(d => d.expected_close_date)
      .map(d => ({
        key: `deal-${d.id}`,
        title: d.title,
        date: d.expected_close_date!,
        kind: 'deal' as const,
        id: d.id,
      })),
  ]

  // Navigation
  const goToday = () => setAnchor(new Date())

  const goPrev = () => {
    if (view === 'week') {
      const d = new Date(anchor)
      d.setDate(d.getDate() - 7)
      setAnchor(d)
    } else {
      const d = new Date(anchor)
      d.setMonth(d.getMonth() - 1)
      setAnchor(d)
    }
  }

  const goNext = () => {
    if (view === 'week') {
      const d = new Date(anchor)
      d.setDate(d.getDate() + 7)
      setAnchor(d)
    } else {
      const d = new Date(anchor)
      d.setMonth(d.getMonth() + 1)
      setAnchor(d)
    }
  }

  const label = view === 'week'
    ? formatWeekRange(weekDays)
    : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`

  const handleSlotContextMenu = useCallback((date: string, time: string, x: number, y: number) => {
    setDetailPopup(null)
    setContextMenu({ x, y, date, time })
  }, [])

  const handleSlotDoubleClick = useCallback((date: string, time: string, endTime?: string) => {
    setDetailPopup(null)
    setContextMenu(null)
    setCreateModal({ date, time, endTime, type: 'event' })
  }, [])

  const handleDayContextMenu = useCallback((date: string, x: number, y: number) => {
    setDetailPopup(null)
    setContextMenu({ x, y, date, time: '09:00' })
  }, [])

  const handleDayDoubleClick = useCallback((date: string) => {
    setDetailPopup(null)
    setContextMenu(null)
    setCreateModal({ date, time: '09:00', type: 'event' })
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent, x: number, y: number) => {
    setContextMenu(null)
    setDetailPopup({ event, x, y })
  }, [])

  // Create
  const handleCreate = async (payload: Partial<CalendarEvent>) => {
    const created = await calendarApi.create(payload)
    setEvents(prev => [...prev, created])
  }

  // Delete
  const handleDelete = async (id: number) => {
    await calendarApi.delete(id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const handleEventMove = useCallback(async (ev: CalendarEvent, newStart: Date, newEnd: Date | null) => {
    try {
      const updated = await calendarApi.update(ev.id, {
        start_datetime: formatLocalDatetime(newStart),
        end_datetime: newEnd ? formatLocalDatetime(newEnd) : null,
      })
      setEvents(prev => prev.map(e => (e.id === ev.id ? updated : e)))
    } catch {
      try {
        const fresh = await calendarApi.list(dateFrom, dateTo)
        setEvents(fresh)
      } catch {
        /* ignore */
      }
    }
  }, [dateFrom, dateTo])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Today button */}
        <button
          onClick={goToday}
          style={{
            padding: '6px 14px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Сегодня
        </button>

        {/* Prev / Next */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={goPrev}
            style={{
              padding: '6px 10px',
              borderRadius: '7px 0 0 7px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronLeft />
          </button>
          <button
            onClick={goNext}
            style={{
              padding: '6px 10px',
              borderRadius: '0 7px 7px 0',
              border: '1px solid var(--border)',
              borderLeft: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronRight />
          </button>
        </div>

        {/* Label */}
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text)',
          flex: 1,
          minWidth: 0,
        }}>
          {label}
        </span>

        {/* Loading indicator */}
        {loading && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Загрузка...</span>
        )}

        {/* Add event button */}
        <button
          onClick={() => {
            setContextMenu(null)
            setCreateModal({ date: today, time: '09:00', type: 'event' })
          }}
          style={{
            padding: '7px 16px',
            borderRadius: 7,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          + Новое событие
        </button>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 14px',
                border: 'none',
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              {v === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'week' ? (
          <WeekGrid
            weekDays={weekDays}
            events={events}
            allDayItems={allDayItems}
            today={today}
            onSlotDoubleClick={handleSlotDoubleClick}
            onSlotContextMenu={handleSlotContextMenu}
            onEventClick={handleEventClick}
            onEventMove={handleEventMove}
            onEventResize={(ev, newEnd) => handleEventMove(ev, parseLocalDatetime(ev.start_datetime), newEnd)}
          />
        ) : (
          <MonthGrid
            year={monthYear.year}
            month={monthYear.month}
            events={events}
            allDayItems={allDayItems}
            today={today}
            onDayDoubleClick={handleDayDoubleClick}
            onDayContextMenu={handleDayContextMenu}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenuPopup
          menu={contextMenu}
          onNewEvent={() => {
            setCreateModal({ date: contextMenu.date, time: contextMenu.time ?? '09:00', type: 'event' })
          }}
          onNewReminder={() => {
            setCreateModal({ date: contextMenu.date, time: contextMenu.time ?? '09:00', type: 'reminder' })
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Create modal */}
      {createModal && (
        <CreateEventModal
          initial={createModal}
          onSave={handleCreate}
          onClose={() => setCreateModal(null)}
        />
      )}

      {/* Detail popup */}
      {detailPopup && (
        <EventDetailPopup
          event={detailPopup.event}
          x={detailPopup.x}
          y={detailPopup.y}
          onDelete={handleDelete}
          onClose={() => setDetailPopup(null)}
        />
      )}
    </div>
  )
}
