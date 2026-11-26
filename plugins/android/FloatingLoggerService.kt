package com.srajan.gymtracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

class FloatingLoggerService : Service() {

  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  private var isExpanded = false

  private var exerciseId: String = ""
  private var exerciseName: String = "Workout"
  private var weightKg: Double = 20.0
  private var reps: Int = 10

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    exerciseId = intent?.getStringExtra("exerciseId") ?: exerciseId
    exerciseName = intent?.getStringExtra("exerciseName") ?: exerciseName
    weightKg = intent?.getDoubleExtra("weightKg", weightKg) ?: weightKg
    reps = intent?.getIntExtra("reps", reps) ?: reps

    startForegroundNotification()
    if (overlayView == null) {
      createOverlay()
    } else {
      renderState()
    }
    return START_STICKY
  }

  private fun startForegroundNotification() {
    val channelId = "gym_floating_logger"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Gym Floating Logger",
        NotificationManager.IMPORTANCE_LOW
      )
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(channel)
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, channelId)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    val notification = builder
      .setContentTitle("GYM Mini-Logger Active")
      .setContentText("Logging: $exerciseName")
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .build()

    startForeground(101, notification)
  }

  private fun createOverlay() {
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

    val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      layoutType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = 40
      y = 260
    }

    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24, 18, 24, 18)
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#EE141923"))
        cornerRadius = 32f
        setStroke(2, Color.parseColor("#3B82F6"))
      }
    }

    var initialX = 0
    var initialY = 0
    var touchX = 0f
    var touchY = 0f

    container.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          touchX = event.rawX
          touchY = event.rawY
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = initialX + (event.rawX - touchX).toInt()
          params.y = initialY + (event.rawY - touchY).toInt()
          windowManager.updateViewLayout(container, params)
          true
        }
        MotionEvent.ACTION_UP -> {
          if (abs(event.rawX - touchX) < 12 && abs(event.rawY - touchY) < 12 && !isExpanded) {
            isExpanded = true
            renderState()
          }
          true
        }
        else -> false
      }
    }

    overlayView = container
    windowManager.addView(container, params)
    renderState()
  }

  private fun renderState() {
    val root = overlayView as? LinearLayout ?: return
    root.removeAllViews()

    if (!isExpanded) {
      val bubble = TextView(this).apply {
        text = "GYM • ${weightKg}kg×$reps"
        setTextColor(Color.WHITE)
        textSize = 13f
      }
      root.addView(bubble)
      return
    }

    val title = TextView(this).apply {
      text = exerciseName
      setTextColor(Color.WHITE)
      textSize = 14f
    }
    root.addView(title)

    val valueText = TextView(this).apply {
      text = "${weightKg} kg  ×  $reps reps"
      setTextColor(Color.parseColor("#3B82F6"))
      textSize = 16f
      setPadding(0, 8, 0, 8)
    }
    root.addView(valueText)

    val weightRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
    }
    weightRow.addView(makeBtn("-2.5kg") {
      weightKg = maxOf(0.0, weightKg - 2.5)
      renderState()
    })
    weightRow.addView(makeBtn("+2.5kg") {
      weightKg += 2.5
      renderState()
    })
    weightRow.addView(makeBtn("-1 Rep") {
      reps = maxOf(1, reps - 1)
      renderState()
    })
    weightRow.addView(makeBtn("+1 Rep") {
      reps += 1
      renderState()
    })
    root.addView(weightRow)

    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, 10, 0, 0)
    }
    actionRow.addView(makeBtn("Save Set", "#22C55E") {
      savePendingSet()
    })
    actionRow.addView(makeBtn("+1 Water", "#3B82F6") {
      incrementPendingWater()
    })
    actionRow.addView(makeBtn("Min", "#475569") {
      isExpanded = false
      renderState()
    })
    actionRow.addView(makeBtn("✕", "#EF4444") {
      stopSelf()
    })
    root.addView(actionRow)
  }

  private fun makeBtn(label: String, bgHex: String = "#1C2331", onClick: () -> Unit): Button {
    return Button(this).apply {
      text = label
      textSize = 11f
      setTextColor(Color.WHITE)
      setPadding(12, 6, 12, 6)
      background = GradientDrawable().apply {
        setColor(Color.parseColor(bgHex))
        cornerRadius = 16f
      }
      setOnClickListener { onClick() }
    }
  }

  private fun savePendingSet() {
    val prefs = getSharedPreferences(GymNativeModule.PREFS_NAME, Context.MODE_PRIVATE)
    val arr = JSONArray(prefs.getString("pending_sets", "[]") ?: "[]")
    arr.put(JSONObject().apply {
      put("exerciseId", exerciseId)
      put("weightKg", weightKg)
      put("reps", reps)
      put("loggedAt", System.currentTimeMillis())
    })
    prefs.edit().putString("pending_sets", arr.toString()).apply()
    Toast.makeText(this, "Saved ${weightKg}kg × $reps", Toast.LENGTH_SHORT).show()
  }

  private fun incrementPendingWater() {
    val prefs = getSharedPreferences(GymNativeModule.PREFS_NAME, Context.MODE_PRIVATE)
    val nextPending = prefs.getInt("pending_water", 0) + 1
    val nextWidget = prefs.getInt("widget_water", 0) + 1
    prefs.edit()
      .putInt("pending_water", nextPending)
      .putInt("widget_water", nextWidget)
      .apply()
    Toast.makeText(this, "+1 Glass Water", Toast.LENGTH_SHORT).show()
  }

  override fun onDestroy() {
    super.onDestroy()
    overlayView?.let { windowManager.removeView(it) }
    overlayView = null
  }
}
