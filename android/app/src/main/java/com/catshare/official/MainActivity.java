package com.catshare.official;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Plugins
// import com.getcapacitor.community.database.sqlite.CapacitorSQLitePlugin;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.catshare.official.BackgroundRendererPlugin;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register Plugins
        // registerPlugin(CapacitorSQLitePlugin.class);
        registerPlugin(PushNotificationsPlugin.class);
        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(BackgroundRendererPlugin.class);
        registerPlugin(GoogleAuth.class);
    }
}
