package com.phonelink.remote.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject

class RemoteAccessibilityService : AccessibilityService() {

    companion object {
        var instance: RemoteAccessibilityService? = null
    }

    private var wasOnLockScreen = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    fun executeGlobalAction(action: String) {
        when (action.lowercase()) {
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkg = event.packageName?.toString() ?: return

            if (pkg.contains("systemui") || pkg.contains("keyguard") || pkg.contains("lock")) {
                wasOnLockScreen = true
            } else if (wasOnLockScreen) {
                wasOnLockScreen = false
                // Host unlocked the phone!
                val intent = Intent("com.phonelink.remote.APP_OPENED_ACTION").apply {
                    putExtra("PACKAGE_NAME", "Device Unlocked 🔓")
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            } else if (!pkg.contains("launcher") && pkg != packageName) {
                val intent = Intent("com.phonelink.remote.APP_OPENED_ACTION").apply {
                    putExtra("PACKAGE_NAME", pkg)
                    setPackage(packageName)
                }
                sendBroadcast(intent)
            }
        }
    }

    override fun onInterrupt() {}

    fun executeRemoteEvent(jsonStr: String) {
        try {
            val obj = JSONObject(jsonStr)
            val type = obj.getString("type")
            val displayMetrics = resources.displayMetrics
            val screenWidth = displayMetrics.widthPixels
            val screenHeight = displayMetrics.heightPixels

            when (type) {
                "global_action" -> {
                    val action = obj.getString("action")
                    executeGlobalAction(action)
                }
                "tap" -> {
                    val normX = obj.getDouble("x").toFloat()
                    val normY = obj.getDouble("y").toFloat()
                    val targetX = normX * screenWidth
                    val targetY = normY * screenHeight

                    val path = Path().apply { moveTo(targetX, targetY) }
                    val stroke = GestureDescription.StrokeDescription(path, 0, 15)
                    val gesture = GestureDescription.Builder().addStroke(stroke).build()
                    dispatchGesture(gesture, null, null)
                }
                "swipe" -> {
                    val startX = obj.getDouble("x1").toFloat() * screenWidth
                    val startY = obj.getDouble("y1").toFloat() * screenHeight
                    val endX = obj.getDouble("x2").toFloat() * screenWidth
                    val endY = obj.getDouble("y2").toFloat() * screenHeight
                    val duration = obj.optLong("duration", 200L)

                    val path = Path().apply {
                        moveTo(startX, startY)
                        lineTo(endX, endY)
                    }
                    val stroke = GestureDescription.StrokeDescription(path, 0, 15)
                    val gesture = GestureDescription.Builder().addStroke(stroke).build()
                    dispatchGesture(gesture, null, null)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
