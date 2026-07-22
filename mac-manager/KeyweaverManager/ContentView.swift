import SwiftUI
import AppKit

struct ContentView: View {
  @StateObject private var catalog = CatalogService()
  @StateObject private var installer = InstallService()
  @State private var selectedId: String?
  @State private var alertMessage: String?

  var body: some View {
    VStack(spacing: 0) {
      header
      Divider()
      if catalog.isLoading && catalog.products.isEmpty {
        ProgressView("Loading catalog…")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        productList
      }
      Divider()
      footer
    }
    .background(Color(nsColor: .windowBackgroundColor))
    .task { await catalog.refresh() }
    .alert("Keyweaver Manager", isPresented: Binding(
      get: { alertMessage != nil },
      set: { if !$0 { alertMessage = nil } }
    )) {
      Button("OK", role: .cancel) { alertMessage = nil }
    } message: {
      Text(alertMessage ?? "")
    }
  }

  private var header: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 2) {
        Text("Keyweaver Manager")
          .font(.system(size: 18, weight: .bold))
        Text("Install After Effects plugins from the Keyweaver catalog")
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      }
      Spacer()
      Button("Refresh") {
        Task { await catalog.refresh() }
      }
      .disabled(catalog.isLoading || installer.isBusy)
      Button("Website") {
        if let url = URL(string: "https://keyweaver.io/download") {
          NSWorkspace.shared.open(url)
        }
      }
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 14)
  }

  private var productList: some View {
    List(selection: $selectedId) {
      ForEach(catalog.products) { product in
        ProductRow(
          product: product,
          status: catalog.statusText(for: product),
          busy: installer.isBusy,
          onInstall: { Task { await install(product) } }
        )
        .tag(product.id)
      }
    }
    .listStyle(.inset)
  }

  private var footer: some View {
    VStack(alignment: .leading, spacing: 8) {
      if installer.isBusy {
        ProgressView(value: installer.progress.fraction) {
          Text(installer.progress.status)
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
        }
      } else if let err = catalog.lastError {
        Text(err)
          .font(.system(size: 12))
          .foregroundStyle(.orange)
      } else if let msg = installer.lastMessage {
        Text(msg)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      } else {
        Text("After installing, fully quit and reopen After Effects.")
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.vertical, 12)
  }

  private func install(_ product: ManifestProduct) async {
    do {
      try await installer.install(product)
      catalog.refreshInstalledVersions()
    } catch {
      alertMessage = error.localizedDescription
    }
  }
}

private struct ProductRow: View {
  let product: ManifestProduct
  let status: String
  let busy: Bool
  let onInstall: () -> Void

  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(accentColor.opacity(0.9))
        .frame(width: 36, height: 36)
        .overlay(
          Text(String(product.shortName.prefix(1)))
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.white)
        )

      VStack(alignment: .leading, spacing: 4) {
        Text(product.shortName)
          .font(.system(size: 14, weight: .semibold))
        Text(product.description ?? "")
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
          .lineLimit(2)
        Text("v\(product.version) · \(status)")
          .font(.system(size: 11))
          .foregroundStyle(.secondary)
      }

      Spacer(minLength: 8)

      Button(status.hasPrefix("Installed") && !status.contains("Update") ? "Reinstall" : "Install") {
        onInstall()
      }
      .buttonStyle(.borderedProminent)
      .tint(accentColor)
      .disabled(busy)
    }
    .padding(.vertical, 6)
  }

  private var accentColor: Color {
    Color(hex: product.accent ?? "#5B6BF8") ?? .accentColor
  }
}

private extension Color {
  init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let value = Int(s, radix: 16) else { return nil }
    let r = Double((value >> 16) & 0xff) / 255
    let g = Double((value >> 8) & 0xff) / 255
    let b = Double(value & 0xff) / 255
    self = Color(red: r, green: g, blue: b)
  }
}
