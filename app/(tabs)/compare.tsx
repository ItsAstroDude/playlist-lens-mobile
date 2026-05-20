import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme'

export default function CompareTab() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Phase 4 — Compare / Time Machine</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  body:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textMuted },
})
