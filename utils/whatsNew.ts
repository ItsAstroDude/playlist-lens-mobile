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
    version: '2.0.46',
    name:    'Everything at a glance',
    date:    '2026-11-26',
    sections: [
      {
        label: 'Improved',
        items: [
          'Lenses: nothing to open any more. The lens shows its top artists with their photos, fame and how it spreads from deep cuts to hits, how much of it you played this month, every decade and all its genres, right there.',
          'One tap to an artist: tap an artist in a lens or in Taste and their page opens straight away (artists you haven’t played yet still get the quick card).',
          'Artist and song pages: the colour behind the picture fades into the page, so there’s no line above the buttons.',
        ],
      },
    ],
  },
  {
    version: '2.0.45',
    name:    'Out of the way',
    date:    '2026-11-26',
    sections: [
      {
        label: 'Fixed',
        items: [
          'The tab bar steps aside whenever a sheet is open, so it no longer covers a sheet’s buttons or the end of its list. Scrolling Lenses no longer brings it back over an open lens.',
          'Now playing full screen no longer shifts after you half fold the phone and open it flat again. The top half could slide up by about 100 points for no reason.',
          'Opening the phone from the cover screen: Now playing full screen (and other screens) are laid out for the main screen right away, not squeezed into the cover screen’s size.',
        ],
      },
    ],
  },
  {
    version: '2.0.44',
    name:    'Pages everywhere',
    date:    '2026-11-25',
    sections: [
      {
        label: 'New',
        items: [
          'Stories: slides about an artist or a song have a “Your page” button at the top. The story waits while you look and carries on when you come back.',
          'Play: when a game ends, the artists and songs it used are right there to open.',
          'Flip cover screen: tap the song’s title, its artist or your numbers in the player to open their pages, which fit the cover screen with the cover beside the title.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Artist and song pages: the picture runs up to the top of the screen, and the name slides in beside the back button as you scroll.',
        ],
      },
    ],
  },
  {
    version: '2.0.43',
    name:    'Artist and song pages',
    date:    '2026-11-25',
    sections: [
      {
        label: 'New',
        items: [
          'Tap any artist or song in Rewind, Recaps or History to open its own page: your time and plays with it, the day you found it, how you’ve listened over the months, and where it ranks among everything you play.',
          'Artist pages show your top songs and albums by them, when you play them (hour and weekday), your longest run of days with them and your biggest day. Play your top 10 or add them to the queue in one tap.',
          'Song pages show how often you’ve had it on repeat, with the day you played it most. Tap the artist to go to their page.',
          'Now playing opens the song’s and the artist’s pages, and Taste and your lenses link to an artist’s page when you’ve played them.',
        ],
      },
    ],
  },
  {
    version: '2.0.42',
    name:    'Rewind',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'Wrapped is now called Rewind. Same stats, still in Settings › About › Labs while it’s rebuilt.',
          'Settings › About › Privacy policy: what playlist.lens stores, where, and how to delete it.',
          'Settings › About › Send crash reports: switch it off and errors stay on your phone.',
          'Logging out while listening tracking is on now asks whether to keep tracking or stop it and delete your saved plays from the server.',
        ],
      },
    ],
  },
  {
    version: '2.0.41',
    name:    'Room to grow',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Up next: after the queue, the song\'s stats no longer run into the title. On a flat phone the top half moves up to make room. Half-folded, the 12-month bars are left out so it fits under the hinge.',
          '"1 plays" now says "1 play".',
        ],
      },
    ],
  },
  {
    version: '2.0.40',
    name:    'All the games',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'Play: the four games sit one under the other now. Press Play on one and it gets the screen, with "all games" to go back.',
          'Up next: after the queue, the song\'s stats fill the space. You get your last 12 months with it as bars, and how its artist ranks for you. Dates no longer get cut off.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Up next: dropping a song no longer shrinks the count ("2 of 10" stays out of 10), and "look at the queue again" brings dropped songs back, marked, so you can keep them after all.',
        ],
      },
    ],
  },
  {
    version: '2.0.39',
    name:    'Game night',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Play has three new games next to More or less. Blind five: five seconds of one of your top songs, so name it fast. Rank it: put five of your artists in order, with a new five every day. When?: find the month you were most into a song.',
          'Lenses: the lens sheet is now a bento of tiles (sound, top artist, eras, fame, how much of it you played this month, genres). Tap a tile to open it in full. Play is right in the header.',
        ],
      },
    ],
  },
  {
    version: '2.0.38',
    name:    'One row',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'Up next: the controls are one row now (drop, previous, play, next, keep), with the song that\'s playing and the seeker above them.',
          'Through the queue, the song\'s row grows upwards into its stats instead of swapping cards.',
          'Flex panel: the flat half is now a deck remote. Swipe the next song away or keep it, with the same row of controls under it.',
          'Now playing full screen shows up next only (the "now" layout and its switch are gone).',
        ],
      },
    ],
  },
  {
    version: '2.0.37',
    name:    'After the queue',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Up next: once you\'ve been through the queue, the card turns to the song that\'s playing: which play this is for you, time listened, plays this week, when you first heard it and its all-time rank.',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'This week\'s tiles update right after a sync (they kept saying "nothing tracked yet"), and with tracking on they no longer tell you to turn it on.',
          'A playlist you closed no longer sits stuck in the lower half after unfolding the phone. Closed sheets are now unloaded, too.',
        ],
      },
    ],
  },
  {
    version: '2.0.36',
    name:    'Instant',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'Everything you\'ve seen before shows up straight away, even after days away, and refreshes quietly behind the scenes. No more skeletons while the server wakes up.',
          'Swipe: saving your keeps as a new playlist, or trimming the original, is done the moment you tap. It goes to Spotify in the background and keeps trying (even after a restart) until it lands.',
          'Now playing full screen: one up-next layout (the card over the touch strip). The switch is now · up next.',
        ],
      },
    ],
  },
  {
    version: '2.0.35',
    name:    'Flex panel',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Fold the Flip like a laptop and whatever you\'re looking at moves to the top half. The bottom half becomes a music remote: the song, its progress, and a big touch pad (tap to pause, swipe to skip). The expand button opens Now playing full screen.',
          'Nothing playing? Tap the pad to pick up where Spotify left off.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Folding no longer jumps straight to Now playing full screen (the cover button and the panel\'s expand button open it). Prefer the old way? Settings › About › Labs › Open Now playing when you fold.',
        ],
      },
    ],
  },
  {
    version: '2.0.34',
    name:    'Now playing, full screen',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Tap the cover button on Lenses and Now playing opens full screen: the layouts made for the half fold, now on a flat phone too. The song on the top half, controls or up next on the bottom half; switch with now · 1 · 2 at the top right, close with the arrow or back.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'The small cards that drop out of the cover button with news stay as they were.',
        ],
      },
    ],
  },
  {
    version: '2.0.33',
    name:    'Up next, fixed',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Half-folded up next: a dropped song stays dropped (it used to come straight back), Play now takes the card off at once, the song already playing never shows as up next, and the old card no longer flashes back between swipes.',
          'Half-folded: no grey flash in the background when the song changes.',
          'After resizing the app with Samsung\'s pop-up / resize feature, playlist cards and the cover-screen bento fill the space properly again (they were sized for the old window).',
        ],
      },
    ],
  },
  {
    version: '2.0.32',
    name:    'Clean open',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Drop card: no more dark flash on the cover button as it opens. The cover is ready before the card starts to grow, the card fades in as it grows instead of covering the button, and it no longer jumps in height on the way.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Half-folded Lenses is back to normal: the big "stage" from 2.0.31 is gone, and folding while a song plays opens the full half-folded view by itself again. Folded, the cover button opens it too.',
        ],
      },
    ],
  },
  {
    version: '2.0.31',
    name:    'Half-folded Lenses',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Half-fold the phone on Lenses and it splits at the fold: your header and a stage on the half that stands up, your playlists scrolling on the flat half. The stage shows the song playing (cover, progress, play/pause), or this week\'s hours, top artist and streak when nothing plays.',
          'Half-folded, the cover button (or the stage) opens the full half-folded view: now playing, or up next as layout 1 or 2.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'The full half-folded view no longer takes over the moment you fold, so Lenses can show its own layout. Want it back? Settings › About › Labs › Open the full view when you fold.',
        ],
      },
    ],
  },
  {
    version: '2.0.30',
    name:    'No more flicker',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Drop card: the song and controls fade in as the card opens (they used to wait about a second and pop in), and fade out as it closes instead of hanging on while it shrinks.',
        ],
      },
    ],
  },
  {
    version: '2.0.29',
    name:    'Drop card, smoother',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'Drop card: the cover now travels from the little round button to its place on the card (and back when it closes), the words and then the controls rise in after it, and the button only comes back once the card has folded into it.',
        ],
      },
    ],
  },
  {
    version: '2.0.28',
    name:    'Up next, folded',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Half-folded: two new "up next" layouts to try, switchable in the view (now · 1 · 2, top right) or in Labs. The half that stands up shows the song and what plays next, with when each one starts. On the flat half the next song is a card: swipe it left to drop it, right to keep it, up to play it now.',
          'Layout 1 puts a touch strip under the card (tap to pause, swipe to skip). Layout 2 puts the card on a touch pad: touch round the card for playback, the card itself for the queue.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Drop card: it now opens out of the cover button and folds back into it, stays below the status bar, and its "lately" list no longer repeats the song that\'s playing.',
        ],
      },
    ],
  },
  {
    version: '2.0.27',
    name:    'Cover player',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Flip cover screen: Now playing fills the screen, like Samsung\'s Now Bar. The cover behind everything, the device that\'s playing on top, the title scrolling when it\'s long, a progress line with times and big round controls. Your numbers for the song sit beside the cameras. Close it with the arrow, back, or a swipe down.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Cover screen Lenses: with nothing tracked yet, the week tiles become one tile with a way into Settings instead of an empty box.',
        ],
      },
    ],
  },
  {
    version: '2.0.26',
    name:    'Drop card',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Now playing › Header button (it replaces Home strip): on Lenses the song becomes a cover button next to settings, with a ring that fills as it plays. When something happens — a new song, "added to queue" — a small card drops out of it, says it, and goes back in.',
          'Tap the cover button and it opens into the whole card: the song, controls, your numbers for it, and what happened lately.',
          'Flip cover screen: Lenses is a bento. A big tile for the song playing (tap it for Now playing, or play/pause right there), this week\'s hours and plays, your top artist and streak, then your playlists three across.',
        ],
      },
    ],
  },
  {
    version: '2.0.25',
    name:    'Back to the bar',
    date:    '2026-11-23',
    sections: [
      {
        label: 'Improved',
        items: [
          'The floating spot is gone for now: the now-playing bar, toasts and the server wake-up banner are back as they were in 2.0.22. A better idea is being worked out first.',
        ],
      },
    ],
  },
  {
    version: '2.0.22',
    name:    'Half-folded',
    date:    '2026-11-23',
    sections: [
      {
        label: 'New',
        items: [
          'Galaxy Z Flip: stand the phone half-folded on a table while a song plays and Now playing splits at the fold. The cover and the song on the half that stands up, big controls and your numbers for the song on the half lying flat. Open the phone flat to go back. (Needs the next app install; until then, try it with Simulate half-folded in Settings › About › Labs.)',
          'Cover screen: Now playing fits. The cover sits beside the title, your stats fit on one line, and everything stays clear of the cameras. Hold the cover to open the song in Spotify.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Cover screen: stories, the sign-in screen and the fix-artwork sheet are sized for the screen you are on, instead of the one the app opened on.',
        ],
      },
    ],
  },
  {
    version: '2.0.21',
    name:    'Cover screen',
    date:    '2026-11-21',
    sections: [
      {
        label: 'New',
        items: [
          'Galaxy Z Flip: the app fits the cover screen. A compact header, a small tab strip in the free corner (or swipe anywhere to change tab), and playlist cards that use the full width.',
          'On the cover screen a ring round the cameras fills as your song plays. Tap round the cameras to open Now playing.',
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
          'Rewind is being rebuilt to scroll smoothly. Until then it lives in Settings › About › Labs, and stories, recaps and history keep working as before.',
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
    name:    'Smooth Rewind',
    date:    '2026-11-21',
    sections: [
      {
        label: 'Fixed',
        items: [
          'Rewind Year and All time scroll smoothly. Once their rows, heatmap and numbers have finished animating in, they stop costing work on every scroll, here and on every other tab.',
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
          'Every top list has pictures now: artist photos and song and album covers, in Rewind, Recaps and New to you. The first time they fill in over a minute or so, then they’re instant.',
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
          'Scrolling Rewind no longer stutters, especially in Year and All time. Every card is now built right after the page opens, instead of the moment it scrolls into view.',
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
          'Year and All time in Rewind no longer hiccup when you open them. Adding up a whole year now happens in the background, and the calendar draws itself in over a few frames instead of all at once. The ripple looks exactly the same.',
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
          'Rewind, Recaps and History stay smooth while they add up your history. The heavy maths now runs on its own, so it never holds up what’s on screen.',
          'Searching History no longer stutters as you type, even across years of plays.',
          'Stats you’ve already seen open instantly, even after restarting the app, until a new play arrives.',
          'The calendar ripples in where you’re looking (around today) instead of starting in January.',
          'History and Recaps have moved to two icons next to the Rewind title, always one tap away.',
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
          'Find it in Rewind › Year, and in All time with every year you’ve listened.',
          'Each year shows its longest streak of days with music.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Rewind, Recaps and Story mode now follow your own clock: days and weeks start at your midnight, and the listening clock shows your hours.',
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
          'History: every play you’ve ever had, newest first and grouped by day, with each day’s total. Open it from Rewind, under Recaps.',
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
          'Playlists are glass tiles now, and Rewind’s numbers float as bubbles.',
          'A new liquid tab bar: the highlight stretches between tabs like a drop of water.',
          'Story mode: open Rewind and tap “Play your week” to watch your week as full-screen slides.',
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
          'Settings › About › Load times: how fast cold start, Lenses, Rewind and Recaps open on your phone. These are the numbers 2.0’s faster storage has to beat.',
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
          'A fresh guided tour: Rewind always gets its stop, each step says what the tab does today, and it shows which step you’re on.',
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
          'Removed the dark band under the header on Lenses, Queue, Rewind and Swipe — lists now scroll cleanly, with the background glow running behind them.',
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
          'Swipe down on a sheet’s handle to close it — playlist actions, now playing, Rewind items and the cover fixer.',
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
          'Rewind now leads with this week — hours listened, plays, artists and tracks, a day-by-day chart, and your top artists, tracks and albums. Switch between Week, Month and Year, or All time for your imported lifetime stats.',
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
          'Recaps — your listening by week, month, season and year, each with its own top artists, tracks and albums. Keep a season as a keepsake, archive a year, and revisit any of them from the Rewind tab.',
          'Auto-updating Rewind — your recent plays now top themselves up automatically, so your stats and the current week, month and season stay fresh between imports.',
        ],
      },
      {
        label: 'Improved',
        items: [
          'Recaps open straight from the Rewind tab, with a quick switch between week, month, season and year.',
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
          'Real artist faces — Rewind now shows actual artist photos instead of album-cover stand-ins.',
          'Tap to go deeper, everywhere — open the full panel for any artist straight from your Taste profile and an expanded playlist, just like Rewind already does.',
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
          'Rewind — import your lifetime Spotify history for all-time stats. Tap any artist, track or album for its own art panel.',
          'Over-the-air updates — fixes and features now arrive without reinstalling the app.',
          'Drag-to-reorder your lenses, plus long-press for quick actions: Pin to top, Share, Re-analyze.',
          'Fix a wrong cover yourself: pick a candidate, re-search, or upload your own image.',
          'New Settings: reduce motion, show artwork, clear Rewind history, and a flagged-covers list.',
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
