import { vec3, mat4 } from '../lib/gl-matrix.js';
import Geometry from './Geometry.js';
import Tablet from '../misc/Tablet.js';
import Utils from '../misc/Utils.js';
import TR from '../gui/GuiTR.js';

let _TMP_NEAR = [0.0, 0.0, 0.0];
let _TMP_NEAR_1 = [0.0, 0.0, 0.0];
let _TMP_FAR = [0.0, 0.0, 0.0];
let _TMP_INV = mat4.create();
let _TMP_INTER = [0.0, 0.0, 0.0];
let _TMP_INTER_1 = [0.0, 0.0, 0.0];
let _TMP_V1 = [0.0, 0.0, 0.0];
let _TMP_V2 = [0.0, 0.0, 0.0];
let _TMP_V3 = [0.0, 0.0, 0.0];

class Picking {

  static addAlpha(u8, width, height, name) {
    let newAlpha = {};
    newAlpha._name = name;
    newAlpha._texture = u8;
    newAlpha._ratioX = Math.max(1.0, width / height);
    newAlpha._ratioY = Math.max(1.0, height / width);
    newAlpha._ratioMax = Math.max(newAlpha._ratioX, newAlpha._ratioY);
    newAlpha._width = width;
    newAlpha._height = height;
    let i = 1;
    while (Picking.ALPHAS[newAlpha._name])
      newAlpha._name = name + (i++);
    Picking.ALPHAS[newAlpha._name] = newAlpha;
    Picking.ALPHAS_NAMES[newAlpha._name] = newAlpha._name;
    return newAlpha;
  }

  constructor(main, xSym) {
    this._mesh = null; // mesh
    this._main = main; // the camera
    this._pickedFace = -1; // face picked
    this._pickedVertices = []; // vertices selected
    this._interPoint = [0.0, 0.0, 0.0]; // intersection point (mesh local space)
    this._rLocal2 = 0.0; // radius of the selection area (local/object space)
    this._rWorld2 = 0.0; // radius of the selection area (world space)
    this._eyeDir = [0.0, 0.0, 0.0]; // eye direction

    this._xSym = !!xSym;

    this._pickedNormal = [0.0, 0.0, 0.0];
    // alpha stuffs
    this._alphaOrigin = [0.0, 0.0, 0.0];
    this._alphaSide = 0.0;
    this._alphaLookAt = mat4.create();
    this._alpha = null;
  }

  setIdAlpha(id) {
    this._alpha = Picking.ALPHAS[id];
  }

  getAlpha(x, y, z) {
    let alpha = this._alpha;
    if (!alpha || !alpha._texture) return 1.0;

    let m = this._alphaLookAt;
    let rs = this._alphaSide;

    let xn = alpha._ratioY * (m[0] * x + m[4] * y + m[8] * z + m[12]) / (this._xSym ? -rs : rs);
    if (Math.abs(xn) > 1.0) return 0.0;

    let yn = alpha._ratioX * (m[1] * x + m[5] * y + m[9] * z + m[13]) / rs;
    if (Math.abs(yn) > 1.0) return 0.0;

    let aw = alpha._width;
    xn = (0.5 - xn * 0.5) * aw;
    yn = (0.5 - yn * 0.5) * alpha._height;
    return alpha._texture[(xn | 0) + aw * (yn | 0)] / 255.0;
  }

  updateAlpha(keepOrigin) {
    let dir = _TMP_V1;
    let nor = _TMP_V2;

    let radius = Math.sqrt(this._rLocal2);
    this._alphaSide = radius * Math.SQRT1_2;

    vec3.sub(dir, this._interPoint, this._alphaOrigin);
    if (vec3.len(dir) === 0) return;
    vec3.normalize(dir, dir);

    let normal = this._pickedNormal;
    vec3.scaleAndAdd(dir, dir, normal, -vec3.dot(dir, normal));
    vec3.normalize(dir, dir);

    if (!keepOrigin)
      vec3.copy(this._alphaOrigin, this._interPoint);

    vec3.scaleAndAdd(nor, this._alphaOrigin, normal, radius);
    mat4.lookAt(this._alphaLookAt, this._alphaOrigin, nor, dir);
  }

  initAlpha() {
    this.computePickedNormal();
    this.updateAlpha();
  }

  getMesh() {
    return this._mesh;
  }

  setLocalRadius2(radius) {
    this._rLocal2 = radius;
  }

  getLocalRadius2() {
    return this._rLocal2;
  }

  getLocalRadius() {
    return Math.sqrt(this._rLocal2);
  }

  getWorldRadius2() {
    return this._rWorld2;
  }

  getWorldRadius() {
    return Math.sqrt(this._rWorld2);
  }

