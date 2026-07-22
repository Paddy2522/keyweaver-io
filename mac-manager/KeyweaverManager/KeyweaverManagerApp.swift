import SwiftUI

@main
struct KeyweaverManagerApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
        .frame(minWidth: 640, minHeight: 480)
    }
    .windowStyle(.automatic)
    .commands {
      CommandGroup(replacing: .newItem) {}
    }
  }
}
