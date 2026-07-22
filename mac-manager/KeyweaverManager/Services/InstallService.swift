import CryptoKit
import Foundation

enum InstallError: LocalizedError {
  case noMacPackage
  case checksumMismatch(expected: String, actual: String)
  case installScriptMissing(String)
  case installFailed(String)
  case unzipFailed

  var errorDescription: String? {
    switch self {
    case .noMacPackage:
      return "No macOS package URL in the catalog for this plugin."
    case .checksumMismatch:
      return "Download verification failed (checksum mismatch). Try again or use the zip from keyweaver.io/download."
    case .installScriptMissing(let name):
      return "Install script not found in the package: \(name)"
    case .installFailed(let message):
      return message
    case .unzipFailed:
      return "Could not extract the download."
    }
  }
}

struct InstallProgress: Sendable {
  var fraction: Double
  var status: String
}

@MainActor
final class InstallService: ObservableObject {
  @Published private(set) var isBusy = false
  @Published private(set) var progress = InstallProgress(fraction: 0, status: "")
  @Published private(set) var lastMessage: String?

  private let session: URLSession
  private let cacheRoot: URL
  private let stateRoot: URL

  init(session: URLSession = .shared) {
    self.session = session
    let home = FileManager.default.homeDirectoryForCurrentUser
    self.cacheRoot = home.appendingPathComponent("Library/Caches/Keyweaver", isDirectory: true)
    self.stateRoot = home.appendingPathComponent("Library/Application Support/Keyweaver/State", isDirectory: true)
  }

  func install(_ product: ManifestProduct) async throws {
    guard !isBusy else { return }
    guard let pack = product.platforms.mac, !pack.packageUrl.isEmpty else {
      throw InstallError.noMacPackage
    }

    isBusy = true
    lastMessage = nil
    defer { isBusy = false }

    let fm = FileManager.default
    try fm.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    try fm.createDirectory(at: stateRoot, withIntermediateDirectories: true)

    let version = product.version.isEmpty ? "latest" : product.version
    let zipName = "\(product.id)-mac-v\(version).zip"
      .replacingOccurrences(of: "[^\\w.\\-]", with: "_", options: .regularExpression)
    let zipPath = cacheRoot.appendingPathComponent(zipName)
    let extractRoot = cacheRoot.appendingPathComponent("extract/\(product.id)-v\(version)", isDirectory: true)

    update(0.05, "Downloading \(product.shortName)…")
    try await download(urlString: pack.packageUrl, to: zipPath, label: product.shortName, expectedBytes: pack.sizeBytes)

    if let expected = pack.sha256?.lowercased(), !expected.isEmpty {
      update(0.78, "Verifying \(product.shortName) download…")
      let actual = try sha256Hex(of: zipPath)
      if actual != expected {
        throw InstallError.checksumMismatch(expected: expected, actual: actual)
      }
    }

    update(0.86, "Extracting \(product.shortName)…")
    if fm.fileExists(atPath: extractRoot.path) {
      try fm.removeItem(at: extractRoot)
    }
    try fm.createDirectory(at: extractRoot, withIntermediateDirectories: true)
    try unzip(zipPath, to: extractRoot)

    let scriptName = (pack.installScript?.isEmpty == false)
      ? pack.installScript!
      : "\(product.id)-install-macos.sh"
    guard let scriptURL = findFile(named: scriptName, under: extractRoot) else {
      throw InstallError.installScriptMissing(scriptName)
    }

    update(0.94, "Installing \(product.shortName) into After Effects…")
    try runInstallScript(scriptURL)

    let state = InstalledProductState(
      id: product.id,
      version: version,
      installedAt: ISO8601DateFormatter().string(from: Date())
    )
    let stateURL = stateRoot.appendingPathComponent("installed-\(product.id).json")
    let data = try JSONEncoder().encode(state)
    try data.write(to: stateURL, options: .atomic)

    update(1.0, "\(product.shortName) installed.")
    lastMessage = "\(product.shortName) installed. Fully quit and reopen After Effects, then open \(product.menuPath ?? "Window → Extensions")."
  }

  private func update(_ fraction: Double, _ status: String) {
    progress = InstallProgress(fraction: fraction, status: status)
  }

