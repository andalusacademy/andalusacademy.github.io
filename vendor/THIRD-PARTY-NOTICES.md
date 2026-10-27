# Third-party software bundled with the Andalus Academy QR tools

The QR tools are served locally from this repository to avoid depending on third-party CDNs at runtime.

- **qrcode-generator** by Kazuhiko Arase; the source retains its MIT license header. UTF-8 support is from the same project.
- **JSZip 3.10.2**; the minified bundle retains its license notice.
- **html5-qrcode 2.3.8**; distributed under the Apache License 2.0. The license text is in `html5-qrcode.LICENSE`.
- **qr-code-adapter.js** is a small integration wrapper authored for this repository; it adapts qrcode-generator to the `QRCode.toCanvas` and `QRCode.toDataURL` methods used by the application.
