import SculptBase from './SculptBase.js';

class LocalScale extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._culling = false;
    this._idAlpha = 0;
  }

  startSculpt() {
    let main = this._main;
    if (main.getSculptManager().getSymmetry()) {
      let pickingSym = main.getPickingSymmetry();
      pickingSym.intersectionMouseMesh();
      pickingSym.setLocalRadius2(main.getPicking().getLocalRadius2());
    }
  }

  /** Make a brush scale stroke */
  sculptStroke() {
    let main = this._main;
    let delta = main._mouseX - main._lastMouseX;
    let picking = main.getPicking();
    let rLocal2 = picking.getLocalRadius2();
    picking.pickVerticesInSphere(rLocal2);
    this.stroke(picking, delta);

    if (main.getSculptManager().getSymmetry()) {
      let pickingSym = main.getPickingSymmetry();
      if (pickingSym.getMesh()) {
        pickingSym.pickVerticesInSphere(rLocal2);
        this.stroke(pickingSym, delta);
      }
    }
    this.updateRender();
  }

  /** On stroke */
  stroke(picking, delta) {
    let iVertsInRadius = picking.getPickedVertices();

    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    iVertsInRadius = this.dynamicTopology(picking);

    if (this._culling)
      iVertsInRadius = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());

    picking.updateAlpha(false);
    picking.setIdAlpha(this._idAlpha);
    this.scale(iVertsInRadius, picking.getIntersectionPoint(), picking.getLocalRadius2(), delta, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Scale the vertices around the mouse point intersection */
  scale(iVerts, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let deltaScale = intensity * 0.01;
    let radius = Math.sqrt(radiusSquared);
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i] * 3;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let dx = vx - cx;
      let dy = vy - cy;
      let dz = vz - cz;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      let fallOff = dist * dist;
      fallOff = 3.0 * fallOff * fallOff - 4.0 * fallOff * dist + 1.0;
      fallOff *= deltaScale * mAr[ind + 2] * picking.getAlpha(vx, vy, vz);
      vAr[ind] = vx + dx * fallOff;
      vAr[ind + 1] = vy + dy * fallOff;
      vAr[ind + 2] = vz + dz * fallOff;
    }
  }
}

export default LocalScale;
