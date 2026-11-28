// require, not import: importing src/ type-checks Reanimated's own sources, which fail tsc here.
const { ReanimatedModule } = require('react-native-reanimated/src/ReanimatedModule')

/**
 * Reanimated 4.1 leak, worked around from JS (the bug is in C++).
 *
 * An unmounting animated view is "marked removable"; the next React commit drops its
 * props from the native registry. But its animation keeps writing frames until the JS
 * cleanup (cancelAnimation, stopMapper) reaches the UI thread, and a frame landing in
 * that gap re-adds the entry for good. Every later commit anywhere in the app then
 * replays it, and it pins the dead subtree in memory. Switching Rewind's Year / All
 * time mid-entrance leaked hundreds: the whole app scrolled 25-40 % janky until restart.
 *
 * Marking it again once its animations have surely stopped clears those late entries.
 * Marking a node that came back (react-freeze) is harmless: removal only happens once
 * the node is gone from the tree.
 */
// Internal API: if an upgrade renames it, skip the patch (the leak returns) rather than crash at launch.
if (typeof ReanimatedModule?.markNodeAsRemovable === 'function') {
  const mark = ReanimatedModule.markNodeAsRemovable.bind(ReanimatedModule)
  ReanimatedModule.markNodeAsRemovable = (wrapper: unknown) => {
    mark(wrapper)
    setTimeout(() => mark(wrapper), 1000)
  }
}