  setIntersectionPoint(inter) {
    this._interPoint = inter;
  }

  getEyeDirection() {
    return this._eyeDir;
  }

  getIntersectionPoint() {
    return this._interPoint;
  }

  getPickedVertices() {
    return this._pickedVertices;
  }

  getPickedFace() {
    return this._pickedFace;
  }

  getPickedNormal() {
    return this._pickedNormal;
  }

  /** Intersection between a ray the mouse position for every meshes */
  intersectionMouseMeshes(meshes = this._main.getMeshes(), mouseX = this._main._mouseX, mouseY = this._main._mouseY) {

    let vNear = this.unproject(mouseX, mouseY, 0.0);
    let vFar = this.unproject(mouseX, mouseY, 0.1);
    let nearDistance = Infinity;
    let nearMesh = null;
    let nearFace = -1;

    for (let i = 0, nbMeshes = meshes.length; i < nbMeshes; ++i) {
      let mesh = meshes[i];
      if (!mesh.isVisible())
        continue;

      mat4.invert(_TMP_INV, mesh.getMatrix());
      vec3.transformMat4(_TMP_NEAR_1, vNear, _TMP_INV);
      vec3.transformMat4(_TMP_FAR, vFar, _TMP_INV);
      if (!this.intersectionRayMesh(mesh, _TMP_NEAR_1, _TMP_FAR))
        continue;

      let interTest = this.getIntersectionPoint();
      let testDistance = vec3.dist(_TMP_NEAR_1, interTest) * mesh.getScale();
      if (testDistance < nearDistance) {
        nearDistance = testDistance;
        nearMesh = mesh;
        vec3.copy(_TMP_INTER_1, interTest);
        nearFace = this.getPickedFace();
      }
    }

    this._mesh = nearMesh;
    vec3.copy(this._interPoint, _TMP_INTER_1);
    this._pickedFace = nearFace;
    if (nearFace !== -1)
      this.updateLocalAndWorldRadius2();
    return !!nearMesh;
  }

  /** Intersection between a ray the mouse position */
  intersectionMouseMesh(mesh = this._main.getMesh(), mouseX = this._main._mouseX, mouseY = this._main._mouseY) {
    let vNear = this.unproject(mouseX, mouseY, 0.0);
    let vFar = this.unproject(mouseX, mouseY, 0.1);
    let matInverse = mat4.create();
    mat4.invert(matInverse, mesh.getMatrix());
    vec3.transformMat4(vNear, vNear, matInverse);
    vec3.transformMat4(vFar, vFar, matInverse);
    return this.intersectionRayMesh(mesh, vNear, vFar);
  }

  /** Intersection between a ray and a mesh */
  intersectionRayMesh(mesh, vNearOrig, vFarOrig) {
    // resest picking
    this._mesh = null;
    this._pickedFace = -1;
    // resest picking
    vec3.copy(_TMP_NEAR, vNearOrig);
    vec3.copy(_TMP_FAR, vFarOrig);
    // apply symmetry
    if (this._xSym) {
      let ptPlane = mesh.getSymmetryOrigin();
      let nPlane = mesh.getSymmetryNormal();
      Geometry.mirrorPoint(_TMP_NEAR, ptPlane, nPlane);
      Geometry.mirrorPoint(_TMP_FAR, ptPlane, nPlane);
    }
    let vAr = mesh.getVertices();
    let fAr = mesh.getFaces();
    // compute eye direction
    let eyeDir = this.getEyeDirection();
    vec3.sub(eyeDir, _TMP_FAR, _TMP_NEAR);
    vec3.normalize(eyeDir, eyeDir);
    let iFacesCandidates = mesh.intersectRay(_TMP_NEAR, eyeDir);
    let distance = Infinity;
    let nbFacesCandidates = iFacesCandidates.length;
    for (let i = 0; i < nbFacesCandidates; ++i) {
      let indFace = iFacesCandidates[i] * 4;
      let ind1 = fAr[indFace] * 3;
      let ind2 = fAr[indFace + 1] * 3;
      let ind3 = fAr[indFace + 2] * 3;
      _TMP_V1[0] = vAr[ind1];
      _TMP_V1[1] = vAr[ind1 + 1];
      _TMP_V1[2] = vAr[ind1 + 2];
      _TMP_V2[0] = vAr[ind2];
      _TMP_V2[1] = vAr[ind2 + 1];
      _TMP_V2[2] = vAr[ind2 + 2];
      _TMP_V3[0] = vAr[ind3];
      _TMP_V3[1] = vAr[ind3 + 1];
      _TMP_V3[2] = vAr[ind3 + 2];
      let hitDist = Geometry.intersectionRayTriangle(_TMP_NEAR, eyeDir, _TMP_V1, _TMP_V2, _TMP_V3, _TMP_INTER);
      if (hitDist < 0.0) {
        ind2 = fAr[indFace + 3];
        if (ind2 !== Utils.TRI_INDEX) {
          ind2 *= 3;
          _TMP_V2[0] = vAr[ind2];
          _TMP_V2[1] = vAr[ind2 + 1];
          _TMP_V2[2] = vAr[ind2 + 2];
          hitDist = Geometry.intersectionRayTriangle(_TMP_NEAR, eyeDir, _TMP_V1, _TMP_V3, _TMP_V2, _TMP_INTER);
        }
      }
      if (hitDist >= 0.0 && hitDist < distance) {
        distance = hitDist;
        vec3.copy(this._interPoint, _TMP_INTER);
        this._pickedFace = iFacesCandidates[i];
      }
    }
    if (this._pickedFace !== -1) {
      this._mesh = mesh;
      this.updateLocalAndWorldRadius2();
      return true;
    }
    this._rLocal2 = 0.0;
    return false;
  }

