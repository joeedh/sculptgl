import Buffer from '../render/Buffer.js';
import Shader from '../render/ShaderLib.js';
import WebGLCaps from '../render/WebGLCaps.js';

let singletonBuffer;

class Rtt {
  constructor(gl, shaderName = null, depth = gl.createRenderbuffer(), halfFloat = false) {
    this._gl = gl; // webgl context

    this._texture = gl.createTexture();
    this._depth = depth;
    this._framebuffer = gl.createFramebuffer();

    this._shaderType = shaderName;
    this._invSize = new Float32Array(2);
    this._vertexBuffer = null;

    if (halfFloat && WebGLCaps.hasRTTHalfFloat()) this._type = WebGLCaps.HALF_FLOAT_OES;
    else if (halfFloat && WebGLCaps.hasRTTFloat()) this._type = gl.FLOAT;
    else this._type = gl.UNSIGNED_BYTE;

    this.setWrapRepeat(false);
    this.setFilterNearest(false);
    this.init();
  }

  destroy(gl) {
    if (singletonBuffer) {
      singletonBuffer.release();
      singletonBuffer = undefined;
    }
  }

  getGL() {
    return this._gl;
  }

  getVertexBuffer() {
    return this._vertexBuffer;
  }

  getFramebuffer() {
    return this._framebuffer;
  }

  getTexture() {
    return this._texture;
  }

  getDepth() {
    return this._depth;
  }

  getInverseSize() {
    return this._invSize;
  }

  init() {
    let gl = this._gl;

    if (!singletonBuffer) {
      singletonBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
      singletonBuffer.update(new Float32Array([-1.0, -1.0, 4.0, -1.0, -1.0, 4.0]));
    }

    this._vertexBuffer = singletonBuffer;
  }

  setWrapRepeat(bool) {
    this._wrapRepeat = bool;
  }

  setFilterNearest(bool) {
    this._filterNearest = bool;
  }

  onResize(width, height) {
    let gl = this._gl;

    this._invSize[0] = 1.0/width;
    this._invSize[1] = 1.0/height;

    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, this._type, null);

    let filter = this._filterNearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);

    let wrap = this._wrapRepeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    if (this._depth) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._depth);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  release() {
    if (this._texture) this._gl.deleteTexture(this._texture);
    this.getVertexBuffer().release();
  }

  render(main) {
    Shader[this._shaderType].getOrCreate(this._gl).draw(this, main);
  }
}

export default Rtt;
