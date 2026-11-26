import { hideTabBar, resetTabBar, tabBarHideReasons } from '@/utils/tabBar'

beforeEach(() => resetTabBar())

describe('tab bar hiding', () => {
  it('stays hidden while any reason is left', () => {
    hideTabBar('sheet:1', true)
    hideTabBar('scroll', true)
    hideTabBar('scroll', false)            // Lenses scrolled back to the top…
    expect(tabBarHideReasons()).toEqual(['sheet:1'])   // …but a sheet is still open
    hideTabBar('sheet:1', false)
    expect(tabBarHideReasons()).toEqual([])
  })
  it('stacked sheets each count', () => {
    hideTabBar('sheet:1', true)
    hideTabBar('sheet:2', true)
    hideTabBar('sheet:2', false)
    expect(tabBarHideReasons()).toEqual(['sheet:1'])
  })
  it('repeating a reason is harmless; the tour clears everything', () => {
    hideTabBar('reorder', true)
    hideTabBar('reorder', true)
    expect(tabBarHideReasons()).toEqual(['reorder'])
    resetTabBar()
    expect(tabBarHideReasons()).toEqual([])
  })
})
