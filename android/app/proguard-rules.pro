# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Capacitor core classes
-keep class com.getcapacitor.** { *; }
-keep class io.capacitor.** { *; }

# Keep the main application class
-keep class com.catshare.official.MainActivity { *; }

# Preserve line number information for debugging stack traces
-keepattributes SourceFile,LineNumberTable,Signature,Exceptions

# Firebase / FCM (push when app is background or killed)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}