  /** Find all the vertices inside the sphere */
  pickVerticesInSphere(rLocal2) {
    let mesh = this._mesh;
    let vAr = mesh.getVertices();
    let vertSculptFlags = mesh.getVerticesSculptFlags();
    let inter = this.getIntersectionPoint();

    let iFacesInCells = mesh.intersectSphere(inter, rLocal2, true);
    let iVerts = mesh.getVerticesFromFaces(iFacesInCells);
    let nbVerts = iVerts.length;

    let sculptFlag = ++Utils.SCULPT_FLAG;
    let pickedVertices = new Uint32Array(Utils.getMemory(4 * nbVerts), 0, nbVerts);
    let acc = 0;
    let itx = inter[0];
    let ity = inter[1];
    let itz = inter[2];

    for (let i = 0; i < nbVerts; ++i) {
      let ind = iVerts[i];
      let j = ind * 3;
      let dx = itx - vAr[j];
      let dy = ity - vAr[j + 1];
      let dz = itz - vAr[j + 2];
      if ((dx * dx + dy * dy + dz * dz) < rLocal2) {
        vertSculptFlags[ind] = sculptFlag;
        pickedVertices[acc++] = ind;
      }
    }

    this._pickedVertices = new Uint32Array(pickedVertices.subarray(0, acc));
    return this._pickedVertices;
  }

  _isInsideSphere(id, inter, rLocal2) {
    if (id === Utils.TRI_INDEX) return false;
    let iv = id * 3;
    return vec3.sqrDist(inter, this._mesh.getVertices().subarray(iv, iv + 3)) <= rLocal2;
  }

  /** Find all the vertices inside the sphere (with topological check) */
  pickVerticesInSphereTopological(rLocal2) {
    let mesh = this._mesh;
    let nbVertices = mesh.getNbVertices();
    let vAr = mesh.getVertices();
    let fAr = mesh.getFaces();

    let vrvStartCount = mesh.getVerticesRingVertStartCount();
    let vertRingVert = mesh.getVerticesRingVert();
    let ringVerts = vertRingVert instanceof Array ? vertRingVert : null;

    let vertSculptFlags = mesh.getVerticesSculptFlags();
    let vertTagFlags = mesh.getVerticesTagFlags();

    let sculptFlag = ++Utils.SCULPT_FLAG;
    let tagFlag = ++Utils.TAG_FLAG;

    let inter = this.getIntersectionPoint();
    let itx = inter[0];
    let ity = inter[1];
    let itz = inter[2];

    let pickedVertices = new Uint32Array(Utils.getMemory(4 * nbVertices), 0, nbVertices);
    let idf = this.getPickedFace() * 4;
    let acc = 1;

    if (this._isInsideSphere(fAr[idf], inter, rLocal2)) pickedVertices[0] = fAr[idf];
    else if (this._isInsideSphere(fAr[idf + 1], inter, rLocal2)) pickedVertices[0] = fAr[idf + 1];
    else if (this._isInsideSphere(fAr[idf + 2], inter, rLocal2)) pickedVertices[0] = fAr[idf + 2];
    else if (this._isInsideSphere(fAr[idf + 3], inter, rLocal2)) pickedVertices[0] = fAr[idf + 3];
    else acc = 0;

    if (acc === 1) {
      vertSculptFlags[pickedVertices[0]] = sculptFlag;
      vertTagFlags[pickedVertices[0]] = tagFlag;
    }

    for (let i = 0; i < acc; ++i) {
      let id = pickedVertices[i];
      let start, end;
      if (ringVerts) {
        vertRingVert = ringVerts[id];
        start = 0;
        end = vertRingVert.length;
      } else {
        start = vrvStartCount[id * 2];
        end = start + vrvStartCount[id * 2 + 1];
      }

      for (let j = start; j < end; ++j) {
        let idv = vertRingVert[j];
        if (vertTagFlags[idv] === tagFlag)
          continue;
        vertTagFlags[idv] = tagFlag;

        let id3 = idv * 3;
        let dx = itx - vAr[id3];
        let dy = ity - vAr[id3 + 1];
        let dz = itz - vAr[id3 + 2];
        if ((dx * dx + dy * dy + dz * dz) > rLocal2)
          continue;

        vertSculptFlags[idv] = sculptFlag;
        pickedVertices[acc++] = idv;
      }
    }

    this._pickedVertices = new Uint32Array(pickedVertices.subarray(0, acc));
    return this._pickedVertices;
  }

