import {vec3, mat3} from '../../lib/gl-matrix.js';
import Utils from '../../misc/Utils.js';
import SculptBase from './SculptBase.js';
import Paint from './Paint.js';
import Smooth from './Smooth.js';
import MeshStatic from '../../mesh/meshStatic/MeshStatic.js';

class Masking extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._hardness = 0.25;
    this._intensity = 1.0;
    this._negative = true;
    this._culling = false;
    this._idAlpha = 0;
    this._lockPosition = false;

    this._thickness = 1.0;
  }

  pushState() {
    // too lazy to add a pushStateMaterial
    this._main.getStateManager().pushStateColorAndMaterial(this.getMesh());
  }

  updateMeshBuffers() {
    let mesh = this.getMesh();
    if (mesh.isDynamic)
      mesh.updateBuffers();
    else
      mesh.updateMaterialBuffer();
  }

  stroke(picking) {
    Paint.prototype.stroke.call(this, picking);
  }

  dynamicTopology(picking) {
    // no dynamic topo with masking
    return picking.getPickedVertices();
  }

  /** Paint color vertices */
  paint(iVerts, center, radiusSquared, intensity, hardness, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let radius = Math.sqrt(radiusSquared);
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let softness = 2*(1 - hardness);
    let maskIntensity = this._negative ? -intensity : intensity;
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i]*3;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let dx = vx - cx;
      let dy = vy - cy;
      let dz = vz - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      if (dist > 1) dist = 1.0;

      let fallOff = Math.pow(1.0 - dist, softness);
      fallOff *= maskIntensity*picking.getAlpha(vx, vy, vz);
      mAr[ind + 2] = Math.min(Math.max(mAr[ind + 2] + fallOff, 0.0), 1.0);
    }
  }

  updateAndRenderMask() {
    let mesh = this.getMesh();
    mesh.updateDuplicateColorsAndMaterials();
    mesh.updateDrawArrays();
    this.updateRender();
  }

  blur() {
    let mesh = this.getMesh();
    let iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;
    iVerts = mesh.expandsVertices(iVerts, 1);

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    let mAr = mesh.getMaterials();
    let nbVerts = iVerts.length;
    let smoothVerts = new Float32Array(nbVerts*3);
    this.laplacianSmooth(iVerts, smoothVerts, mAr);
    for (let i = 0; i < nbVerts; ++i) {
      mAr[iVerts[i]*3 + 2] = smoothVerts[i*3 + 2];
    }
    this.updateAndRenderMask();
  }

  sharpen() {
    let mesh = this.getMesh();
    let iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    let mAr = mesh.getMaterials();
    let nbVerts = iVerts.length;
    for (let i = 0; i < nbVerts; ++i) {
      let idm = iVerts[i]*3 + 2;
      let val = mAr[idm];
      mAr[idm] = val > 0.5 ? Math.min(val + 0.1, 1.0) : Math.max(val - 1.0, 0.0);
    }
    this.updateAndRenderMask();
  }

  clear() {
    let mesh = this.getMesh();
    let iVerts = this.getMaskedVertices();
    if (iVerts.length === 0)
      return;

    this.pushState();
    this._main.getStateManager().pushVertices(iVerts);

    let mAr = mesh.getMaterials();
    for (let i = 0, nb = iVerts.length; i < nb; ++i) {
      mAr[iVerts[i]*3 + 2] = 1.0;
    }

    this.updateAndRenderMask();
  }

  invert(isState, meshState) {
    let mesh = meshState;
    if (!mesh) mesh = this.getMesh();
    if (!isState)
      this._main.getStateManager().pushStateCustom(this.invert.bind(this, true, mesh));

    let mAr = mesh.getMaterials();
    for (let i = 0, nb = mesh.getNbVertices(); i < nb; ++i) {
      mAr[i*3 + 2] = 1.0 - mAr[i*3 + 2];
    }

    this.updateAndRenderMask();
  }

  remapAndMirrorIndices(fAr, nbFaces, iVerts) {
    let nbVertices = this.getMesh().getNbVertices();
    let iTag = new Uint32Array(Utils.getMemory(nbVertices*4), 0, nbVertices);
    let i = 0;
    let j = 0;
    let nbVerts = iVerts.length;
    for (i = 0; i < nbVerts; ++i) {
      iTag[iVerts[i]] = i;
    }

    let endFaces = nbFaces*2;
    for (i = 0; i < endFaces; ++i) {
      j = i*4;
      let offset = i < nbFaces ? 0 : nbVerts;
      fAr[j] = iTag[fAr[j]] + offset;
      fAr[j + 1] = iTag[fAr[j + 1]] + offset;
      fAr[j + 2] = iTag[fAr[j + 2]] + offset;
      let id4 = fAr[j + 3];
      if (id4 !== Utils.TRI_INDEX) fAr[j + 3] = iTag[id4] + offset;
    }

    let end = fAr.length/4;
    for (i = endFaces; i < end; ++i) {
      j = i*4;
      fAr[j] = iTag[fAr[j]];
      fAr[j + 1] = iTag[fAr[j + 1]];
      fAr[j + 2] = iTag[fAr[j + 2]] + nbVerts;
      fAr[j + 3] = iTag[fAr[j + 3]] + nbVerts;
    }
  }

  invertFaces(fAr) {
    for (let i = 0, nb = fAr.length/4; i < nb; ++i) {
      let id = i*4;
      let temp = fAr[id];
      fAr[id] = fAr[id + 2];
      fAr[id + 2] = temp;
    }
  }

  extractFaces(iFaces, iVerts, maskClamp) {
    let mesh = this.getMesh();
    let fAr = mesh.getFaces();
    let mAr = mesh.getMaterials();
    let eAr = mesh.getVerticesOnEdge();

    let noThick = this._thickness === 0;

    let nbFaces = iFaces.length;
    let nbNewFaces = new Uint32Array(Utils.getMemory(nbFaces*4*4*3), 0, nbFaces*4*3);
    let offsetFLink = noThick ? nbFaces : nbFaces*2;
    for (let i = 0; i < nbFaces; ++i) {
      let idf = i*4;
      let idOld = iFaces[i]*4;
      let iv1 = nbNewFaces[idf] = fAr[idOld];
      let iv2 = nbNewFaces[idf + 1] = fAr[idOld + 1];
      let iv3 = nbNewFaces[idf + 2] = fAr[idOld + 2];
      let iv4 = nbNewFaces[idf + 3] = fAr[idOld + 3];
      if (noThick)
        continue;
      let isQuad = iv4 !== Utils.TRI_INDEX;

      let b1 = mAr[iv1*3 + 2] >= maskClamp || eAr[iv1] >= 1;
      let b2 = mAr[iv2*3 + 2] >= maskClamp || eAr[iv2] >= 1;
      let b3 = mAr[iv3*3 + 2] >= maskClamp || eAr[iv3] >= 1;
      let b4 = isQuad ? mAr[iv4*3 + 2] >= maskClamp || eAr[iv4] >= 1 : false;

      // create opposite face (layer), invert clockwise
      // quad =>
      // 1 2    3 2
      // 4 3    4 1
      // tri => 
      // 1 2    3 2
      //  3      1

      idf += nbFaces*4;
      nbNewFaces[idf] = iv3;
      nbNewFaces[idf + 1] = iv2;
      nbNewFaces[idf + 2] = iv1;
      nbNewFaces[idf + 3] = iv4;

      // create bridges faces
      if (b2) {
        if (b1) {
          idf = 4*(offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv2;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv1;
        }
        if (b3) {
          idf = 4*(offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv3;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv2;
        }
      }
      if (isQuad) {
        if (b4) {
          if (b1) {
            idf = 4*(offsetFLink++);
            nbNewFaces[idf] = nbNewFaces[idf + 3] = iv1;
            nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv4;
          }
          if (b3) {
            idf = 4*(offsetFLink++);
            nbNewFaces[idf] = nbNewFaces[idf + 3] = iv4;
            nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv3;
          }
        }
      } else {
        if (b1 && b3) {
          idf = 4*(offsetFLink++);
          nbNewFaces[idf] = nbNewFaces[idf + 3] = iv1;
          nbNewFaces[idf + 1] = nbNewFaces[idf + 2] = iv3;
        }
      }
    }

    let fArNew = new Uint32Array(nbNewFaces.subarray(0, offsetFLink*4));
    this.remapAndMirrorIndices(fArNew, nbFaces, iVerts);
    if (this._thickness > 0)
      this.invertFaces(fArNew);
    return fArNew;
  }

  extractVertices(iVerts) {
    let mesh = this.getMesh();

    let vAr = mesh.getVertices();
    let nAr = mesh.getNormals();
    let mat = mesh.getMatrix();
    let nMat = mat3.normalFromMat4(mat3.create(), mat);
    let nbVerts = iVerts.length;
    let vArNew = new Float32Array(nbVerts*2*3);
    let vTemp = [0.0, 0.0, 0.0];
    let nTemp = [0.0, 0.0, 0.0];
    let vOffset = nbVerts*3;
    let thick = this._thickness;
    let eps = 0.01;
    if (thick < 0) eps = -eps;
    for (let i = 0; i < nbVerts; ++i) {
      let idv = i*3;
      let idvOld = iVerts[i]*3;
      vTemp[0] = vAr[idvOld];
      vTemp[1] = vAr[idvOld + 1];
      vTemp[2] = vAr[idvOld + 2];
      nTemp[0] = nAr[idvOld];
      nTemp[1] = nAr[idvOld + 1];
      nTemp[2] = nAr[idvOld + 2];
      vec3.transformMat3(nTemp, nTemp, nMat);
      vec3.normalize(nTemp, nTemp);

      vec3.transformMat4(vTemp, vTemp, mat);
      vec3.scaleAndAdd(vTemp, vTemp, nTemp, eps);
      vArNew[idv] = vTemp[0];
      vArNew[idv + 1] = vTemp[1];
      vArNew[idv + 2] = vTemp[2];

      vec3.scaleAndAdd(vTemp, vTemp, nTemp, thick);
      idv += vOffset;
      vArNew[idv] = vTemp[0];
      vArNew[idv + 1] = vTemp[1];
      vArNew[idv + 2] = vTemp[2];
    }
    return vArNew;
  }

  smoothBorder(mesh, iFaces) {
    let startBridge = iFaces.length*2;
    let fBridge = new Uint32Array(mesh.getNbFaces() - startBridge);
    for (let i = 0, nbBridge = fBridge.length; i < nbBridge; ++i) {
      fBridge[i] = startBridge + i;
    }
    let vBridge = mesh.expandsVertices(mesh.getVerticesFromFaces(fBridge), 1);
    let smo = new Smooth();
    smo.setToolMesh(mesh);
    smo.smooth(vBridge, 1.0);
    smo.smooth(vBridge, 1.0);
    smo.smooth(vBridge, 1.0);
  }

  extract() {
    let mesh = this.getMesh();
    let maskClamp = 0.5;

    let iVerts = this.filterMaskedVertices(-Infinity, maskClamp);
    if (iVerts.length === 0)
      return;
    let iFaces = mesh.getFacesFromVertices(iVerts);
    iVerts = mesh.getVerticesFromFaces(iFaces);

    let fArNew = this.extractFaces(iFaces, iVerts, maskClamp);
    let vArNew = this.extractVertices(iVerts);

    let newMesh = new MeshStatic(mesh.getGL());
    newMesh.setVertices(vArNew);
    newMesh.setFaces(fArNew);

    // we don't use newMesh.init because we want to smooth
    // the border (we want to avoid an update octree/normal/etc...)
    newMesh.initColorsAndMaterials();
    newMesh.allocateArrays();
    newMesh.initTopology();
    if (this._thickness !== 0.0)
      this.smoothBorder(newMesh, iFaces);
    newMesh.updateGeometry();
    newMesh.updateDuplicateColorsAndMaterials();

    newMesh.copyRenderConfig(mesh);
    newMesh.initRender();

    let main = this._main;
    main.addNewMesh(newMesh);
    main.setMesh(mesh);
  }
}

export default Masking;
