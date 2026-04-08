package com.catshare.official;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

/**
 * FCM high-priority notifications use channel {@code catshare_new_orders}
 * (must match Edge Function / server payload).
 */
public class MainApplication extends Application {
    public static final String NEW_ORDERS_CHANNEL_ID = "catshare_new_orders";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                NEW_ORDERS_CHANNEL_ID,
                "New orders",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts when a customer places an order");
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.createNotificationChannel(channel);
        }
    }
}