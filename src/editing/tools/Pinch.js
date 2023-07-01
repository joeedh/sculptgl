import Tablet from '../../misc/Tablet.js';
import SculptBase from '../../editing/tools/SculptBase.js';

class Pinch extends SculptBase {
  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.75;
    this._negative = false;
    this._culling = false;
    this._idAlpha = 0;
    this._lockPosition = false;
  }

  stroke(picking) {
    let iVertsInRadius = picking.getPickedVertices();
    let intensity = this._intensity * Tablet.getPressureIntensity();

    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    iVertsInRadius = this.dynamicTopology(picking);

    if (this._culling)
      iVertsInRadius = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());

    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    this.pinch(iVertsInRadius, picking.getIntersectionPoint(), picking.getLocalRadius2(), intensity, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Pinch, vertices gather around intersection point */
  pinch(iVertsInRadius, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let radius = Math.sqrt(radiusSquared);
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let deformIntensity = intensity * 0.05;
    if (this._negative)
      deformIntensity = -deformIntensity;
    for (let i = 0, l = iVertsInRadius.length; i < l; ++i) {
      let ind = iVertsInRadius[i] * 3;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let dx = cx - vx;
      let dy = cy - vy;
      let dz = cz - vz;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      let fallOff = dist * dist;
      fallOff = 3.0 * fallOff * fallOff - 4.0 * fallOff * dist + 1.0;
      fallOff *= deformIntensity * mAr[ind + 2] * picking.getAlpha(vx, vy, vz);
      vAr[ind] = vx + dx * fallOff;
      vAr[ind + 1] = vy + dy * fallOff;
      vAr[ind + 2] = vz + dz * fallOff;
    }
  }
}

export default Pinch;
