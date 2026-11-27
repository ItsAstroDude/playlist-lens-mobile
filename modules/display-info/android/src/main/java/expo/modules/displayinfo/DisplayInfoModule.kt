package expo.modules.displayinfo

import android.app.Activity
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Display
import android.view.WindowManager
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Which display the app's activity is on. On the Galaxy Z Flip, display 0 is the main
 * (inner) screen and the cover screen is another display, so `isDefault` = main screen.
 * JS: hooks/useScreen.ts (falls back to window size on APKs without this module).
 *
 * Also the fold posture (APK versionCode 5+): Jetpack WindowManager's FoldingFeature —
 * flat or half-opened (Flex mode / tabletop), the hinge's orientation and its bounds
 * in window dp. JS: hooks/usePosture.ts + utils/posture.ts.
 */
class DisplayInfoModule : Module() {
  private var listener: DisplayManager.DisplayListener? = null

  private var observing = false
  private var layoutTracker: WindowInfoTrackerCallbackAdapter? = null
  private var layoutListener: Consumer<WindowLayoutInfo>? = null
  private var layoutActivity: Activity? = null
  private var posture: Map<String, Any> = NO_FOLD

  private val displayManager: DisplayManager?
    get() = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager

  override fun definition() = ModuleDefinition {
    Name("DisplayInfo")
    Events("onChange", "onPosture")

    Function("get") { info() }

    // The last posture Android reported (no fold until the first listener is added).
    Function("getPosture") { posture }

    // Fires when a display turns on/off or changes (folding, unfolding).
    OnStartObserving {
      val l = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) {}
        override fun onDisplayRemoved(displayId: Int) {}
        override fun onDisplayChanged(displayId: Int) {
          info()?.let { sendEvent("onChange", it) }
        }
      }
      listener = l
      displayManager?.registerDisplayListener(l, Handler(Looper.getMainLooper()))
      observing = true
      startPosture()
    }
    OnStopObserving {
      listener?.let { displayManager?.unregisterDisplayListener(it) }
      listener = null
      observing = false
      stopPosture()
    }

    // The listener is tied to an activity: re-attach if it was (re)created meanwhile.
    OnActivityEntersForeground { if (observing) startPosture() }
    OnActivityDestroys { stopPosture() }
  }

  // ── Fold posture ──
  private fun startPosture() {
    val activity = appContext.currentActivity ?: return
    if (layoutActivity === activity && layoutListener != null) return
    stopPosture()
    try {
      val tracker = WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(activity))
      val l = Consumer<WindowLayoutInfo> { layout ->
        posture = postureOf(layout, activity)
        sendEvent("onPosture", posture)
      }
      tracker.addWindowLayoutInfoListener(activity, ContextCompat.getMainExecutor(activity), l)
      layoutTracker = tracker
      layoutListener = l
      layoutActivity = activity
    } catch (e: Throwable) {
      // No WindowManager extensions on this phone: it simply never folds.
      posture = NO_FOLD
    }
  }

  private fun stopPosture() {
    val l = layoutListener
    if (l != null) {
      try { layoutTracker?.removeWindowLayoutInfoListener(l) } catch (e: Throwable) {}
    }
    layoutTracker = null
    layoutListener = null
    layoutActivity = null
  }

  private fun postureOf(layout: WindowLayoutInfo, activity: Activity): Map<String, Any> {
    val fold = layout.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull() ?: return NO_FOLD
    val d = activity.resources.displayMetrics.density.toDouble().takeIf { it > 0 } ?: 1.0
    val b = fold.bounds
    return mapOf(
      "state" to (if (fold.state == FoldingFeature.State.HALF_OPENED) "half" else "flat"),
      "orientation" to (if (fold.orientation == FoldingFeature.Orientation.HORIZONTAL) "horizontal" else "vertical"),
      "separating" to fold.isSeparating,
      "top" to b.top / d,
      "bottom" to b.bottom / d,
      "left" to b.left / d,
      "right" to b.right / d,
    )
  }

  private companion object {
    val NO_FOLD: Map<String, Any> = mapOf("state" to "none")
  }

  @Suppress("DEPRECATION")
  private fun info(): Map<String, Any>? {
    val activity = appContext.currentActivity ?: return null
    val display: Display =
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display else null)
        ?: (activity.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay
    val real = DisplayMetrics().also { display.getRealMetrics(it) }
    return mapOf(
      "id" to display.displayId,
      "isDefault" to (display.displayId == Display.DEFAULT_DISPLAY),
      "widthPx" to real.widthPixels,
      "heightPx" to real.heightPixels,
      "densityDpi" to real.densityDpi,
      "appDensity" to activity.resources.displayMetrics.density.toDouble(),
    )
  }
}
