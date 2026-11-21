/**
 * In-app changelog + first-run flags.
 *
 * Patch notes auto-show once after an update bumps the top CHANGELOG version
 * (decoupled from the OTA mechanics — just compare the stored "seen" version).
 * The tutorial shows once ever (separate flag), and can be replayed from Settings.
 */
import { storage } from '@/utils/cache'

export type ChangeKind = 'New' | 'Improved' | 'Fixed'

export interface PatchEntry {
  version:  string
  name:     string
  date:     string
  sections: { label: ChangeKind; items: string[] }[]
}

// Newest first. Bump the top entry's `version` whenever a drop should surface notes.
export const CHANGELOG: PatchEntry[] = [
  {
    version: '2.0.21',
    name:    'Cover screen',
    date:    '2026-11-21',
    sections: [
      {
        label: 'New',
        items: [
          'Galaxy Z Flip: groundwork for a compact version of the whole app on the cover screen, with a ring round the cameras that fills as your song plays. Coming in the next updates.',
        ],
      },
    ],
  },
  {
    version: '2.0.20',
    name:    'More or less',
    date:    '2026-11-21',
    sections: [
      {
        label: 'New',
        items: [
          'Play: a new tab with More or less, a game on your own listening. Did you play this song (or artist) more or less than that one? Keep going until you get one wrong, and beat your best.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Wrapped is being rebuilt to scroll smoothly. Until then it lives in Settings › About › Labs, and stories, recaps and history keep working as before.',
        ],
      },
    ],
  },
  {
    version: '2.0.19',
    name:    'Two screens',
    date:    '2026-11-21',
    sections: [
      {
        label: 'New',
        items: [
          'The app now knows whether it is on the main screen or the Flip cover screen, by asking the phone directly. This is the groundwork for a cover screen version of the app.',
          'Cover screen lab: the camera ring now sits round the real cameras, with animated backgrounds in 20 colour sets to test it against.',
          'Labs (Settings › About): every prototype and testing tool in one place, including Update details, which shows exactly which update the phone is running.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Settings no longer shows the old "Audio features" note (Spotify stopped sharing them; vibes use genres).',
        ],
      },
    ],
  },
  {
    version: '2.0.18',
    name:    'Smooth Wrapped',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Wrapped Year and All time scroll smoothly. Once their rows, heatmap and numbers have finished animating in, they stop costing work on every scroll, here and on every other tab.',
          'The app stops redrawing when nothing is moving. The now-playing progress line slides instead of resizing, and the hidden now-playing pill no longer animates out of sight.',
        ],
      },
      {
        label: 'New',
        items: [
          'Cover screen lab (Settings › About): a first look at a ring that traces round the cameras on the Flip cover screen as your song plays.',
        ],
      },
    ],
  },
  {
    version: '2.0.17',
    name:    'Smooth playback',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Fixed',
        items: [
          'No more stutter while music plays. The colour backgrounds behind stories and Now Playing are drawn once and moved, instead of being redrawn 60 times a second, and changing colour no longer redraws them either.',
          'Screens no longer refresh every few seconds while a song is playing just to keep track of it.',
        ],
      },
    ],
  },
  {
    version: '2.0.16',
    name:    'Covers for everything',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Improved',
        items: [
          'Covers now come straight from Spotify for every song you’ve played, so smaller artists and releases get their pictures too. Ones that were blank before are fetched again.',
          'Share card: a line about you at the bottom (night owl, your biggest day, new artists), colours from your top song’s cover (tap “Cover colours” to switch), and the month or week always fits.',
          'Stories show the song that’s playing at the bottom of the screen.',
        ],
      },
    ],
  },
  {
    version: '2.0.15',
    name:    'Stories with sound',
    date:    '2026-11-21',
    sections: [
      {
        label: 'New',
        items: [
          'Stories play music: your number one song on the top songs slide, your top artist’s own song on theirs, and your other favourites shuffled under the rest. Tap the speaker to mute.',
          'A new share card: your top song’s cover, your numbers, your top artists’ photos and your top songs.',
          'Save the card: pick a folder once (like Pictures) and every card after goes straight there.',
          'The listening-clock slide shows what you play at your peak hour, and the time slide shows your biggest day’s soundtrack.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'The story intro fills the screen with your top songs’ covers.',
          'Share card: the three numbers line up, and long song titles no longer break in the middle of a word.',
          'The time slide sits higher, so your biggest day’s songs show their full names; a month’s day numbers no longer turn into “…”.',
        ],
      },
    ],
  },
  {
    version: '2.0.14',
    name:    'Tighter stories',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Improved',
        items: [
          'Time listened and your biggest day are one slide now: the bars with your biggest day picked out, this period against the last, and your plays, days with music and time per listening day.',
          'Your top artist and top artists are one slide: number one big, with the rest under it. Same for songs, with as many as fit your screen.',
          '“You heard” lines up your top artists biggest first, from one big photo down to small ones, each with its name.',
        ],
      },
    ],
  },
  {
    version: '2.0.13',
    name:    'Fuller stories',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Improved',
        items: [
          'Story slides fill the screen now: your biggest day comes with the whole period’s bars, time listened with this period against the last, and the listening clock is big.',
          'The intro opens on a wall of your top songs’ covers, and “You heard” shows your top artists’ photos.',
          'Top 5 lists have bigger covers, and long titles get two lines instead of being cut short.',
          'The last slide previews your share card before you send it.',
        ],
      },
    ],
  },
  {
    version: '2.0.12',
    name:    'Story fit',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Fixed',
        items: ['Long song and artist names in stories were cut off. Headlines now shrink just enough to fit, up to three lines.'],
      },
      {
        label: 'Improved',
        items: [
          'Story slides about your top artist and song show a big centred cover, and the background takes its colours from it.',
          'The top-5 slides have a cover next to every name.',
        ],
      },
    ],
  },
  {
    version: '2.0.11',
    name:    'Instant covers',
    date:    '2026-11-20',
    sections: [
      {
        label: 'Improved',
        items: [
          'Covers and artist photos you’ve seen before now show straight away, with no fade-in. Only a brand-new one fades in.',
          'When there’s no picture to find, the app remembers that instead of looking again every time you open it, so the covers it can find arrive sooner.',
          'Clearing the cache in Settings keeps your covers, including the ones you picked by hand.',
        ],
      },
    ],
  },
  {
    version: '2.0.10',
    name:    'Stories',
    date:    '2026-11-20',
    sections: [
      {
        label: 'New',
        items: [
          'Play any period as a story: this week, month or year, all time, or any past week, month or year from Recaps.',
          'Stories have more to show: photos of your top artist and song, your top 5 artists and songs, your biggest day (or month, or year), what kind of listener you are by the clock, and how many artists were new to you.',
          'Share card: the last slide makes a story-sized picture of your period to send anywhere.',
          'Recap notifications open the week, month or year that just ended as a story.',
        ],
      },
      {
        label: 'Fixed',
        items: ['A month’s “biggest day” could name the day before. It now follows your own calendar.'],
      },
    ],
  },
  {
    version: '2.0.9',
    name:    'Covers',
    date:    '2026-11-20',
    sections: [
      {
        label: 'New',
        items: [
          'Every top list has pictures now: artist photos and song and album covers, in Wrapped, Recaps and New to you. The first time they fill in over a minute or so, then they’re instant.',
          'The listening clock is in every view (week, month and year, not just All time), and month, year and All time show which weekday you listen most.',
        ],
      },
    ],
  },
  {
    version: '2.0.8',
    name:    'Glide',
    date:    '2026-11-20',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Scrolling Wrapped no longer stutters, especially in Year and All time. Every card is now built right after the page opens, instead of the moment it scrolls into view.',
        ],
      },
    ],
  },
  {
    version: '2.0.7',
    name:    'Smoother',
    date:    '2026-11-20',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Year and All time in Wrapped no longer hiccup when you open them. Adding up a whole year now happens in the background, and the calendar draws itself in over a few frames instead of all at once. The ripple looks exactly the same.',
        ],
      },
    ],
  },
  {
    version: '2.0.6',
    name:    'Smooth',
    date:    '2026-11-20',
    sections: [
      {
        label: 'Improved',
        items: [
          'Wrapped, Recaps and History stay smooth while they add up your history. The heavy maths now runs on its own, so it never holds up what’s on screen.',
          'Searching History no longer stutters as you type, even across years of plays.',
          'Stats you’ve already seen open instantly, even after restarting the app, until a new play arrives.',
          'The calendar ripples in where you’re looking (around today) instead of starting in January.',
          'History and Recaps have moved to two icons next to the Wrapped title, always one tap away.',
        ],
      },
    ],
  },
  {
    version: '2.0.5',
    name:    'Milestones',
    date:    '2026-11-19',
    sections: [
      {
        label: 'New',
        items: [
          'Streaks in All time: how many days in a row you’ve had music, your longest streak ever, and your longest run with one artist.',
          'Milestones: your 10,000th play, your 100th artist, your 1,000th hour, with the date and the song that got you there, plus how close the next one is.',
          'New to you: the artists and songs you heard for the first time this week, month or year. Tap one to see every play.',
          'On this day: what you played on today’s date in earlier years. Play them again, or add them to your queue, in one tap.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'All time and Recaps no longer freeze the app while they add up years of history. They open on your last numbers and update in place.',
        ],
      },
    ],
  },
  {
    version: '2.0.4',
    name:    'Every day',
    date:    '2026-11-19',
    sections: [
      {
        label: 'New',
        items: [
          'A calendar of your listening: every day of the year as a square, brighter the more you listened. Tap a day to see its total, then “See plays” to open that day in History.',
          'Find it in Wrapped › Year, and in All time with every year you’ve listened.',
          'Each year shows its longest streak of days with music.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Wrapped, Recaps and Story mode now follow your own clock: days and weeks start at your midnight, and the listening clock shows your hours.',
          'All time now includes everything tracked since your import, and works with listening tracking alone, no import needed.',
          'Recaps are built from every play you have, so they’re always current.',
        ],
      },
    ],
  },
  {
    version: '2.0.3',
    name:    'History',
    date:    '2026-11-19',
    sections: [
      {
        label: 'New',
        items: [
          'History: every play you’ve ever had, newest first and grouped by day, with each day’s total. Open it from Wrapped, under Recaps.',
          'Search it all (songs, artists, albums), even across years of imported history.',
          'Tap a play to see every play of that song, everything by that artist, or everything from that album.',
        ],
      },
    ],
  },
  {
    version: '2.0.2',
    name:    'Wake-up call',
    date:    '2026-11-19',
    sections: [
      {
        label: 'Improved',
        items: [
          'When the server is asleep, every screen now says so: “Waking up the server”, with a seconds counter and how long it usually takes (30–60s). Before, only the Lenses list told you.',
          'The app starts waking the server as soon as you open it, so it’s often ready by the time you tap something.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'The colour glow behind the Now Playing sheet no longer jumps back every second. The same fix keeps other glows and waves smooth when a screen updates.',
        ],
      },
    ],
  },
  {
    version: '2.0.1',
    name:    'Spark',
    date:    '2026-11-18',
    sections: [
      {
        label: 'New',
        items: [
          'Meet Spark. He lives in the dot of the wordmark, says hi when you’ve been away a while, and talks when you tap him, sometimes about your week. A little smarter than a rock.',
          'He naps on empty screens. Too chatty? Settings › Experience › Spark: On, Quiet (only when tapped) or Off.',
          'See all his moods in Settings › About › Motion lab.',
        ],
      },
    ],
  },
  {
    version: '2.0',
    name:    'Liquid',
    date:    '2026-11-18',
    sections: [
      {
        label: 'New',
        items: [
          'A whole new look: the app floats in the colours of the song you’re playing, on frosted glass, with a new reading typeface (Manrope) under the Syne headlines.',
          'Playlists are glass tiles now, and Wrapped’s numbers float as bubbles.',
          'A new liquid tab bar: the highlight stretches between tabs like a drop of water.',
          'Story mode: open Wrapped and tap “Play your week” to watch your week as full-screen slides.',
          'Playlists open with their cover flying into place, and the cover collapses smoothly as you scroll.',
          'Numbers roll into place, lists come into focus, adding to the queue throws confetti, and the Now Playing sheet glows in the colours of the cover.',
          'Swipe has real physics now: throw cards, and the next one springs up.',
          'Pull to refresh your lenses and the app’s aperture spins. Try every animation in Settings › About › Motion lab.',
          'A home-screen widget: this week’s listening time, how it compares with last week, your top artist and your last play. Long-press your home screen › Widgets › playlist.lens.',
          'Pick your app icon in Settings › Appearance: the Aperture in all six accent colours.',
          'Crash reports go to your own server, so problems get fixed. See them in Settings › About › Errors.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Every play now lives in a real database on your phone: faster to read, no 20,000-play limit, and the base for 2.0’s history explorer and story mode.',
          'Importing your Spotify history is lighter on memory, and a failed import no longer touches the history you already have.',
          'Re-import your Spotify export once to load every play you’ve ever made into the new database.',
        ],
      },
    ],
  },
  {
    version: '1.9.1',
    name:    'Stopwatch',
    date:    '2026-11-18',
    sections: [
      {
        label: 'New',
        items: [
          'Settings › About › Load times: how fast cold start, Lenses, Wrapped and Recaps open on your phone. These are the numbers 2.0’s faster storage has to beat.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Skipped a few updates? You now get the notes for all of them, not just the latest.',
        ],
      },
    ],
  },
  {
    version: '1.9',
    name:    'All Together',
    date:    '2026-11-18',
    sections: [
      {
        label: 'Improved',
        items: [
          'Every sheet now works the same way: swipe the handle down, tap outside or press back to close. That includes the playlist lens and the start-queue sheet.',
          'The playlist lens keeps its cover and name while it slides away, instead of going blank.',
          'Lenses: your playlist count now sits in the header line (“42 playlists · …”) instead of a bare number beside Settings.',
          'A fresh guided tour: Wrapped always gets its stop, each step says what the tab does today, and it shows which step you’re on.',
          'The login screen has an up-to-date tagline and a clearer line about what’s stored where.',
          'Playlist cards, the login screen, the tour and the start-queue buttons all match the rest of the app.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Screen readers now read playlist cards (name, track count, vibe) and every step of the tour.',
          'Reduce motion now also stills the playlist card entrance, the login glow and the tour spotlight.',
        ],
      },
    ],
  },
  {
    version: '1.8.4',
    name:    'No More Smudge',
    date:    '2026-11-17',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Removed the dark band under the header on Lenses, Queue, Wrapped and Swipe — lists now scroll cleanly, with the background glow running behind them.',
        ],
      },
    ],
  },
  {
    version: '1.8.3',
    name:    'Swipe to Close',
    date:    '2026-11-17',
    sections: [
      {
        label: 'Improved',
        items: [
          'Swipe down on a sheet’s handle to close it — playlist actions, now playing, Wrapped items and the cover fixer.',
          'Sheets keep their content while they slide away, instead of going blank mid-animation.',
          'Clearer text on the in-memoriam line and “Wrong image?” link.',
        ],
      },
    ],
  },
  {
    version: '1.8.2',
    name:    'Clean Sweep',
    date:    '2026-11-17',
    sections: [
      {
        label: 'Improved',
        items: [
          'Queue and Swipe rebuilt on the design system — clearer cards, proper buttons, and the same track rows everywhere.',
          'The start-queue sheet shows a drag handle on each track, so reordering is easy to find.',
          'Swipe’s summary shows kept and cut as stats, with clearer save and trim buttons.',
        ],
      },
    ],
  },
  {
    version: '1.8.1',
    name:    'Finish Line',
    date:    '2026-11-17',
    sections: [
      {
        label: 'Improved',
        items: [
          'Every tab now shares one header, with Settings one tap away from anywhere.',
          'Recaps, Taste, Compare and Flagged covers are rebuilt on the new design system — consistent cards, buttons, spacing and empty states.',
          'Taste can now scan all your playlists from its empty state, instead of sending you off to open them one by one.',
        ],
      },
    ],
  },
  {
    version: '1.8',
    name:    'This Week',
    date:    '2026-11-17',
    sections: [
      {
        label: 'New',
        items: [
          'Wrapped now leads with this week — hours listened, plays, artists and tracks, a day-by-day chart, and your top artists, tracks and albums. Switch between Week, Month and Year, or All time for your imported lifetime stats.',
          'See how you compare: every period shows the change against the same point last week, month or year.',
          'Works without an import — your tracked plays are enough. Turn on listening tracking for complete stats.',
        ],
      },
    ],
  },
  {
    version: '1.7.1',
    name:    'Always Listening',
    date:    '2026-11-17',
    sections: [
      {
        label: 'New',
        items: [
          'Listening tracking — turn it on in Settings › Listening and playlist.lens saves every play hourly, even when the app is closed. Spotify only remembers your last 50, so this is what makes complete weekly and monthly stats possible. Turning it off deletes everything the server saved.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Listening time is now estimated from when you moved on to the next song, so skips no longer count as full plays.',
        ],
      },
    ],
  },
  {
    version: '1.7',
    name:    'Sharp Focus',
    date:    '2026-11-17',
    sections: [
      {
        label: 'New',
        items: [
          'Search your lenses — tap the search button on Your Lenses to find a playlist by name or by who made it.',
          'A brand-new Settings page: your Spotify profile up top, clearer sections with a one-line explanation for every option, and an About section that shows the real version.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Real icons everywhere — the tab bar, buttons, menus and pop-ups now use a proper, consistent icon set (Ionicons) instead of text symbols.',
          'Light mode: the tab bar and queue pill now turn light to match the now-playing bar.',
          'Large system text no longer squashes the tab bar, now-playing bar or queue pill.',
        ],
      },
    ],
  },
  {
    version: '1.6.1',
    name:    'Fine Print',
    date:    '2026-11-17',
    sections: [
      {
        label: 'Improved',
        items: [
          'Play, pause and skip tell you why when Spotify says no — Premium needed, nothing playing, or a reconnect — instead of quietly snapping back.',
          '“＋ all” now tells you how many tracks landed, and the ＋ lets you know when your queue is full.',
          'A friendlier empty library, with a Check again button.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Pull-to-refresh no longer throws away your saved playlists if the refresh fails — you keep your list and get a heads-up.',
          'The floating queue pill is readable again in light mode.',
        ],
      },
    ],
  },
  {
    version: '1.6',
    name:    'Play & Polish',
    date:    '2026-11-17',
    sections: [
      {
        label: 'New',
        items: [
          'Playback controls — tap the now-playing bar for play/pause, previous and next, right from the app.',
          'Play now — start any Rediscovery shelf on Spotify in one tap, without touching your queue.',
          'Drag to reorder — long-press a track in the start-queue sheet to move it.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Every confirmation and heads-up now uses the Liquid Lens look instead of the stock phone pop-up — and “notifications are off” / “photo access needed” come with an Open settings button.',
          'Quick, quiet confirmations (like flagging a cover) show as a small pill instead of interrupting you.',
          'One consistent back button across Settings, Taste, Compare, Recaps and Flagged covers.',
          'Loading placeholders now match your lens layout — grid or list — so nothing jumps when your playlists arrive.',
          'Better screen-reader support: the tab bar, playback, swipe, queue and header buttons are all properly labelled.',
        ],
      },
    ],
  },
  {
    version: '1.5',
    name:    'Custom Queues',
    date:    '2026-06-16',
    sections: [
      {
        label: 'New',
        items: [
          'Custom Queues — build a queue from anywhere and play it straight on your Spotify. There’s a new Queue tab with a queue cart, a ＋ on tracks across the app, and a smart device hand-off (it’ll even wake Spotify for you). Spotify Premium required for playback.',
          'Rediscovery — let the Queue tab resurface music for you: Fading favorites (loved, then forgotten), Second chances (the ones that almost stuck), and a Time machine to a past season.',
          'Pull from your playlists — pick songs out of any playlist straight into your queue.',
          'Recap notifications — opt in from Settings › Recap notifications for a nudge when your weekly, monthly, seasonal or yearly recap is ready.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Compare now lives in a playlist’s long-press menu (“Compare with…”), making room for the Queue tab.',
          'A softer, fading top edge as you scroll — and the now-playing bar no longer covers the bottom of your lists.',
        ],
      },
    ],
  },
  {
    version: '1.4',
    name:    'Rewind & Refresh',
    date:    '2026-06-15',
    sections: [
      {
        label: 'New',
        items: [
          'Recaps — your listening by week, month, season and year, each with its own top artists, tracks and albums. Keep a season as a keepsake, archive a year, and revisit any of them from the Wrapped tab.',
          'Auto-updating Wrapped — your recent plays now top themselves up automatically, so your stats and the current week, month and season stay fresh between imports.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Recaps open straight from the Wrapped tab, with a quick switch between week, month, season and year.',
        ],
      },
    ],
  },
  {
    version: '1.3.1',
    name:    'Faces & Facets',
    date:    '2026-06-14',
    sections: [
      {
        label: 'New',
        items: [
          'Real artist faces — Wrapped now shows actual artist photos instead of album-cover stand-ins.',
          'Tap to go deeper, everywhere — open the full panel for any artist straight from your Taste profile and an expanded playlist, just like Wrapped already does.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Tidied the expanded-playlist stats — the duration now lines up neatly with the numbers beside it.',
        ],
      },
    ],
  },
  {
    version: '1.3',
    name:    'Pulse & Lively',
    date:    '2026-06-14',
    sections: [
      {
        label: 'New',
        items: [
          'Now playing — a live bar shows the track you’re streaming on Spotify. Tap it for your personal play count, listening time and rank for that song.',
          'Swipe to refresh — tidy any playlist Tinder-style with 30-second previews. Swipe to keep or cut, then save the keepers as a new playlist or trim the original (a backup is made first). Nothing changes until you confirm.',
          'Guided tour — a hands-on walkthrough that spotlights each part of the app and steps you through it. Replay anytime from Settings › Replay tutorial.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Place the now-playing bar where you like it — above the tab bar or up top on the Lenses screen (Settings › Appearance › Now playing).',
          'Reconnect Spotify right where you need it — an inline prompt on the now-playing bar and the Swipe tab, plus a permanent entry in Settings.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'No more surprise logouts — your session now refreshes quietly in the background.',
          'Cleaning up a playlist no longer disturbs your lens analyses or Compare.',
        ],
      },
    ],
  },
  {
    version: '1.2',
    name:    'Expressive Expressions',
    date:    '2026-06-11',
    sections: [
      {
        label: 'New',
        items: [
          'Light mode — a bright new theme for the whole app. Flip between Dark and Light in Settings › Appearance.',
          'Accent colours — six to choose from. Your pick flows through every screen, button and highlight.',
          'Fonts — swap the body typeface (DM Mono, Space Mono or IBM Plex Mono). The playlist.lens wordmark and headers stay on-brand.',
          'Pick your navigation — the floating bar, a minimal icons-only pill, or no bar at all (swipe anywhere to switch tabs).',
          'Grid or list — view your lenses as full-width cards or a compact two-column grid, toggled right on the Lenses screen.',
          'Custom home banner — add your own line to the home screen’s rotating tips.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Everything you pick is saved instantly and applies with a quick restart — accent, font, theme and navigation all in one new Appearance section.',
          'Your accent automatically adapts between dark and light so it always stays readable.',
        ],
      },
    ],
  },
  {
    version: '1.1',
    name:    'Polish & Power',
    date:    '2026-06-09',
    sections: [
      {
        label: 'New',
        items: [
          'Wrapped — import your lifetime Spotify history for all-time stats. Tap any artist, track or album for its own art panel.',
          'Over-the-air updates — fixes and features now arrive without reinstalling the app.',
          'Drag-to-reorder your lenses, plus long-press for quick actions: Pin to top, Share, Re-analyze.',
          'Fix a wrong cover yourself: pick a candidate, re-search, or upload your own image.',
          'New Settings: reduce motion, show artwork, clear Wrapped history, and a flagged-covers list.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'A new floating navbar that auto-hides as you scroll, with a cleaner icon set and bouncier feel.',
          'Livelier ambient backgrounds and a stat-aware tips strip on the home screen.',
          'Springier, more tactile presses across the whole app.',
          'An on-brand prompt when an update is ready (bye, stock popup).',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Deleted Spotify playlists now quietly remove themselves instead of erroring.',
          'Artist artwork matches the right artist (Tyler, Kendrick and friends).',
          'The home tips strip no longer jumps around when you pull to refresh.',
          'The “upload your own cover” button is no longer hidden behind the navbar.',
        ],
      },
    ],
  },
]

