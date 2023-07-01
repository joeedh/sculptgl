import {mat3, mat4, vec3} from '../lib/gl-matrix.js';
import Buffer from '../render/Buffer.js';
import ShaderLib from '../render/ShaderLib.js';
import Enums from '../misc/Enums.js';

let _TMP_MATPV = mat4.create();
let _TMP_MAT = mat4.create();
let _TMP_VEC = [0.0, 0.0, 0.0];
let _TMP_AXIS = [0.0, 0.0, 0.0];
let _BASE = [0.0, 0.0, 1.0];

let DOT_RADIUS = 50.0;

class Selection {
  constructor(gl) {
    this._gl = gl;

    this._circleBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    this._dotBuffer = new Buffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW);

    this._cacheDotMVP = mat4.create();
    this._cacheDotSymMVP = mat4.create();
    this._cacheCircleMVP = mat4.create();
    this._color = new Float32Array([0.8, 0.0, 0.0]);

    this._offsetX = 0.0; // horizontal offset (when editing the radius)
    this._isEditMode = false;

    this.init();
  }

  getGL() {
    return this._gl;
  }

  getCircleBuffer() {
    return this._circleBuffer;
  }

  getDotBuffer() {
    return this._dotBuffer;
  }

  getCircleMVP() {
    return this._cacheCircleMVP;
  }

  getDotMVP() {
    return this._cacheDotMVP;
  }

  getDotSymmetryMVP() {
    return this._cacheDotSymMVP;
  }

  getColor() {
    return this._color;
  }

  setIsEditMode(bool) {
    this._isEditMode = bool;
  }

  getIsEditMode() {
    return this._isEditMode;
  }

  setOffsetX(offset) {
    this._offsetX = offset;
  }

  getOffsetX() {
    return this._offsetX;
  }

  init() {
    this.getCircleBuffer().update(this._getCircleVertices(1.0));
    this.getDotBuffer().update(this._getDotVertices(0.05, 10));
  }

  release() {
    this.getCircleBuffer().release();
    this.getDotBuffer().release();
  }

  _getCircleVertices(radius = 1.0, nbVertices = 50, full = false) {
    let arc = Math.PI*2;

    let start = full ? 1 : 0;
    let end = full ? nbVertices + 2 : nbVertices;
    let vertices = new Float32Array(end*3);
    for (let i = start; i < end; ++i) {
      let j = i*3;
      let segment = (arc*i)/nbVertices;
      vertices[j] = Math.cos(segment)*radius;
      vertices[j + 1] = Math.sin(segment)*radius;
    }
    return vertices;
  }

  _getDotVertices(r, nb) {
    return this._getCircleVertices(r, nb, true);
  }

  _updateMatricesBackground(camera, main) {

    let screenRadius = main.getSculptManager().getCurrentTool().getScreenRadius();

    let w = camera._width*0.5;
    let h = camera._height*0.5;
    // no need to recompute the ortho proj each time though
    mat4.ortho(_TMP_MATPV, -w, w, -h, h, -10.0, 10.0);

    mat4.identity(_TMP_MAT);
    mat4.translate(_TMP_MAT, _TMP_MAT, vec3.set(_TMP_VEC, -w + main._mouseX + this._offsetX, h - main._mouseY, 0.0));
    // circle mvp
    mat4.scale(this._cacheCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, screenRadius, screenRadius, screenRadius));
    mat4.mul(this._cacheCircleMVP, _TMP_MATPV, this._cacheCircleMVP);
    // dot mvp
    mat4.scale(this._cacheDotMVP, _TMP_MAT, vec3.set(_TMP_VEC, DOT_RADIUS, DOT_RADIUS, DOT_RADIUS));
    mat4.mul(this._cacheDotMVP, _TMP_MATPV, this._cacheDotMVP);
    // symmetry mvp
    mat4.scale(this._cacheDotSymMVP, this._cacheDotSymMVP, [0.0, 0.0, 0.0]);
  }

  _updateMatricesMesh(camera, main) {
    let picking = main.getPicking();
    let pickingSym = main.getPickingSymmetry();
    let worldRadius = Math.sqrt(picking.computeWorldRadius2(true));
    let screenRadius = main.getSculptManager().getCurrentTool().getScreenRadius();

    let mesh = picking.getMesh();
    let constRadius = DOT_RADIUS*(worldRadius/screenRadius);

    picking.polyLerp(mesh.getNormals(), _TMP_AXIS);
    vec3.transformMat3(_TMP_AXIS, _TMP_AXIS, mat3.normalFromMat4(_TMP_MAT, mesh.getMatrix()));
    vec3.normalize(_TMP_AXIS, _TMP_AXIS);
    let rad = Math.acos(vec3.dot(_BASE, _TMP_AXIS));
    vec3.cross(_TMP_AXIS, _BASE, _TMP_AXIS);

    mat4.identity(_TMP_MAT);
    mat4.translate(_TMP_MAT, _TMP_MAT, vec3.transformMat4(_TMP_VEC, picking.getIntersectionPoint(), mesh.getMatrix()));
    mat4.rotate(_TMP_MAT, _TMP_MAT, rad, _TMP_AXIS);

    mat4.mul(_TMP_MATPV, camera.getProjection(), camera.getView());

    // circle mvp
    mat4.scale(this._cacheCircleMVP, _TMP_MAT, vec3.set(_TMP_VEC, worldRadius, worldRadius, worldRadius));
    mat4.mul(this._cacheCircleMVP, _TMP_MATPV, this._cacheCircleMVP);
    // dot mvp
    mat4.scale(this._cacheDotMVP, _TMP_MAT, vec3.set(_TMP_VEC, constRadius, constRadius, constRadius));
    mat4.mul(this._cacheDotMVP, _TMP_MATPV, this._cacheDotMVP);
    // symmetry mvp
    vec3.transformMat4(_TMP_VEC, pickingSym.getIntersectionPoint(), mesh.getMatrix());
    mat4.identity(_TMP_MAT);
    mat4.translate(_TMP_MAT, _TMP_MAT, _TMP_VEC);
    mat4.rotate(_TMP_MAT, _TMP_MAT, rad, _TMP_AXIS);

    mat4.scale(_TMP_MAT, _TMP_MAT, vec3.set(_TMP_VEC, constRadius, constRadius, constRadius));
    mat4.mul(this._cacheDotSymMVP, _TMP_MATPV, _TMP_MAT);
  }

  render(main) {
    // if there's an offset then it means we are editing the tool radius
    let pickedMesh = main.getPicking().getMesh() && !this._isEditMode;
    if (pickedMesh) this._updateMatricesMesh(main.getCamera(), main);
    else this._updateMatricesBackground(main.getCamera(), main);

    let drawCircle = main._action === Enums.Action.NOTHING;
    vec3.set(this._color, 0.8, drawCircle && pickedMesh ? 0.0 : 0.4, 0.0);
    ShaderLib[Enums.Shader.SELECTION].getOrCreate(this._gl).draw(this, drawCircle, main.getSculptManager().getSymmetry());

    this._isEditMode = false;
  }
}

export default Selection;
