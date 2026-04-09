package com.catshare.plugins;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Opens a local PDF using the app's main FileProvider (same authority as Share).
 * Avoids file-opener separate provider, which can fail or crash
 * when paths do not match that plugin configuration.
 */
@CapacitorPlugin(name = "OpenInvoicePdf")
public class OpenInvoicePdfPlugin extends Plugin {

  @PluginMethod
  public void openFile(PluginCall call) {
    String path = call.getString("path");
    if (path == null || path.isEmpty()) {
      call.reject("Missing path");
      return;
    }

    if (path.startsWith("file:")) {
      path = Uri.parse(path).getPath();
    }
    if (path == null || path.isEmpty()) {
      call.reject("Invalid path");
      return;
    }

    File file = new File(path);
    if (!file.exists()) {
      call.reject("File not found");
      return;
    }

    if (getActivity() == null) {
      call.reject("Activity not available");
      return;
    }

    try {
      Uri contentUri =
          FileProvider.getUriForFile(
              getContext(),
              getContext().getPackageName() + ".fileprovider",
              file);

      String mime = getMimeType(path);
      if (mime == null || mime.isEmpty()) {
        mime = "application/pdf";
      }

      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(contentUri, mime);
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

      getActivity().startActivity(intent);
      call.resolve();
    } catch (ActivityNotFoundException e) {
      call.reject("No app found to open PDF", e);
    } catch (Exception e) {
      call.reject(e.getMessage(), e);
    }
  }

  @PluginMethod
  public void shareFile(PluginCall call) {
    String path = call.getString("path");
    String chooserTitle = call.getString("dialogTitle", "Send invoice");
    String subject = call.getString("title", "");
    String text = call.getString("text", "");

    if (path == null || path.isEmpty()) {
      call.reject("Missing path");
      return;
    }
    if (path.startsWith("file:")) {
      path = Uri.parse(path).getPath();
    }
    if (path == null || path.isEmpty()) {
      call.reject("Invalid path");
      return;
    }

    File file = new File(path);
    if (!file.exists()) {
      call.reject("File not found");
      return;
    }
    if (getActivity() == null) {
      call.reject("Activity not available");
      return;
    }

    try {
      Uri contentUri =
          FileProvider.getUriForFile(
              getContext(),
              getContext().getPackageName() + ".fileprovider",
              file);

      Intent send = new Intent(Intent.ACTION_SEND);
      String shareMime = getMimeType(path);
      if (shareMime == null || shareMime.isEmpty()) {
        shareMime = "application/pdf";
      }
      send.setType(shareMime);
      send.putExtra(Intent.EXTRA_STREAM, contentUri);
      if (subject != null && !subject.isEmpty()) {
        send.putExtra(Intent.EXTRA_SUBJECT, subject);
      }
      if (text != null && !text.isEmpty()) {
        send.putExtra(Intent.EXTRA_TEXT, text);
      }
      send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

      Intent chooser = Intent.createChooser(send, chooserTitle);
      chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      getActivity().startActivity(chooser);
      call.resolve();
    } catch (ActivityNotFoundException e) {
      call.reject("No app can share this file", e);
    } catch (Exception e) {
      call.reject(e.getMessage(), e);
    }
  }

  private String getMimeType(String path) {
    String extension = MimeTypeMap.getFileExtensionFromUrl(path);
    if (extension == null) {
      return null;
    }
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase());
  }
}
