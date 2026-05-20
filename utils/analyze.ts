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
  const topArtists: ArtistCount[] = Object.entries(artistTally)
    .map(([id, { name, count }]) => ({ id, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ── Genre counts (weighted by artist appearance count) ──
  const genreTally: Record<string, number> = {}
  for (const [id, { count }] of Object.entries(artistTally)) {
    for (const genre of genreMap[id] || []) {
      genreTally[genre] = (genreTally[genre] || 0) + count
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
  const decadeTally: Record<string, number> = {}
  for (const track of tracks) {
    const year = parseInt(track.album?.release_date?.split('-')[0] ?? '0', 10)
    if (year > 0) {
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
    vibe:       audioFeatures ? computeVibe(audioFeatures) : null,
    cachedAt:   Date.now(),
  }
}

// ─── Vibe classification ──────────────────────────────────────────────────────
// Scores each label across multiple dimensions instead of hard if-else thresholds,
// so every playlist gets the most fitting label rather than falling through to
// "Eclectic mix" whenever it sits between two zones.
function computeVibe(af: AudioProfile): string {
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
