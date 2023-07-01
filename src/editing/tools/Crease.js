import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';

class Crease extends SculptBase {
  constructor(main) {
    super(main);

    this._radius = 25;
    this._intensity = 0.75;
    this._negative = true;
    this._culling = false;
    this._idAlpha = 0;
    this._lockPosition = false;
  }

  stroke(picking) {
    let iVertsInRadius = picking.getPickedVertices();
    let intensity = this._intensity*Tablet.getPressureIntensity();

    this.updateProxy(iVertsInRadius);
    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    iVertsInRadius = this.dynamicTopology(picking);

    if (this._culling)
      iVertsInRadius = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());

    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    this.crease(iVertsInRadius, picking.getPickedNormal(), picking.getIntersectionPoint(), picking.getLocalRadius2(), intensity, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Pinch+brush-like sculpt */
  crease(iVertsInRadius, aNormal, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let vProxy = mesh.getVerticesProxy();
    let radius = Math.sqrt(radiusSquared);
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let anx = aNormal[0];
    let any = aNormal[1];
    let anz = aNormal[2];
    let deformIntensity = intensity*0.07;
    let brushFactor = deformIntensity*radius;
    if (this._negative)
      brushFactor = -brushFactor;
    for (let i = 0, l = iVertsInRadius.length; i < l; ++i) {
      let ind = iVertsInRadius[i]*3;
      let dx = cx - vProxy[ind];
      let dy = cy - vProxy[ind + 1];
      let dz = cz - vProxy[ind + 2];
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      if (dist >= 1.0)
        continue;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff *= mAr[ind + 2]*picking.getAlpha(vx, vy, vz);
      let brushModifier = Math.pow(fallOff, 5)*brushFactor;
      fallOff *= deformIntensity;
      vAr[ind] = vx + dx*fallOff + anx*brushModifier;
      vAr[ind + 1] = vy + dy*fallOff + any*brushModifier;
      vAr[ind + 2] = vz + dz*fallOff + anz*brushModifier;
    }
  }
}

export default Crease;
