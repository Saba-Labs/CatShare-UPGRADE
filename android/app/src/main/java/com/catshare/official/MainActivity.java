package com.catshare.official;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.catshare.official.BackgroundRendererPlugin;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

// In-app update imports
import com.google.android.material.snackbar.Snackbar;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.play.core.tasks.Task;

public class MainActivity extends BridgeActivity {

    private static final int UPDATE_REQUEST_CODE = 100;
    private AppUpdateManager appUpdateManager;

    private final InstallStateUpdatedListener installStateListener = state -> {
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            showUpdateSnackbar();
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register Plugins
        registerPlugin(PushNotificationsPlugin.class);
        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(BackgroundRendererPlugin.class);
        registerPlugin(GoogleAuth.class);

        // In-app updates
        appUpdateManager = AppUpdateManagerFactory.create(this);
        appUpdateManager.registerListener(installStateListener);
        checkForUpdate();
    }

    private void checkForUpdate() {
        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();
        appUpdateInfoTask.addOnSuccessListener(info -> {
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isFlexibleUpdateAllowed()) {
                appUpdateManager.startUpdateFlowForResult(
                        info,
                        this,
                        AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                        UPDATE_REQUEST_CODE
                );
            }
        });
    }

    private void showUpdateSnackbar() {
        Snackbar.make(
                findViewById(android.R.id.content),
                "Update ready. Restart to apply.",
                Snackbar.LENGTH_INDEFINITE
        ).setAction("RESTART", v -> appUpdateManager.completeUpdate()).show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // If user left the app mid-download and came back, prompt them
        if (appUpdateManager != null) {
            appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    showUpdateSnackbar();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (appUpdateManager != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
    }
}