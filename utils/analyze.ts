import type {
  SpotifyTrack,
  SpotifyAudioFeatures,
  PlaylistAnalysis,
  PlaylistPalette,
  ArtistCount,
  GenreCount,
  AudioProfile,
  DecadeCount,
  PopBucket,
} from '@/types'

// ─── Main builder ─────────────────────────────────────────────────────────────
export function buildAnalysis(
  playlistId:   string,
  playlistName: string,
  coverUrl:     string,
  palette:      PlaylistPalette | null,
  tracks:       SpotifyTrack[],
  features:     SpotifyAudioFeatures[],
  genreMap:     Record<string, string[]>,
): PlaylistAnalysis {

  // ── Artist counts ──
  const artistTally: Record<string, { name: string; count: number }> = {}
  for (const track of tracks) {
    for (const artist of track.artists) {
      if (!artistTally[artist.id]) artistTally[artist.id] = { name: artist.name, count: 0 }
      artistTally[artist.id].count++
    }
  }
  // Keep a deep list (not just top 10) so the cross-playlist taste aggregate
  // isn't biased toward artists concentrated in a single playlist. The detail
  // view slices this down to 6 for display.
  const topArtists: ArtistCount[] = Object.entries(artistTally)
    .map(([id, { name, count }]) => ({ id, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  // ── Genre counts (weighted by artist appearance count, deduplicated) ──
  const genreTally: Record<string, number> = {}
  for (const [id, { count }] of Object.entries(artistTally)) {
    for (const genre of genreMap[id] || []) {
      const key = normalizeGenre(genre)
      genreTally[key] = (genreTally[key] || 0) + count
    }
  }
  const topGenres: GenreCount[] = Object.entries(genreTally)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16)

  // ── Audio profile (averaged) ──
  let audioFeatures: AudioProfile | null = null
  if (features.length > 0) {
    const n   = features.length
    const sum = features.reduce(
      (acc, f) => ({
        danceability:     acc.danceability     + f.danceability,
        energy:           acc.energy           + f.energy,
        valence:          acc.valence          + f.valence,
        acousticness:     acc.acousticness     + f.acousticness,
        instrumentalness: acc.instrumentalness + f.instrumentalness,
        liveness:         acc.liveness         + f.liveness,
        tempo:            acc.tempo            + f.tempo,
      }),
      { danceability: 0, energy: 0, valence: 0, acousticness: 0, instrumentalness: 0, liveness: 0, tempo: 0 },
    )
    audioFeatures = {
      danceability:     sum.danceability     / n,
      energy:           sum.energy           / n,
      valence:          sum.valence          / n,
      acousticness:     sum.acousticness     / n,
      instrumentalness: sum.instrumentalness / n,
      liveness:         sum.liveness         / n,
      avgTempo:         sum.tempo            / n,
    }
  }

  // ── Decade distribution ──
  // Spotify returns 1900 / 0000 as a placeholder for unknown or local-file
  // release dates — exclude those (and any out-of-range junk) so we don't show
  // a bogus "1900s" bucket.
  const decadeTally: Record<string, number> = {}
  const nowYear = new Date().getFullYear()
  for (const track of tracks) {
    const year = parseInt(track.album?.release_date?.split('-')[0] ?? '0', 10)
    if (year > 1900 && year <= nowYear + 1) {
      const label = `${Math.floor(year / 10) * 10}s`
      decadeTally[label] = (decadeTally[label] || 0) + 1
    }
  }
  const decades: DecadeCount[] = Object.entries(decadeTally)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // ── Popularity buckets ──
  const bucketLabels = ['0–20', '21–40', '41–60', '61–80', '81–100']
  const buckets      = [0, 0, 0, 0, 0]
  for (const track of tracks) {
    const idx = Math.min(Math.floor(track.popularity / 20), 4)
    buckets[idx]++
  }
  const popBuckets: PopBucket[] = bucketLabels.map((label, i) => ({ label, count: buckets[i] }))

  // ── Scalar stats ──
  const totalMs    = tracks.reduce((s, t) => s + (t.duration_ms ?? 0), 0)
  const avgPop     = tracks.length > 0
    ? Math.round(tracks.reduce((s, t) => s + t.popularity, 0) / tracks.length)
    : 0
  const artistCount = new Set(tracks.flatMap(t => t.artists.map(a => a.id))).size

  return {
    playlistId,
    playlistName,
    coverUrl,
    palette,
    tracks,
    topArtists,
    topGenres,
    audioFeatures,
    decades,
    popBuckets,
    totalMs,
    avgPop,
    avgTrackMs: tracks.length > 0 ? totalMs / tracks.length : 0,
    artistCount,
    vibe:       audioFeatures ? computeVibe(audioFeatures) : computeVibeFromGenres(topGenres),
    cachedAt:   Date.now(),
  }
}

// ─── Vibe classification ──────────────────────────────────────────────────────
// Scores each label across multiple dimensions instead of hard if-else thresholds,
// so every playlist gets the most fitting label rather than falling through to
// "Eclectic mix" whenever it sits between two zones.
export function computeVibe(af: AudioProfile): string {
  const { energy, valence, danceability, acousticness, instrumentalness } = af

  const scores: [string, number][] = [
    ['💃 Made to move',      danceability * 1.4 + energy * 0.4 - acousticness * 0.3],
    ['⚡ High energy & happy', energy * 1.2 + valence * 1.0 - acousticness * 0.4],
    ['🌑 Intense & dark',    energy * 1.2 + (1 - valence) * 1.0 - acousticness * 0.5],
    ['☀️ Chill & positive',  valence * 1.1 + (1 - energy) * 0.9 + acousticness * 0.3],
    ['🌙 Melancholic & calm',(1 - valence) * 1.1 + (1 - energy) * 0.9 + acousticness * 0.2],
    ['🎸 Raw & organic',     acousticness * 1.5 + (1 - danceability) * 0.4],
    ['🎹 Instrumental',      instrumentalness * 2.0 + (1 - valence) * 0.3],
    ['🎉 Feel-good & upbeat',valence * 1.0 + danceability * 0.8 + energy * 0.5],
  ]

  return scores.sort((a, b) => b[1] - a[1])[0][0]
}

// ─── Genre normalisation ──────────────────────────────────────────────────────
// Spotify returns many near-duplicate genre strings ("j-pop", "jpop",
// "japanese pop"; "hip hop" vs "hip-hop"; "r&b" vs "rnb", etc.).
// Normalise to a canonical form before tallying so they merge correctly.
export function normalizeGenre(raw: string): string {
  let g = raw.toLowerCase().trim()

  // Collapse whitespace & unify punctuation
  g = g.replace(/\s+/g, ' ')
  g = g.replace(/[–—]/g, '-')

  // Strip common trailing noise words
  g = g.replace(/\s+(music|sounds?)$/, '')

  // Apply canonical synonym map (order: most-specific first)
  const MAP: Record<string, string> = {
    // J-Pop
    'jpop':          'j-pop',
    'j pop':         'j-pop',
    'japanese pop':  'j-pop',
    // K-Pop
    'kpop':          'k-pop',
    'k pop':         'k-pop',
    'korean pop':    'k-pop',
    // R&B
    'rnb':                 'r&b',
    'r and b':             'r&b',
    'rhythm and blues':    'r&b',
    // Hip-hop
    'hip hop':       'hip-hop',
    'hiphop':        'hip-hop',
    // Lo-fi
    'lofi':          'lo-fi',
    'lo fi':         'lo-fi',
    'lo-fi beats':   'lo-fi',
    'lofi beats':    'lo-fi',
    // Drum & bass
    'drum & bass':   'drum and bass',
    'drum n bass':   'drum and bass',
    'dnb':           'drum and bass',
    'd&b':           'drum and bass',
    // Electronic
    'electronica':   'electronic',
    // EDM variants
    'electronic dance':  'edm',
    // Synthwave aliases
    'retrowave':     'synthwave',
    'outrun':        'synthwave',
    // Bedroom pop aliases
    'bedroom pop':   'lo-fi',
    // Classical
    'orchestral':    'classical',
    'orchestra':     'classical',
    // Anime
    'anime ost':     'anime',
    'anime score':   'anime',
    'anime soundtrack': 'anime',
    // Vocaloid
    'vocaloid':      'vocaloid',   // already canonical, block re-suffixing
  }

  return MAP[g] ?? g
}

// ─── Genre-based vibe fallback ────────────────────────────────────────────────
// Used when Spotify audio features are unavailable (deprecated for newer apps).
// Checks top genre names against keyword clusters, ordered most-specific first.
export function computeVibeFromGenres(genres: GenreCount[]): string | null {
  if (genres.length === 0) return null

  // Build a single text string from the top genres weighted by count
  // (repeat high-frequency genres so they match more strongly)
  const max  = genres[0].count
  const text = genres.slice(0, 12).flatMap(g => {
    const times = Math.max(1, Math.round((g.count / max) * 3))
    return Array<string>(times).fill(g.genre.toLowerCase())
  }).join(' ')

  // Ordered most-specific → most-general to avoid false positives
  if (/metal|hardcore|grunge|screamo|heavy/.test(text))                   return '🌑 Intense & dark'
  if (/classical|orchestra|chamber|opera|piano|ambient|new age/.test(text)) return '🎹 Instrumental'
  if (/acoustic|folk|singer.?songwriter|country|bluegrass|americana/.test(text)) return '🎸 Raw & organic'
  if (/hip.?hop|trap|rap|drill|grime/.test(text))                         return '💃 Made to move'
  if (/house|techno|edm|electronic|drum.?and.?bass|dnb|club|trance/.test(text)) return '💃 Made to move'
  if (/lo.?fi|shoegaze|dream pop|slowcore|post.?rock|darkwave/.test(text)) return '🌙 Melancholic & calm'
  if (/chill|reggae|bossa|lounge|tropical|beach|surf/.test(text))         return '☀️ Chill & positive'
  if (/jazz|soul|funk|neo soul|r&b|rnb/.test(text))                       return '🎉 Feel-good & upbeat'
  if (/rock|punk|alternative|indie rock|garage/.test(text))               return '⚡ High energy & happy'
  if (/pop|k.?pop|j.?pop|dance pop|electropop|synthpop/.test(text))      return '🎉 Feel-good & upbeat'
  if (/indie|bedroom pop|dream/.test(text))                               return '🌙 Melancholic & calm'

  return null
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
export function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h        = Math.floor(totalMin / 60)
  const m        = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fmtTempo(bpm: number): string {
  return `${Math.round(bpm)} BPM`
}
