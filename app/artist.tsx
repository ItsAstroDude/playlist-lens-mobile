import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ItemPage } from '@/components/item/ItemPage'

/** An artist's page: /artist?name=… (2.0.43). */
export default function ArtistScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>()
  return <ItemPage item={{ kind: 'artist', artist: name ?? '' }} />
}