const SEEN_KEY = 'patch_seen_version'
const TUT_KEY  = 'tutorial_seen_v1'

export function latestPatch(): PatchEntry { return CHANGELOG[0] }

// ── Patch notes ──
export function shouldShowWhatsNew(): boolean {
  const seen = storage.getString(SEEN_KEY)
  if (seen === undefined) return false      // fresh install → tutorial handles first-run
  return seen !== latestPatch().version
}
export function markWhatsNewSeen(): void { storage.set(SEEN_KEY, latestPatch().version) }

/** -1 / 0 / 1 for dotted versions: "1.9" > "1.8.7", "1.9.1" > "1.9". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

/**
 * Every entry newer than the one last seen (newest first, at most `max`), so jumping
 * several updates at once shows all their notes — not just the top one. Compared by
 * version, so a seen version that's since been merged away still works.
 */
export function unseenPatches(max = 5): PatchEntry[] {
  const seen = storage.getString(SEEN_KEY)
  const newer = seen ? CHANGELOG.filter(p => compareVersions(p.version, seen) > 0) : []
  return (newer.length ? newer : [latestPatch()]).slice(0, max)
}

// ── Tutorial ──
export function shouldShowTutorial(): boolean { return storage.getBoolean(TUT_KEY) !== true }
export function markTutorialSeen(): void {
  storage.set(TUT_KEY, true)
  // Prevent the patch-notes popup from firing right after onboarding.
  if (storage.getString(SEEN_KEY) === undefined) storage.set(SEEN_KEY, latestPatch().version)
}
export function replayTutorial(): void { storage.set(TUT_KEY, false) }
