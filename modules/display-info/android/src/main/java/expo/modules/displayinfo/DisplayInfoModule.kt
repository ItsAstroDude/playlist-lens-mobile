package expo.modules.displayinfo

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Display
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Which display the app's activity is on. On the Galaxy Z Flip, display 0 is the main
 * (inner) screen and the cover screen is another display, so `isDefault` = main screen.
 * JS: hooks/useScreen.ts (falls back to window size on APKs without this module).
 */
class DisplayInfoModule : Module() {
  private var listener: DisplayManager.DisplayListener? = null

  private val displayManager: DisplayManager?
    get() = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager

  override fun definition() = ModuleDefinition {
    Name("DisplayInfo")
    Events("onChange")

    Function("get") { info() }

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
    }
    OnStopObserving {
      listener?.let { displayManager?.unregisterDisplayListener(it) }
      listener = null
    }
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
