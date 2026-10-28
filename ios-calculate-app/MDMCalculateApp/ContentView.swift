import SwiftUI
import WebKit
import Photos
import UIKit

struct ContentView: View {
    var body: some View {
        WebViewContainer()
            .edgesIgnoringSafeArea(.bottom)
    }
}

struct WebViewContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()

        // Add script message handler for bridge calls from JavaScript
        userContentController.add(context.coordinator, name: "iosBridge")
        configuration.userContentController = userContentController
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1.0)

        // Load offline HTML asset
        if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "www") {
            let fileUrl = URL(fileURLWithPath: htmlPath)
            let readAccessUrl = fileUrl.deletingLastPathComponent()
            webView.loadFileURL(fileUrl, allowingReadAccessTo: readAccessUrl)
        } else if let resourceUrl = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(resourceUrl, allowingReadAccessTo: resourceUrl.deletingLastPathComponent())
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var parent: WebViewContainer

        init(_ parent: WebViewContainer) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "iosBridge",
                  let dict = message.body as? [String: Any],
                  let action = dict["action"] as? String else {
                return
            }

            if action == "copy", let text = dict["text"] as? String {
                UIPasteboard.general.string = text
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
            } else if action == "share", let text = dict["text"] as? String {
                let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)
                if let rootVC = UIApplication.shared.windows.first?.rootViewController {
                    rootVC.present(activityVC, animated: true, completion: nil)
                }
            } else if action == "saveImage",
                      let dataUrl = dict["dataUrl"] as? String,
                      let webView = message.webView {
                saveImage(dataUrl, in: webView, isScheduleImage: false)
            } else if action == "saveScheduleImage",
                      let dataUrl = dict["dataUrl"] as? String,
                      let webView = message.webView {
                saveImage(dataUrl, in: webView, isScheduleImage: true)
            }
        }

        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            guard origin.protocol == "file", type == .camera else {
                decisionHandler(.deny)
                return
            }
            decisionHandler(.grant)
        }

        private func saveImage(_ dataUrl: String, in webView: WKWebView, isScheduleImage: Bool) {
            let prefix = "data:image/jpeg;base64,"
            guard dataUrl.hasPrefix(prefix),
                  let imageData = Data(base64Encoded: String(dataUrl.dropFirst(prefix.count))),
                  let image = UIImage(data: imageData) else {
                notifyImageSaveResult(false, in: webView, isScheduleImage: isScheduleImage)
                return
            }

            PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self, weak webView] status in
                guard let self, let webView else { return }
                guard status == .authorized || status == .limited else {
                    self.notifyImageSaveResult(false, in: webView, isScheduleImage: isScheduleImage)
                    return
                }

                PHPhotoLibrary.shared().performChanges({
                    PHAssetChangeRequest.creationRequestForAsset(from: image)
                }) { success, error in
                    if let error {
                        NSLog("Unable to save captured image: %@", error.localizedDescription)
                    }
                    self.notifyImageSaveResult(success, in: webView, isScheduleImage: isScheduleImage)
                }
            }
        }

        private func notifyImageSaveResult(_ success: Bool, in webView: WKWebView, isScheduleImage: Bool) {
            let script = isScheduleImage
                ? "window.dispatchEvent(new CustomEvent('schedule-image-save-result', { detail: { success: \(success) } }))"
                : "document.getElementById('cameraFrame')?.contentWindow?.postMessage("
                    + "{ type: 'camera-image-save-result', success: \(success) }, '*')"
            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { _, error in
                    if let error {
                        NSLog("Unable to report image save result: %@", error.localizedDescription)
                    }
                }
            }
        }
    }
}
