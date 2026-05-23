import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Polygon, Line, Circle } from 'react-native-svg'
import { Colors, FontFamily, FontSize } from '@/constants/theme'

// ─── Axis config ──────────────────────────────────────────────────────────────
const AXES = ['Acoustic', 'Dance', 'Energy', 'Valence', 'Instru.', 'Live'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toPoint(axisIdx: number, fraction: number, cx: number, cy: number, maxR: number) {
  const angle = (axisIdx * 60 - 90) * (Math.PI / 180)
  return {
    x: cx + maxR * fraction * Math.cos(angle),
    y: cy + maxR * fraction * Math.sin(angle),
  }
}

function polyPoints(fraction: number, cx: number, cy: number, maxR: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map(i => toPoint(i, fraction, cx, cy, maxR))
    .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
}

function dataPoints(values: number[], cx: number, cy: number, maxR: number): string {
  return values
    .map((v, i) => toPoint(i, Math.max(0.05, Math.min(1, v)), cx, cy, maxR))
    .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
}

// ─── Label positions (outside the hex, with padding) ─────────────────────────
// Each axis pushes the label further out with a small offset per axis.
const LABEL_EXTRA = 18  // additional distance beyond maxR
function labelPos(axisIdx: number, cx: number, cy: number, maxR: number) {
  const angle = (axisIdx * 60 - 90) * (Math.PI / 180)
  const r     = maxR + LABEL_EXTRA
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RadarChartProps {
  acousticness:     number
  danceability:     number
  energy:           number
  valence:          number
  instrumentalness: number
  liveness:         number
  color:            string
  size?:            number
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RadarChart({
  acousticness,
  danceability,
  energy,
  valence,
  instrumentalness,
  liveness,
  color,
  size = 200,
}: RadarChartProps) {
  const CX   = size / 2
  const CY   = size / 2
  const MAXR = size * 0.34   // leaves room for labels

  const values = [acousticness, danceability, energy, valence, instrumentalness, liveness]

  const GRID_RINGS = [0.25, 0.5, 0.75, 1.0]

  return (
    <View style={[styles.container, { width: size + 40, height: size + 40 }]}>
      <Svg width={size + 40} height={size + 40} viewBox={`-20 -20 ${size + 40} ${size + 40}`}>

        {/* Grid rings */}
        {GRID_RINGS.map((r, i) => (
          <Polygon
            key={`ring-${i}`}
            points={polyPoints(r, CX, CY, MAXR)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Axis spokes */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const p = toPoint(i, 1, CX, CY, MAXR)
          return (
            <Line
              key={`spoke-${i}`}
              x1={CX}
              y1={CY}
              x2={p.x.toFixed(2)}
              y2={p.y.toFixed(2)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon fill */}
        <Polygon
          points={dataPoints(values, CX, CY, MAXR)}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* Data points */}
        {values.map((v, i) => {
          const p = toPoint(i, Math.max(0.05, Math.min(1, v)), CX, CY, MAXR)
          return (
            <Circle
              key={`pt-${i}`}
              cx={p.x.toFixed(2)}
              cy={p.y.toFixed(2)}
              r={3}
              fill={color}
            />
          )
        })}

      </Svg>

      {/* Labels — positioned absolutely around the SVG */}
      {AXES.map((label, i) => {
        const lp = labelPos(i, CX, CY, MAXR)
        // Center label horizontally/vertically relative to its position
        const isLeft  = lp.x < CX - 5
        const isRight = lp.x > CX + 5
        const align: 'center' | 'left' | 'right' = isLeft ? 'right' : isRight ? 'left' : 'center'
        return (
          <Text
            key={label}
            style={[
              styles.axisLabel,
              {
                position:  'absolute',
                left:      lp.x + 20 - (isLeft ? 52 : isRight ? 0 : 26),
                top:       lp.y + 20 - 7,
                textAlign: align,
              },
            ]}
          >
            {label}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    width:      52,
  },
})
