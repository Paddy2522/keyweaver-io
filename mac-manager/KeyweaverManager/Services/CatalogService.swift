import Foundation

enum CatalogError: LocalizedError {
  case badURL
  case httpStatus(Int)
  case emptyCatalog
  case decodeFailed

  var errorDescription: String? {
    switch self {
    case .badURL: return "Invalid catalog URL."
    case .httpStatus(let code): return "Catalog request failed (HTTP \(code))."
    case .emptyCatalog: return "Plugin catalog is empty."
    case .decodeFailed: return "Could not read the plugin catalog."
    }
  }
}

@MainActor
final class CatalogService: ObservableObject {
  static let defaultManifestURL = URL(string: "https://keyweaver.io/installer/manifest.json")!

  @Published private(set) var products: [ManifestProduct] = []
  @Published private(set) var lastError: String?
  @Published private(set) var isLoading = false
  @Published private(set) var installedVersions: [String: String] = [:]

  private let manifestURL: URL
  private let session: URLSession
  private let stateRoot: URL
  private let cepRoot: URL

  init(
    manifestURL: URL = CatalogService.defaultManifestURL,
    session: URLSession = .shared
  ) {
    self.manifestURL = manifestURL
    self.session = session
    let home = FileManager.default.homeDirectoryForCurrentUser
    self.stateRoot = home
      .appendingPathComponent("Library/Application Support/Keyweaver/State", isDirectory: true)
    self.cepRoot = home
      .appendingPathComponent("Library/Application Support/Adobe/CEP/extensions", isDirectory: true)
  }

  func refresh() async {
    isLoading = true
    lastError = nil
    defer { isLoading = false }

    do {
      try FileManager.default.createDirectory(at: stateRoot, withIntermediateDirectories: true)
      var request = URLRequest(url: manifestURL)
      request.cachePolicy = .reloadIgnoringLocalCacheData
      request.setValue("Keyweaver-Manager-Mac/1.0", forHTTPHeaderField: "User-Agent")
      let (data, response) = try await session.data(for: request)
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        throw CatalogError.httpStatus(http.statusCode)
      }
      let decoded = try JSONDecoder().decode(InstallerManifest.self, from: data)
      let macProducts = decoded.products.filter { $0.platforms.mac?.packageUrl.isEmpty == false }
      if macProducts.isEmpty { throw CatalogError.emptyCatalog }
      products = macProducts
      let cache = stateRoot.appendingPathComponent("manifest.json")
      try data.write(to: cache, options: .atomic)
      refreshInstalledVersions()
    } catch {
      lastError = error.localizedDescription
      if products.isEmpty, let cached = loadCachedManifest() {
        products = cached
        refreshInstalledVersions()
        lastError = "Using cached catalog — \(error.localizedDescription)"
      }
    }
  }

  func refreshInstalledVersions() {
    var map: [String: String] = [:]
    for product in products {
      if let v = readInstalledPanelVersion(panelId: product.panelId) {
        map[product.id] = v
      } else if let state = readInstalledState(productId: product.id) {
        map[product.id] = state.version
      }
    }
    installedVersions = map
  }

  func statusText(for product: ManifestProduct) -> String {
    guard let installed = installedVersions[product.id], !installed.isEmpty else {
      return "Not installed"
    }
    if compareSemver(installed, product.version) < 0 {
      return "Update available (v\(installed) → v\(product.version))"
    }
    return "Installed v\(installed)"
  }

  private func loadCachedManifest() -> [ManifestProduct]? {
    let cache = stateRoot.appendingPathComponent("manifest.json")
    guard let data = try? Data(contentsOf: cache),
          let decoded = try? JSONDecoder().decode(InstallerManifest.self, from: data) else {
      return nil
    }
    return decoded.products.filter { $0.platforms.mac?.packageUrl.isEmpty == false }
  }

  private func readInstalledState(productId: String) -> InstalledProductState? {
    let path = stateRoot.appendingPathComponent("installed-\(productId).json")
    guard let data = try? Data(contentsOf: path) else { return nil }
    return try? JSONDecoder().decode(InstalledProductState.self, from: data)
  }

  private func readInstalledPanelVersion(panelId: String) -> String? {
    let manifest = cepRoot
      .appendingPathComponent(panelId, isDirectory: true)
      .appendingPathComponent("CSXS/manifest.xml")
    guard let text = try? String(contentsOf: manifest, encoding: .utf8) else { return nil }
    let marker = "ExtensionBundleVersion=\""
    guard let start = text.range(of: marker)?.upperBound,
          let end = text[start...].firstIndex(of: "\"") else {
      return nil
    }
    return String(text[start..<end])
  }

  private func compareSemver(_ a: String, _ b: String) -> Int {
    let pa = a.split(separator: ".").map { Int($0) ?? 0 }
    let pb = b.split(separator: ".").map { Int($0) ?? 0 }
    let n = max(pa.count, pb.count)
    for i in 0..<n {
      let x = i < pa.count ? pa[i] : 0
      let y = i < pb.count ? pb[i] : 0
      if x < y { return -1 }
      if x > y { return 1 }
    }
    return 0
  }
}
