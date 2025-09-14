import Expo
import React
import ReactAppDependencyProvider
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // Detect if current process is an extension (e.g. Siri / Widget / Intent)
  private func isRunningInAppExtension() -> Bool {
    if Bundle.main.bundlePath.hasSuffix(".appex") { return true }
    if Bundle.main.object(forInfoDictionaryKey: "NSExtension") != nil { return true }
    return false
  }

#if DEBUG
  private func log(_ msg: String) { NSLog("[AppDelegate] %@", msg) }
#else
  private func log(_ msg: String) { NSLog("[AppDelegate] %@", msg) }
#endif

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Prevent full React / Expo bootstrap inside extension targets. This avoids early crashes like
    // EXC_BREAKPOINT in -[_EXConnectionHandlerExtension willFinishLaunching]. Extension processes
    // should perform only lightweight initialization and skip JS runtime startup.
    if isRunningInAppExtension() {
      NSLog("[AppDelegate] Detected app extension – skipping React/Expo bootstrap.")
      return true
    }

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    if let w = window, !w.isKeyWindow { w.makeKeyAndVisible(); log("Window made key & visible") }
    // Look for pre-bundled JS (Release)
    if let jsURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle"), FileManager.default.fileExists(atPath: jsURL.path) {
      log("JS bundle present at: \(jsURL.path)")
    } else {
      log("JS bundle not found yet (expected in dev or will be loaded by bridge).")
    }
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
