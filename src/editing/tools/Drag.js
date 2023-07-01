import {vec3, mat4} from '../../lib/gl-matrix.js';
import Geometry from '../../math3d/Geometry.js';
import SculptBase from './SculptBase.js';

class Drag extends SculptBase {
  constructor(main) {
    super(main);

    this._radius = 150;
    this._dragDir = [0.0, 0.0, 0.0];
    this._dragDirSym = [0.0, 0.0, 0.0];
    this._idAlpha = 0;
  }

  sculptStroke() {
    let main = this._main;
    let mesh = this.getMesh();
    let picking = main.getPicking();
    let pickingSym = main.getSculptManager().getSymmetry() ? main.getPickingSymmetry() : null;

    let dx = main._mouseX - this._lastMouseX;
    let dy = main._mouseY - this._lastMouseY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let minSpacing = 0.15*this._radius;

    let step = 1.0/Math.floor(dist/minSpacing);
    dx *= step;
    dy *= step;
    let mouseX = this._lastMouseX;
    let mouseY = this._lastMouseY;

    if (!picking.getMesh())
      return;
    picking._mesh = mesh;
    if (pickingSym) {
      pickingSym._mesh = mesh;
      vec3.copy(pickingSym.getIntersectionPoint(), picking.getIntersectionPoint());
      Geometry.mirrorPoint(pickingSym.getIntersectionPoint(), mesh.getSymmetryOrigin(), mesh.getSymmetryNormal());
    }

    for (let i = 0.0; i < 1.0; i += step) {
      if (!this.makeStroke(mouseX, mouseY, picking, pickingSym))
        break;
      mouseX += dx;
      mouseY += dy;
    }

    this.updateRender();

    this._lastMouseX = main._mouseX;
    this._lastMouseY = main._mouseY;
  }

  makeStroke(mouseX, mouseY, picking, pickingSym) {
    let mesh = this.getMesh();
    this.updateDragDir(picking, mouseX, mouseY);
    picking.pickVerticesInSphere(picking.getLocalRadius2());
    picking.computePickedNormal();
    // if dyn topo, we need to the picking and the sculpting altogether
    if (mesh.isDynamic)
      this.stroke(picking, false);

    if (pickingSym) {
      this.updateDragDir(pickingSym, mouseX, mouseY, true);
      pickingSym.setLocalRadius2(picking.getLocalRadius2());
      pickingSym.pickVerticesInSphere(pickingSym.getLocalRadius2());
    }

    if (!mesh.isDynamic) this.stroke(picking, false);
    if (pickingSym) this.stroke(pickingSym, true);
    return true;
  }

  /** On stroke */
  stroke(picking, sym) {
    let iVertsInRadius = picking.getPickedVertices();

    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    iVertsInRadius = this.dynamicTopology(picking);

    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    this.drag(iVertsInRadius, picking.getIntersectionPoint(), picking.getLocalRadius2(), sym, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Drag deformation */
  drag(iVerts, center, radiusSquared, sym, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let radius = Math.sqrt(radiusSquared);
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let dir = sym ? this._dragDirSym : this._dragDir;
    let dirx = dir[0];
    let diry = dir[1];
    let dirz = dir[2];
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i]*3;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let dx = vx - cx;
      let dy = vy - cy;
      let dz = vz - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff *= mAr[ind + 2]*picking.getAlpha(vx, vy, vz);
      vAr[ind] = vx + dirx*fallOff;
      vAr[ind + 1] = vy + diry*fallOff;
      vAr[ind + 2] = vz + dirz*fallOff;
    }
  }

  /** Set a few infos that will be needed for the drag function afterwards */
  updateDragDir(picking, mouseX, mouseY, useSymmetry) {
    let mesh = this.getMesh();
    let vNear = picking.unproject(mouseX, mouseY, 0.0);
    let vFar = picking.unproject(mouseX, mouseY, 0.1);
    let matInverse = mat4.create();
    mat4.invert(matInverse, mesh.getMatrix());
    vec3.transformMat4(vNear, vNear, matInverse);
    vec3.transformMat4(vFar, vFar, matInverse);
    let dir = this._dragDir;
    if (useSymmetry) {
      dir = this._dragDirSym;
      let ptPlane = mesh.getSymmetryOrigin();
      let nPlane = mesh.getSymmetryNormal();
      Geometry.mirrorPoint(vNear, ptPlane, nPlane);
      Geometry.mirrorPoint(vFar, ptPlane, nPlane);
    }
    let center = picking.getIntersectionPoint();
    picking.setIntersectionPoint(Geometry.vertexOnLine(center, vNear, vFar));
    vec3.sub(dir, picking.getIntersectionPoint(), center);
    picking._mesh = mesh;
    picking.updateLocalAndWorldRadius2();
    let eyeDir = picking.getEyeDirection();
    vec3.sub(eyeDir, vFar, vNear);
    vec3.normalize(eyeDir, eyeDir);
  }
}

export default Drag;
