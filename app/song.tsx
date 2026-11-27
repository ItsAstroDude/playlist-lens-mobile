import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ItemPage } from '@/components/item/ItemPage'

/** A song's page: /song?name=…&artist=… (2.0.43). */
export default function SongScreen() {
  const { name, artist } = useLocalSearchParams<{ name?: string; artist?: string }>()
  return <ItemPage item={{ kind: 'track', track: name ?? '', artist: artist ?? '' }} />
}
