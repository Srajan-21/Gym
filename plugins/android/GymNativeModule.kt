package com.srajan.gymtracker

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject

class GymNativeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "GymNative"

  private fun prefs() =
    reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      promise.resolve(Settings.canDrawOverlays(reactContext))
    } else {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun requestOverlayPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactContext.packageName}")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
    }
  }

  @ReactMethod
  fun startFloatingOverlay(
    exerciseId: String,
    exerciseName: String,
    weightKg: Double,
    reps: Int
  ) {
    val intent = Intent(reactContext, FloatingLoggerService::class.java).apply {
      putExtra("exerciseId", exerciseId)
      putExtra("exerciseName", exerciseName)
      putExtra("weightKg", weightKg)
      putExtra("reps", reps)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  @ReactMethod
  fun stopFloatingOverlay() {
    val intent = Intent(reactContext, FloatingLoggerService::class.java)
    reactContext.stopService(intent)
  }

  @ReactMethod
  fun updateWidgetSnapshot(
    remainingCalories: Int,
    remainingProtein: Int,
    waterGlasses: Int,
    splitName: String
  ) {
    prefs().edit()
      .putInt("widget_remaining_cal", remainingCalories)
      .putInt("widget_remaining_pro", remainingProtein)
      .putInt("widget_water", waterGlasses)
      .putString("widget_split", splitName)
      .apply()

    val manager = AppWidgetManager.getInstance(reactContext)
    val ids = manager.getAppWidgetIds(
      ComponentName(reactContext, GymWidgetProvider::class.java)
    )
    if (ids.isNotEmpty()) {
      val updateIntent = Intent(reactContext, GymWidgetProvider::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      reactContext.sendBroadcast(updateIntent)
    }
  }

  @ReactMethod
  fun consumePendingLogs(promise: Promise) {
    val p = prefs()
    val setsJson = p.getString("pending_sets", "[]") ?: "[]"
    val pendingWater = p.getInt("pending_water", 0)

    p.edit()
      .putString("pending_sets", "[]")
      .putInt("pending_water", 0)
      .apply()

    val result = JSONObject().apply {
      put("sets", JSONArray(setsJson))
      put("waterDelta", pendingWater)
    }
    promise.resolve(result.toString())
  }

  companion object {
    const val PREFS_NAME = "gym_tracker_native_prefs"
  }
}
