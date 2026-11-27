/**
 * Learn the app (2.0.50): everything playlist.lens does, where to find it, and a way in.
 * Content only — app/learn.tsx draws it. Keep "where" true to the app as it is; the test
 * checks every action opens a screen that exists.
 */
import type { IconName } from '@/components/ui/Icon'
import type { Tint } from '@/components/ui/ListRow'

export type LearnAction =
  | { kind: 'route'; path: string; tab?: boolean }
  | { kind: 'tour' }
  | { kind: 'whatsNew' }

export interface LearnItem {
  id: string
  icon: IconName
  title: string
  body: string
  /** Where it lives, as a path: "Lenses › hold a lens". */
  where: string
  action?: LearnAction
  /** Extra words people might search for. */
  keywords?: string
  /** Needs Spotify Premium (playback). */
  premium?: boolean
}

export interface LearnChapter { id: string; title: string; intro: string; tint: Tint; items: LearnItem[] }

const route = (path: string, tab = false): LearnAction => ({ kind: 'route', path, tab })

export const LEARN: LearnChapter[] = [
  {
    id: 'lenses', title: 'Lenses', tint: 'accent',
    intro: 'Your Spotify playlists, each one a lens on what you listen to.',
    items: [
      { id: 'lens', icon: 'aperture-outline', title: 'Look inside a playlist', where: 'Lenses › tap a lens', action: route('/', true),
        body: 'Its top artists, how famous it is (deep cuts or hits), the decades it comes from, its genres, and how much of it you played this month. Play it from the top.',
        keywords: 'analyse analyze playlist artists genres eras fame popularity' },
      { id: 'lens-actions', icon: 'ellipsis-horizontal-circle-outline', title: 'Pin, share, compare, reorder', where: 'Lenses › hold a lens',
        body: 'Pin a lens to the front, share it, analyse it again, put it side by side with another lens, or drag your lenses into your own order.',
        keywords: 'long press pin share compare reorder re-analyze' },
      { id: 'lens-find', icon: 'search-outline', title: 'Search, grid or list', where: 'Lenses › the buttons by the title',
        body: 'Find a playlist by its name or who made it, and switch between big cards and a two-column grid. Pull the list down to refresh it.',
        keywords: 'search find grid list layout refresh pull' },
      { id: 'taste', icon: 'sparkles-outline', title: 'Your taste', where: 'Lenses › the taste card', action: route('/taste'),
        body: 'All your lenses together: your top artists and genres across every playlist. Share a code so a friend can see it next to theirs.',
        keywords: 'taste profile aggregate share code friend' },
      { id: 'strip', icon: 'chatbubble-ellipses-outline', title: 'The strip', where: 'Lenses › the line at the top',
        body: 'Lines about you: your artist of the week, a song on repeat, your all-time numbers. Tap one to go there, hold it to skip. Add a line of your own in Settings › Appearance › Home banner.',
        keywords: 'strip banner quote tips line' },
    ],
  },
  {
    id: 'listening', title: 'Your listening', tint: 'violet',
    intro: 'Every play you make, kept on your phone, turned into stats and stories.',
    items: [
      { id: 'tracking', icon: 'pulse-outline', title: 'Listening tracking', where: 'Settings › Listening', action: route('/settings'),
        body: 'Spotify only remembers your last 50 plays. Turn this on and every play is saved hourly, even with the app closed. Everything below gets better with it.',
        keywords: 'track tracking sync hourly plays save' },
      { id: 'import', icon: 'cloud-download-outline', title: 'Import your Spotify history', where: 'Settings › About › Labs › Rewind', action: route('/wrapped'),
        body: 'Ask Spotify for your Extended streaming history on its privacy page, then import the ZIP it sends you: years of plays, all on your phone.',
        keywords: 'import zip extended streaming history gdpr export lifetime' },
      { id: 'pages', icon: 'person-outline', title: 'Artist and song pages', where: 'Tap any artist or song',
        body: 'Your whole history with one artist or song: time and plays, the day you found it, listening over the months, when you play it, your longest run and your biggest day. Play their top 10 in one tap.',
        keywords: 'artist page song page first listen rank' },
      { id: 'history', icon: 'time-outline', title: 'History', where: 'Rewind › the clock button', action: route('/history'),
        body: 'Every play you’ve ever had, newest first, a day at a time. Search songs, artists and albums across years, or tap a play for everything by that artist.',
        keywords: 'history search every play day' },
      { id: 'recaps', icon: 'albums-outline', title: 'Recaps', where: 'Rewind › the albums button', action: route('/recaps'),
        body: 'Your listening by week, month, season and year, each with its top artists, songs and albums. Keep a season, set a year aside, or play any of them as a story.',
        keywords: 'recaps week month season year keep discard' },
      { id: 'stories', icon: 'play-circle-outline', title: 'Stories', where: 'Rewind, Recaps or the strip', action: route('/story?kind=week'),
        body: 'Any week, month, year or all time as full-screen slides, with your own songs playing under them. Tap to move on, hold to pause, and share the card at the end.',
        keywords: 'story stories wrapped slides share card music' },
      { id: 'rewind', icon: 'stats-chart-outline', title: 'Rewind', where: 'Settings › About › Labs › Rewind', action: route('/wrapped'),
        body: 'Week, month, year and all-time stats: a calendar of every day, streaks, milestones, what’s new to you, and what you played on this day in earlier years. It’s being rebuilt, so it lives in Labs for now.',
        keywords: 'rewind wrapped stats calendar heatmap streak milestones on this day new to you' },
      { id: 'notifications', icon: 'notifications-outline', title: 'Recap notifications', where: 'Settings › Notifications', action: route('/settings'),
        body: 'A nudge when a week, month or year is over. Tap it and that period plays as a story.',
        keywords: 'notification nudge recap' },
      { id: 'widget', icon: 'apps-outline', title: 'Home-screen widget', where: 'Hold your home screen › Widgets › playlist.lens',
        body: 'This week’s listening time, how it compares with last week, your top artist and your last play, right on your home screen.',
        keywords: 'widget home screen' },
    ],
  },
  {
    id: 'playing', title: 'Playing', tint: 'pink',
    intro: 'playlist.lens is a remote for your Spotify. Playback needs Spotify Premium.',
    items: [
      { id: 'nowplaying', icon: 'musical-notes-outline', title: 'Now playing', where: 'Above the tabs, or the cover button on Lenses', premium: true,
        body: 'See what’s playing, tap it for play, pause and skip, and your own numbers for the song. Choose a bar above the tabs or a cover button by Settings in Settings › Appearance › Now playing.',
        keywords: 'now playing controls pause skip header button bar' },
      { id: 'upnext', icon: 'layers-outline', title: 'Up next, full screen', where: 'Lenses › the cover button', premium: true,
        body: 'The song on top and what plays next as a card: swipe it left to drop it, right to keep it. Once you’re through the queue, the card turns to stats about the song playing.',
        keywords: 'up next queue drop keep full screen cover button' },
      { id: 'queue', icon: 'add-circle-outline', title: 'Build a queue', where: 'The ＋ on any song, then the Queue tab', action: route('/queue', true), premium: true,
        body: 'Tap ＋ on songs anywhere to collect them, put them in order, and start them on your Spotify. It wakes Spotify up for you if it’s closed.',
        keywords: 'queue cart plus add start order' },
      { id: 'rediscovery', icon: 'refresh-circle-outline', title: 'Rediscovery', where: 'Queue tab', action: route('/queue', true),
        body: 'Music to come back to: Fading favorites (loved, then forgotten), Second chances (the ones that almost stuck) and a Time machine to a past season. Play one or add it all.',
        keywords: 'rediscovery fading favorites second chances time machine' },
    ],
  },
  {
    id: 'play', title: 'Play and Swipe', tint: 'amber',
    intro: 'Games about your own listening, and a quick way to tidy a playlist.',
    items: [
      { id: 'games', icon: 'game-controller-outline', title: 'Four games', where: 'Play tab', action: route('/play', true),
        body: 'More or less (did you play this more than that?), Blind five (name the song from five seconds), Rank it (five of your artists, a new five every day) and When? (the month you were most into a song). The artists and songs from a round open their pages afterwards.',
        keywords: 'games play more or less blind five rank it when' },
      { id: 'swipe', icon: 'swap-horizontal-outline', title: 'Swipe a playlist clean', where: 'Swipe tab', action: route('/swipe', true),
        body: 'Go through a playlist with 30-second previews, keep or cut each song, then save the keepers as a new playlist or trim the original (a backup is made first). Nothing changes until you confirm.',
        keywords: 'swipe tinder keep cut trim clean playlist' },
    ],
  },
  {
    id: 'flip', title: 'Galaxy Z Flip', tint: 'sky',
    intro: 'Made for the Flip: the cover screen and the half fold.',
    items: [
      { id: 'cover', icon: 'phone-portrait-outline', title: 'On the cover screen', where: 'Open the app on the cover screen',
        body: 'The whole app, made compact: a tab strip in the free corner (or swipe anywhere), and a ring round the cameras that fills as your song plays. Tap round the cameras for Now playing.',
        keywords: 'cover screen flip outer ring cameras' },
      { id: 'fold', icon: 'laptop-outline', title: 'Half-folded', where: 'Fold the phone like a laptop · Settings › About › Labs', action: route('/labs'),
        body: 'The app moves to the half that stands up and the flat half becomes a music remote: the song, up next as a card, and the controls. In Labs you can have Now playing open by itself when you fold.',
        keywords: 'fold half folded flex panel tabletop laptop remote' },
    ],
  },
  {
    id: 'yours', title: 'Make it yours', tint: 'violet',
    intro: 'The look, the feel, and a little star.',
    items: [
      { id: 'look', icon: 'color-palette-outline', title: 'Theme, accent, font and icon', where: 'Settings › Appearance', action: route('/settings'),
        body: 'Dark or light, six accent colours, the body font, how you move between tabs (the floating bar, a minimal one, or none: swipe anywhere), and the app icon in your accent.',
        keywords: 'theme dark light accent colour font navigation icon appearance' },
      { id: 'spark', icon: 'star-outline', title: 'Spark', where: 'The dot in the playlist.lens wordmark',
        body: 'A little star who lives in the wordmark. Tap him and he says something about your week. Too chatty? Settings › Experience › Spark: On, Quiet or Off.',
        keywords: 'spark star mascot dot' },
      { id: 'covers', icon: 'image-outline', title: 'Fix a wrong picture', where: 'An artist or song card › Wrong image? Fix it',
        body: 'Pick a better match, search again, or use your own image. On an artist’s or song’s page, hold the picture.',
        keywords: 'cover artwork image wrong fix photo' },
      { id: 'comfort', icon: 'leaf-outline', title: 'Calmer, quieter', where: 'Settings › Experience', action: route('/settings'),
        body: 'Reduce motion for calmer screens, haptics off for no taps, artwork off for a plainer look.',
        keywords: 'reduce motion haptics artwork accessibility' },
    ],
  },
  {
    id: 'data', title: 'Your data', tint: 'accent',
    intro: 'Your history stays on your phone. Keep it safe.',
    items: [
      { id: 'backup', icon: 'shield-half-outline', title: 'Backup and restore', where: 'Settings › Backup & restore', action: route('/backup'),
        body: 'Your whole history in one small file: to a folder you choose (every week if you like) or shared anywhere. Restore it on a new phone; it adds to what’s there and never replaces anything.',
        keywords: 'backup restore export file drive new phone' },
      { id: 'privacy', icon: 'lock-closed-outline', title: 'Privacy and crash reports', where: 'Settings › About',
        body: 'What playlist.lens keeps and where, and a switch to keep crash reports on your phone.',
        keywords: 'privacy crash reports errors data' },
      { id: 'tour', icon: 'school-outline', title: 'Take the tour again', where: 'Settings › Help', action: { kind: 'tour' },
        body: 'A walk round the tabs with each part lit up.',
        keywords: 'tour tutorial onboarding' },
      { id: 'whatsnew', icon: 'gift-outline', title: 'What’s new', where: 'Settings › Help', action: { kind: 'whatsNew' },
        body: 'Every update’s notes, newest first.',
        keywords: 'changelog updates release notes' },
    ],
  },
]

/** Lower-case, accents and punctuation out, so "whats new" finds "What’s new". */
export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'‘`]/g, '').replace(/[^a-z0-9＋+ ]+/g, ' ')
}

/** Chapters with only the items matching every word of `query` (chapters left empty drop out). */
export function searchLearn(query: string, chapters: LearnChapter[] = LEARN): LearnChapter[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return chapters
  return chapters
    .map(c => ({ ...c, items: c.items.filter(it => {
      const hay = norm(`${it.title} ${it.body} ${it.where} ${it.keywords ?? ''} ${c.title}`)
      return words.every(w => hay.includes(w))
    }) }))
    .filter(c => c.items.length > 0)
}

export function learnCount(chapters: LearnChapter[] = LEARN): number {
  return chapters.reduce((n, c) => n + c.items.length, 0)
}
