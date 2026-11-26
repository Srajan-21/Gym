package com.srajan.gymtracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class GymWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (appWidgetId in appWidgetIds) {
      updateWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_ADD_WATER) {
      val prefs = context.getSharedPreferences(GymNativeModule.PREFS_NAME, Context.MODE_PRIVATE)
      val nextPending = prefs.getInt("pending_water", 0) + 1
      val nextWater = prefs.getInt("widget_water", 0) + 1
      prefs.edit()
        .putInt("pending_water", nextPending)
        .putInt("widget_water", nextWater)
        .apply()

      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, GymWidgetProvider::class.java))
      onUpdate(context, manager, ids)
    }
  }

  companion object {
    const val ACTION_ADD_WATER = "com.srajan.gymtracker.ACTION_ADD_WATER"

    fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val prefs = context.getSharedPreferences(GymNativeModule.PREFS_NAME, Context.MODE_PRIVATE)
      val remCal = prefs.getInt("widget_remaining_cal", 2200)
      val remPro = prefs.getInt("widget_remaining_pro", 150)
      val water = prefs.getInt("widget_water", 0)
      val split = prefs.getString("widget_split", "Today's Split") ?: "Today's Split"

      val views = RemoteViews(context.packageName, R.layout.gym_widget)
      views.setTextViewText(R.id.widget_split, split)
      views.setTextViewText(R.id.widget_macros, "Left: $remCal kcal • ${remPro}g P")
      views.setTextViewText(R.id.widget_water, "Water: $water glasses")

      val waterIntent = Intent(context, GymWidgetProvider::class.java).apply {
        action = ACTION_ADD_WATER
      }
      val waterPending = PendingIntent.getBroadcast(
        context,
        0,
        waterIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_water_btn, waterPending)

      manager.updateAppWidget(widgetId, views)
    }
  }
}
