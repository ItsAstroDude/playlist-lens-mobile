import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { useAuth } from '@/hooks/useAuth'

export default function ProfileTab() {
  const { logout } = useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Phase 5 — Taste Profile</Text>
        <Text style={styles.sub}>Coming soon</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  body:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  placeholder: { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textMuted },
  sub:         { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim },

  logoutBtn: {
    marginTop:         Spacing['2xl'],
    borderWidth:       1,
    borderColor:       `${Colors.error}40`,
    borderRadius:      Radius.full,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  logoutText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.error,
  },
})
