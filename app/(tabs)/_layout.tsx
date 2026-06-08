import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { BlurView } from 'expo-blur'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from '@/constants/theme'
import { haptic } from '@/constants/animation'

// ─── Spring configs ───────────────────────────────────────────────────────────
const ICON_SPRING = { mass: 0.6, damping: 11, stiffness: 260 }
const PILL_SPRING = { mass: 0.7, damping: 14, stiffness: 220 }

// ─── Wrapper: springs the icon + shows a glowing pill behind active tab ───────
function AnimatedTabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const scale       = useSharedValue(1)
  const pillOpacity = useSharedValue(0)
  const pillScale   = useSharedValue(0.6)

  useEffect(() => {
    scale.value       = withSpring(focused ? 1.18 : 1,   ICON_SPRING)
    pillOpacity.value = withSpring(focused ? 1   : 0,   PILL_SPRING)
    pillScale.value   = withSpring(focused ? 1   : 0.6, PILL_SPRING)
  }, [focused])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const pillStyle = useAnimatedStyle(() => ({
    opacity:   pillOpacity.value,
    transform: [{ scale: pillScale.value }],
  }))

  return (
    <Animated.View style={[iconStyles.base, iconStyle]}>
      <Animated.View style={[iconStyles.pill, pillStyle]} />
      {children}
    </Animated.View>
  )
}

// ─── Tab icons ────────────────────────────────────────────────────────────────
function GridIcon({ focused }: { focused: boolean }) {
  return (
    <AnimatedTabIcon focused={focused}>
      <View style={iconStyles.gridRow}>
        <View style={[iconStyles.dot, focused && iconStyles.dotActive]} />
        <View style={[iconStyles.dot, focused && iconStyles.dotActive]} />
      </View>
      <View style={iconStyles.gridRow}>
        <View style={[iconStyles.dot, focused && iconStyles.dotActive]} />
        <View style={[iconStyles.dot, focused && iconStyles.dotActive]} />
      </View>
    </AnimatedTabIcon>
  )
}

function CompareIcon({ focused }: { focused: boolean }) {
  return (
    <AnimatedTabIcon focused={focused}>
      <View style={iconStyles.row}>
        <View style={[iconStyles.bar, focused && iconStyles.barActive]} />
        <View style={[iconStyles.barTall, focused && iconStyles.barActive]} />
        <View style={[iconStyles.barMid, focused && iconStyles.barActive]} />
      </View>
    </AnimatedTabIcon>
  )
}

// Wrapped — a vinyl/record glyph (ring + center dot)
function WrappedIcon({ focused }: { focused: boolean }) {
  return (
    <AnimatedTabIcon focused={focused}>
      <View style={[iconStyles.ring, focused && iconStyles.ringActive]}>
        <View style={[iconStyles.ringDot, focused && iconStyles.ringDotActive]} />
      </View>
    </AnimatedTabIcon>
  )
}

// Swipe — two stacked cards
function SwipeIcon({ focused }: { focused: boolean }) {
  return (
    <AnimatedTabIcon focused={focused}>
      <View style={[iconStyles.cardBehind, focused && iconStyles.cardActive]} />
      <View style={[iconStyles.cardFront, focused && iconStyles.cardActiveBorder]} />
    </AnimatedTabIcon>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Prevents white flash on tab switch
        sceneStyle: { backgroundColor: Colors.background },
        // Compact floating pill — sits above the gesture area
        tabBarStyle: [styles.tabBar, { bottom: Math.max(insets.bottom, 8) + 10 }],
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => (
          <BlurView
            intensity={60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor:   Colors.greenPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:        styles.tabLabel,
        tabBarShowLabel:         true,
        animation:               'fade',
      }}
      screenListeners={{
        tabPress: () => haptic.light(),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:    'lenses',
          tabBarIcon: ({ focused }) => <GridIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title:    'compare',
          tabBarIcon: ({ focused }) => <CompareIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wrapped"
        options={{
          title:    'wrapped',
          tabBarIcon: ({ focused }) => <WrappedIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title:    'swipe',
          tabBarIcon: ({ focused }) => <SwipeIcon focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  // Floating compact pill
  tabBar: {
    position:        'absolute',
    left:            18,
    right:           18,
    height:          62,
    borderRadius:    31,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    backgroundColor: 'rgba(18,18,22,0.72)',
    overflow:        'hidden',
    paddingHorizontal: 6,
    // float
    elevation:       12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.45,
    shadowRadius:    18,
  },
  tabItem: {
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily:   'DMMono_400Regular',
    fontSize:     9,
    marginBottom: 8,
  },
})

const iconStyles = StyleSheet.create({
  base: {
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Glowing pill behind active icon
  pill: {
    position:        'absolute',
    width:           36,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.greenSubtle,
    // iOS glow
    shadowColor:     Colors.greenPrimary,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.5,
    shadowRadius:    8,
  },

  row:     { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },

  // Grid icon
  gridRow:  { flexDirection: 'row', gap: 3, marginVertical: 1.5 },
  dot:      { width: 7, height: 7, borderRadius: 2, backgroundColor: Colors.textMuted },
  dotActive:{ backgroundColor: Colors.greenPrimary },

  // Bar chart icon
  bar:      { width: 5, height: 10, borderRadius: 2, backgroundColor: Colors.textMuted },
  barTall:  { width: 5, height: 16, borderRadius: 2, backgroundColor: Colors.textMuted },
  barMid:   { width: 5, height: 13, borderRadius: 2, backgroundColor: Colors.textMuted },
  barActive:{ backgroundColor: Colors.greenPrimary },

  // Profile icon
  circle:       { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.textMuted, marginBottom: 1 },
  circleActive: { backgroundColor: Colors.greenPrimary },
  arc:          { width: 16, height: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.textMuted, borderBottomWidth: 0 },
  arcActive:    { borderColor: Colors.greenPrimary },

  // Friends icon (legacy, unused)
  smCircle:       { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.textMuted },
  smCircleOffset: { marginLeft: -3, marginTop: 4 },

  // Wrapped icon (vinyl record)
  ring:          { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  ringActive:    { borderColor: Colors.greenPrimary },
  ringDot:       { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.textMuted },
  ringDotActive: { backgroundColor: Colors.greenPrimary },

  // Swipe icon (stacked cards)
  cardBehind:      { position: 'absolute', width: 13, height: 17, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.textMuted, transform: [{ rotate: '12deg' }, { translateX: 3 }] },
  cardFront:       { width: 13, height: 17, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.textMuted, backgroundColor: Colors.background, transform: [{ rotate: '-6deg' }] },
  cardActive:      { borderColor: Colors.greenPrimary },
  cardActiveBorder:{ borderColor: Colors.greenPrimary },
})
