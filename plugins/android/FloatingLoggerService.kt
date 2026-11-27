package com.srajan.gymtracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
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
  private var loggedSetsCount: Int = 0

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val nextId = intent?.getStringExtra("exerciseId")
    if (nextId != null && nextId != exerciseId) {
      loggedSetsCount = 0
    }
    exerciseId = nextId ?: exerciseId
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
      .setContentTitle("Srajan's Mini-Logger")
      .setContentText("Tracking: $exerciseName")
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
      x = dp(16)
      y = dp(110)
    }

    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      elevation = dp(8).toFloat()
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

  private fun formatWeight(w: Double): String {
    return if (w % 1.0 == 0.0) "${w.toInt()}" else String.format("%.1f", w)
  }

  private fun renderState() {
    val root = overlayView as? LinearLayout ?: return
    root.removeAllViews()

    if (!isExpanded) {
      root.setPadding(dp(14), dp(10), dp(14), dp(10))
      root.background = GradientDrawable().apply {
        setColor(Color.parseColor("#1F4D3D"))
        cornerRadius = dp(24).toFloat()
        setStroke(dp(1), Color.parseColor("#E5E0D5"))
      }

      val bubble = TextView(this).apply {
        text = "GYM  •  ${formatWeight(weightKg)}kg × $reps"
        setTextColor(Color.WHITE)
        textSize = 13f
        typeface = Typeface.DEFAULT_BOLD
      }
      root.addView(bubble)
      return
    }

    root.setPadding(dp(16), dp(14), dp(16), dp(14))
    root.background = GradientDrawable().apply {
      setColor(Color.parseColor("#F7F5F0"))
      cornerRadius = dp(20).toFloat()
      setStroke(dp(1), Color.parseColor("#1F4D3D"))
    }

    // Header Row: Exercise Name + Set Badge + Min/Close
    val headerRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        dp(270),
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    }

    val titleCol = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    val titleView = TextView(this).apply {
      text = exerciseName
      setTextColor(Color.parseColor("#1A1917"))
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      maxLines = 1
    }
    val subView = TextView(this).apply {
      text = "Set #${loggedSetsCount + 1}"
      setTextColor(Color.parseColor("#1F4D3D"))
      textSize = 11f
      typeface = Typeface.DEFAULT_BOLD
    }
    titleCol.addView(titleView)
    titleCol.addView(subView)
    headerRow.addView(titleCol)

    headerRow.addView(makeChipBtn("—", "#EFECE5", "#1A1917", 0, 6) {
      isExpanded = false
      renderState()
    })
    headerRow.addView(makeChipBtn("✕", "#F7E6E6", "#B84343", 0, 0) {
      stopSelf()
    })
    root.addView(headerRow)

    // Weight Control Row
    root.addView(makeStepperRow(
      label = "WEIGHT",
      valueText = "${formatWeight(weightKg)} kg",
      minusLabel = "-2.5",
      plusLabel = "+2.5",
      onMinus = {
        weightKg = maxOf(0.0, weightKg - 2.5)
        renderState()
      },
      onPlus = {
        weightKg += 2.5
        renderState()
      }
    ))

    // Reps Control Row
    root.addView(makeStepperRow(
      label = "REPS",
      valueText = "$reps reps",
      minusLabel = "-1",
      plusLabel = "+1",
      onMinus = {
        reps = maxOf(1, reps - 1)
        renderState()
      },
      onPlus = {
        reps += 1
        renderState()
      }
    ))

    // Action Row: Log Set + Water
    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(10)
      }
    }

    val logBtn = makeActionBtn("✓ Log Set #${loggedSetsCount + 1}", "#1F4D3D", Color.WHITE, 2f, 8) {
      savePendingSet()
      loggedSetsCount += 1
      renderState()
    }
    val waterBtn = makeActionBtn("+1 Water", "#FFFFFF", Color.parseColor("#1F4D3D"), 1f, 0, "#1F4D3D") {
      incrementPendingWater()
    }

    actionRow.addView(logBtn)
    actionRow.addView(waterBtn)
    root.addView(actionRow)
  }

  private fun makeStepperRow(
    label: String,
    valueText: String,
    minusLabel: String,
    plusLabel: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit
  ): LinearLayout {
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(10), dp(8), dp(10), dp(8))
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        cornerRadius = dp(12).toFloat()
        setStroke(1, Color.parseColor("#E5E0D5"))
      }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(8)
      }
    }

    val lbl = TextView(this).apply {
      text = label
      setTextColor(Color.parseColor("#6B665E"))
      textSize = 10f
      typeface = Typeface.DEFAULT_BOLD
      layoutParams = LinearLayout.LayoutParams(dp(48), LinearLayout.LayoutParams.WRAP_CONTENT)
    }
    row.addView(lbl)

    row.addView(makeChipBtn(minusLabel, "#EFECE5", "#1A1917", 0, 8, onMinus))

    val valView = TextView(this).apply {
      text = valueText
      setTextColor(Color.parseColor("#1A1917"))
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }
    row.addView(valView)

    row.addView(makeChipBtn(plusLabel, "#1F4D3D", "#FFFFFF", 8, 0, onPlus))
    return row
  }

  private fun makeChipBtn(
    label: String,
    bgHex: String,
    textHex: String,
    leftMarginDp: Int,
    rightMarginDp: Int,
    onClick: () -> Unit
  ): TextView {
    return TextView(this).apply {
      text = label
      textSize = 12f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.parseColor(textHex))
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(7), dp(12), dp(7))
      background = GradientDrawable().apply {
        setColor(Color.parseColor(bgHex))
        cornerRadius = dp(10).toFloat()
      }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        leftMargin = dp(leftMarginDp)
        rightMargin = dp(rightMarginDp)
      }
      setOnClickListener { onClick() }
    }
  }

  private fun makeActionBtn(
    label: String,
    bgHex: String,
    textColor: Int,
    weight: Float,
    rightMarginDp: Int,
    strokeHex: String? = null,
    onClick: () -> Unit
  ): TextView {
    return TextView(this).apply {
      text = label
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(textColor)
      gravity = Gravity.CENTER
      setPadding(dp(10), dp(11), dp(10), dp(11))
      background = GradientDrawable().apply {
        setColor(Color.parseColor(bgHex))
        cornerRadius = dp(12).toFloat()
        if (strokeHex != null) {
          setStroke(dp(1), Color.parseColor(strokeHex))
        }
      }
      layoutParams = LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        weight
      ).apply {
        rightMargin = dp(rightMarginDp)
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
    Toast.makeText(this, "Logged Set #${loggedSetsCount + 1}: ${formatWeight(weightKg)}kg × $reps", Toast.LENGTH_SHORT).show()
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