  private func download(urlString: String, to destination: URL, label: String, expectedBytes: Int64?) async throws {
    guard let url = URL(string: urlString) else { throw InstallError.noMacPackage }
    if FileManager.default.fileExists(atPath: destination.path) {
      try FileManager.default.removeItem(at: destination)
    }

    var request = URLRequest(url: url)
    request.setValue("Keyweaver-Manager-Mac/1.0", forHTTPHeaderField: "User-Agent")
    request.timeoutInterval = 30 * 60

    // Progress while downloading: poll file size on a timer-like loop via AsyncStream is heavy;
    // use download(for:) then copy — for large Cuemark zips this is fine and reliable.
    update(0.08, "Downloading \(label)…")
    let (tempURL, response) = try await session.download(for: request)
    if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
      throw InstallError.installFailed("Download failed (HTTP \(http.statusCode)).")
    }

    let expected = expectedBytes
      ?? Int64((response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Length").flatMap(Int64.init) ?? -1)
    if expected > 0 {
      let mb = max(1, Int((Double(expected) / 1_048_576.0).rounded()))
      update(0.70, "Downloading \(label)… 100% out of \(mb) MB")
    } else {
      update(0.70, "Downloading \(label)…")
    }

    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.moveItem(at: tempURL, to: destination)
  }

  private func sha256Hex(of fileURL: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: fileURL)
    defer { try? handle.close() }
    var hasher = SHA256()
    while autoreleasepool(invoking: {
      let chunk = handle.readData(ofLength: 1024 * 1024)
      if chunk.isEmpty { return false }
      hasher.update(data: chunk)
      return true
    }) {}
    let digest = hasher.finalize()
    return digest.map { String(format: "%02x", $0) }.joined()
  }

  private func unzip(_ zipURL: URL, to destination: URL) throws {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
    process.arguments = ["-x", "-k", zipURL.path, destination.path]
    let err = Pipe()
    process.standardError = err
    try process.run()
    process.waitUntilExit()
    if process.terminationStatus != 0 {
      let message = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
      throw InstallError.installFailed(message.isEmpty ? "Unzip failed." : message)
    }
  }

  private func findFile(named name: String, under root: URL) -> URL? {
    let fm = FileManager.default
    guard let enumerator = fm.enumerator(at: root, includingPropertiesForKeys: nil) else { return nil }
    for case let url as URL in enumerator {
      if url.lastPathComponent == name {
        return url
      }
    }
    return nil
  }

  private func runInstallScript(_ scriptURL: URL) throws {
    // Product scripts normally pause for Enter — run with stdin closed / non-interactive.
    // Prefer calling the shared core via a non-interactive wrapper.
    let scriptDir = scriptURL.deletingLastPathComponent()
    let fm = FileManager.default

    // Make scripts executable
    try? fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: scriptURL.path)
    if let core = findFile(named: "keyweaver-install-core.sh", under: scriptDir) {
      try? fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: core.path)
    }

    // Non-interactive install: source product script logic without the trailing "Press Enter".
    // We invoke bash -c that sources core + runs the same kw_install_cep_panel call by executing
    // the product script with KEYWEAVER_NONINTERACTIVE=1 if supported, else strip the pause.
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/bash")
    process.currentDirectoryURL = scriptDir
    process.environment = ProcessInfo.processInfo.environment.merging([
      "KEYWEAVER_NONINTERACTIVE": "1"
    ]) { _, new in new }

    // Feed a newline so legacy "read -p Press Enter" scripts don't hang.
    let input = Pipe()
    let output = Pipe()
    let err = Pipe()
    process.standardInput = input
    process.standardOutput = output
    process.standardError = err
    process.arguments = [scriptURL.path]

    try process.run()
    input.fileHandleForWriting.write(Data("\n".utf8))
    try? input.fileHandleForWriting.close()
    process.waitUntilExit()

    let stdout = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let stderr = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    if process.terminationStatus != 0 {
      let combined = (stderr.isEmpty ? stdout : stderr).trimmingCharacters(in: .whitespacesAndNewlines)
      throw InstallError.installFailed(combined.isEmpty ? "Install script failed." : combined)
    }
  }
}