  computeWorldRadius2(ignorePressure) {

    vec3.transformMat4(_TMP_INTER, this.getIntersectionPoint(), this._mesh.getMatrix());

    let offsetX = this._main.getSculptManager().getCurrentTool().getScreenRadius();
    if (!ignorePressure) offsetX *= Tablet.getPressureRadius();

    let screenInter = this.project(_TMP_INTER);
    return vec3.sqrDist(_TMP_INTER, this.unproject(screenInter[0] + offsetX, screenInter[1], screenInter[2]));
  }

  updateLocalAndWorldRadius2() {
    if (!this._mesh) return;
    this._rWorld2 = this.computeWorldRadius2();
    this._rLocal2 = this._rWorld2 / this._mesh.getScale2();
  }

  unproject(x, y, z) {
    return this._main.getCamera().unproject(x, y, z);
  }

  project(vec) {
    return this._main.getCamera().project(vec);
  }

  computePickedNormal() {
    if (!this._mesh || this._pickedFace < 0) return;
    this.polyLerp(this._mesh.getNormals(), this._pickedNormal);
    return vec3.normalize(this._pickedNormal, this._pickedNormal);
  }

  polyLerp(vField, out) {
    let vAr = this._mesh.getVertices();
    let fAr = this._mesh.getFaces();
    let id = this._pickedFace * 4;
    let iv1 = fAr[id] * 3;
    let iv2 = fAr[id + 1] * 3;
    let iv3 = fAr[id + 2] * 3;

    let iv4 = fAr[id + 3];
    let isQuad = iv4 !== Utils.TRI_INDEX;
    if (isQuad) iv4 *= 3;

    let len1 = 1.0 / vec3.dist(this._interPoint, vAr.subarray(iv1, iv1 + 3));
    let len2 = 1.0 / vec3.dist(this._interPoint, vAr.subarray(iv2, iv2 + 3));
    let len3 = 1.0 / vec3.dist(this._interPoint, vAr.subarray(iv3, iv3 + 3));
    let len4 = isQuad ? 1.0 / vec3.dist(this._interPoint, vAr.subarray(iv4, iv4 + 3)) : 0.0;

    let invSum = 1.0 / (len1 + len2 + len3 + len4);
    vec3.set(out, 0.0, 0.0, 0.0);
    vec3.scaleAndAdd(out, out, vField.subarray(iv1, iv1 + 3), len1 * invSum);
    vec3.scaleAndAdd(out, out, vField.subarray(iv2, iv2 + 3), len2 * invSum);
    vec3.scaleAndAdd(out, out, vField.subarray(iv3, iv3 + 3), len3 * invSum);
    if (isQuad) vec3.scaleAndAdd(out, out, vField.subarray(iv4, iv4 + 3), len4 * invSum);
    return out;
  }
}

// TODO update i18n strings in a dynamic way
Picking.INIT_ALPHAS_NAMES = [TR('alphaSquare'), TR('alphaSkin')];
Picking.INIT_ALPHAS_PATHS = ['square.jpg', 'skin.jpg'];

let readAlphas = function () {
  // check nodejs
  if (!window.module || !window.module.exports) return;
  let fs = eval('require')('fs');
  let path = eval('require')('path');

  let directoryPath = path.join(window.__filename, '../resources/alpha');
  fs.readdir(directoryPath, function (err, files) {
    if (err) return;
    for (let i = 0; i < files.length; ++i) {
      let fname = files[i];
      if (fname == 'square.jpg' || fname == 'skin.jpg') continue;
      Picking.INIT_ALPHAS_NAMES.push(fname);
      Picking.INIT_ALPHAS_PATHS.push(fname);
    }
  });
};

readAlphas();

let none = TR('alphaNone');
Picking.ALPHAS_NAMES = {};
Picking.ALPHAS_NAMES[none] = none;

Picking.ALPHAS = {};
Picking.ALPHAS[none] = null;

export default Picking;
