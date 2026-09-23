import SwiftUI
import WebKit

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

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
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
            }
        }
    }
}
