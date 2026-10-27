/* Local QR adapter for Andalus Academy.
 * Uses the MIT-licensed qrcode-generator implementation in this folder.
 * Preserves the small subset of the node-qrcode API used by index.html.
 */
(function (global) {
  'use strict';

  function makeQr(text, options) {
    if (typeof global.qrcode !== 'function') {
      throw new Error('مكتبة توليد QR المحلية غير محمّلة. أعد تحميل الصفحة.');
    }
    var level = (options && options.errorCorrectionLevel) || 'M';
    var qr = global.qrcode(0, level);
    qr.addData(String(text == null ? '' : text), 'Byte');
    qr.make();
    return qr;
  }

  function drawQr(canvas, text, options) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('عنصر رسم كود QR غير موجود.');
    }
    options = options || {};
    canvas.dataset.qrReady = 'false';
    var qr = makeQr(text, options);
    var count = qr.getModuleCount();
    var margin = Number.isFinite(Number(options.margin)) ? Math.max(0, Math.floor(Number(options.margin))) : 2;
    var requested = Number(options.width) || 256;
    var moduleSize = Math.max(2, Math.floor(requested / (count + margin * 2)));
    var size = moduleSize * (count + margin * 2);
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر تجهيز مساحة رسم كود QR.');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = options.color && options.color.light ? options.color.light : '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = options.color && options.color.dark ? options.color.dark : '#000000';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * moduleSize, (row + margin) * moduleSize, moduleSize, moduleSize);
        }
      }
    }
    canvas.dataset.qrReady = 'true';
    return canvas;
  }

  function toCanvas(canvas, text, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    try {
      var result = drawQr(canvas, text, options || {});
      if (typeof callback === 'function') callback(null, result);
      return typeof callback === 'function' ? result : Promise.resolve(result);
    } catch (error) {
      if (canvas && canvas.dataset) canvas.dataset.qrReady = 'false';
      if (typeof callback === 'function') {
        callback(error);
        return null;
      }
      return Promise.reject(error);
    }
  }

  function toDataURL(text, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    options = options || {};
    var canvas = global.document.createElement('canvas');
    try {
      drawQr(canvas, text, options);
      var url = canvas.toDataURL(options.type || 'image/png', options.quality);
      if (typeof callback === 'function') {
        callback(null, url);
        return;
      }
      return Promise.resolve(url);
    } catch (error) {
      if (typeof callback === 'function') {
        callback(error);
        return;
      }
      return Promise.reject(error);
    }
  }

  global.QRCode = { toCanvas: toCanvas, toDataURL: toDataURL };
  global.AndalusQrLibraryReady = true;
})(window);
