import {vec3, mat4} from '../../lib/gl-matrix.js';
import Geometry from '../../math3d/Geometry.js';
import SculptBase from './SculptBase.js';

class Move extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 150;
    this._intensity = 1.0;
    this._topoCheck = true;
    this._negative = false; // along normal
    this._moveData = {
      center: [0.0, 0.0, 0.0],
      dir   : [0.0, 0.0],
      vProxy: null
    };
    this._moveDataSym = {
      center: [0.0, 0.0, 0.0],
      dir   : [0.0, 0.0],
      vProxy: null
    };
    this._idAlpha = 0;
  }

  startSculpt() {
    let main = this._main;
    let picking = main.getPicking();
    this.initMoveData(picking, this._moveData);

    if (main.getSculptManager().getSymmetry()) {
      let pickingSym = main.getPickingSymmetry();
      pickingSym.intersectionMouseMesh();
      pickingSym.setLocalRadius2(picking.getLocalRadius2());

      if (pickingSym.getMesh())
        this.initMoveData(pickingSym, this._moveDataSym);
    }
  }

  initMoveData(picking, moveData) {
    if (this._topoCheck)
      picking.pickVerticesInSphereTopological(picking.getLocalRadius2());
    else
      picking.pickVerticesInSphere(picking.getLocalRadius2());
    vec3.copy(moveData.center, picking.getIntersectionPoint());
    let iVerts = picking.getPickedVertices();
    // undo-redo
    this._main.getStateManager().pushVertices(iVerts);

    let vAr = picking.getMesh().getVertices();
    let nbVerts = iVerts.length;
    let vProxy = moveData.vProxy = new Float32Array(nbVerts*3);
    for (let i = 0; i < nbVerts; ++i) {
      let ind = iVerts[i]*3;
      let j = i*3;
      vProxy[j] = vAr[ind];
      vProxy[j + 1] = vAr[ind + 1];
      vProxy[j + 2] = vAr[ind + 2];
    }
  }

  copyVerticesProxy(picking, moveData) {
    let iVerts = picking.getPickedVertices();
    let vAr = this.getMesh().getVertices();
    let vProxy = moveData.vProxy;
    for (let i = 0, nbVerts = iVerts.length; i < nbVerts; ++i) {
      let ind = iVerts[i]*3;
      let j = i*3;
      vAr[ind] = vProxy[j];
      vAr[ind + 1] = vProxy[j + 1];
      vAr[ind + 2] = vProxy[j + 2];
    }
  }

  sculptStroke() {
    let main = this._main;
    let picking = main.getPicking();
    let pickingSym = main.getPickingSymmetry();
    let useSym = main.getSculptManager().getSymmetry() && pickingSym.getMesh();

    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    if (useSym) {
      pickingSym.updateAlpha(false);
      pickingSym.setIdAlpha(this._idAlpha);
    }

    this.copyVerticesProxy(picking, this._moveData);
    if (useSym)
      this.copyVerticesProxy(pickingSym, this._moveDataSym);

    let mouseX = main._mouseX;
    let mouseY = main._mouseY;
    this.updateMoveDir(picking, mouseX, mouseY);
    this.move(picking.getPickedVertices(), picking.getIntersectionPoint(), picking.getLocalRadius2(), this._moveData, picking);

    if (useSym) {
      this.updateMoveDir(pickingSym, mouseX, mouseY, true);
      this.move(pickingSym.getPickedVertices(), pickingSym.getIntersectionPoint(), pickingSym.getLocalRadius2(), this._moveDataSym, pickingSym);
    }

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(picking.getPickedVertices()), picking.getPickedVertices());
    if (useSym)
      mesh.updateGeometry(mesh.getFacesFromVertices(pickingSym.getPickedVertices()), pickingSym.getPickedVertices());
    this.updateRender();
    main.setCanvasCursor('default');
  }

  move(iVerts, center, radiusSquared, moveData, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let radius = Math.sqrt(radiusSquared);
    let vProxy = moveData.vProxy;
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let dir = moveData.dir;
    let dirx = dir[0];
    let diry = dir[1];
    let dirz = dir[2];
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i]*3;
      let j = i*3;
      let vx = vProxy[j];
      let vy = vProxy[j + 1];
      let vz = vProxy[j + 2];
      let dx = vx - cx;
      let dy = vy - cy;
      let dz = vz - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff *= mAr[ind + 2]*picking.getAlpha(vx, vy, vz);
      vAr[ind] += dirx*fallOff;
      vAr[ind + 1] += diry*fallOff;
      vAr[ind + 2] += dirz*fallOff;
    }
  }

  updateMoveDir(picking, mouseX, mouseY, useSymmetry) {
    let mesh = this.getMesh();
    let vNear = picking.unproject(mouseX, mouseY, 0.0);
    let vFar = picking.unproject(mouseX, mouseY, 0.1);
    let matInverse = mat4.create();
    mat4.invert(matInverse, mesh.getMatrix());
    vec3.transformMat4(vNear, vNear, matInverse);
    vec3.transformMat4(vFar, vFar, matInverse);

    let moveData = useSymmetry ? this._moveDataSym : this._moveData;
    if (useSymmetry) {
      let ptPlane = mesh.getSymmetryOrigin();
      let nPlane = mesh.getSymmetryNormal();
      Geometry.mirrorPoint(vNear, ptPlane, nPlane);
      Geometry.mirrorPoint(vFar, ptPlane, nPlane);
    }

    if (this._negative) {
      let len = vec3.dist(Geometry.vertexOnLine(moveData.center, vNear, vFar), moveData.center);
      vec3.normalize(moveData.dir, picking.computePickedNormal());
      vec3.scale(moveData.dir, moveData.dir, mouseX < this._lastMouseX ? -len : len);
    } else {
      vec3.sub(moveData.dir, Geometry.vertexOnLine(moveData.center, vNear, vFar), moveData.center);
    }
    vec3.scale(moveData.dir, moveData.dir, this._intensity);

    let eyeDir = picking.getEyeDirection();
    vec3.sub(eyeDir, vFar, vNear);
    vec3.normalize(eyeDir, eyeDir);
  }
}

export default Move;
