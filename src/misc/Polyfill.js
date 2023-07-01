// polyfills stuffs

if (!Array.prototype.remove) {
  Array.prototype.remove = function(item, throw_error=true) {
    let i = this.indexOf(item);

    if (i < 0) {
      if (throw_error) {
        console.error("Item not in array:", item);
        throw new Error("item not in array:" + item);
      } else {
        console.warn("Item not in array:", item);
      }

      return;
    }

    while (i < this.length - 1) {
      this[i] = this[i+1];
      i++;
    }

    this[i] = undefined;
    this.length--;
  };
}

if (!Float32Array.prototype.slice) {
  var slicePolyfill = function (start, end) {
    return new this.constructor(this.subarray(start, end));
  };

  Int8Array.prototype.slice = slicePolyfill;
  Uint8Array.prototype.slice = slicePolyfill;
  Uint8ClampedArray.prototype.slice = slicePolyfill;
  Int16Array.prototype.slice = slicePolyfill;
  Uint16Array.prototype.slice = slicePolyfill;
  Int32Array.prototype.slice = slicePolyfill;
  Uint32Array.prototype.slice = slicePolyfill;
  Float32Array.prototype.slice = slicePolyfill;
  Float64Array.prototype.slice = slicePolyfill;
}

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function (str) {
    return this.slice(-str.length) === str;
  };
}

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) === str;
  };
}

var vendors = ['moz', 'webkit'];
for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
  window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
}
if (!window.requestAnimationFrame)
  window.alert('browser is too old. Probably no webgl there anyway');
