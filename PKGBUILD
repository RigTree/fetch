# Maintainer: RigTree <https://github.com/RigTree/fetch>
pkgname=rigtree-fetch
pkgver=0.1.0
pkgrel=1
pkgdesc="RigTree Fetch - hardware scan and submit for RigTree"
arch=('x86_64')
url="https://github.com/RigTree/fetch"
license=('MIT')
depends=(webkit2gtk libappindicator-gtk3 libayatana-appindicator libxdo openssl librsvg)
makedepends=(nodejs npm rust)
# Build from current directory (used in CI)
source=(".")
sha256sums=(SKIP)

build() {
  cd "$srcdir"
  npm ci
  npm run tauri build -- --bundles deb
}

package() {
  cd "$srcdir"
  deb=$(echo src-tauri/target/release/bundle/deb/*.deb)
  [ -f "$deb" ] || (echo "No .deb produced"; exit 1)
  ar x "$deb"
  tar xf data.tar.* -C "$pkgdir"
}
