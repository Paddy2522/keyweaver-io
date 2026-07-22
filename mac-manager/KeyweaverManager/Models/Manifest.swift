import Foundation

struct InstallerManifest: Codable, Sendable {
  var manifestVersion: Int?
  var publisher: String?
  var catalogUrl: String?
  var products: [ManifestProduct]
}

struct ManifestProduct: Codable, Identifiable, Sendable, Hashable {
  var id: String
  var displayName: String
  var description: String?
  var panelId: String
  var version: String
  var platforms: ManifestPlatforms
  var helpUrl: String?
  var menuPath: String?
  var accent: String?

  var shortName: String {
    if id == "cuemark" { return "Cuemark" }
    let trimmed = displayName
      .replacingOccurrences(of: " by Keyweaver", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? id.capitalized : trimmed
  }
}

struct ManifestPlatforms: Codable, Sendable, Hashable {
  var mac: ManifestPackage?
  var win: ManifestPackage?
}

struct ManifestPackage: Codable, Sendable, Hashable {
  var packageUrl: String
  var sha256: String?
  var sizeBytes: Int64?
  var installScript: String?
}

struct InstalledProductState: Codable, Sendable {
  var id: String
  var version: String
  var installedAt: String
}
