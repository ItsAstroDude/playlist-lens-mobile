import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize } from '@/constants/theme'

export default function FriendsTab() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Phase 6 — Friends & Compatibility</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  body:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textMuted },
})
