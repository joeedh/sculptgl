import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';

class Flatten extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.75;
    this._negative = true;
    this._culling = false;
    this._idAlpha = 0;
    this._lockPosition = false;
  }

  stroke(picking) {
    let iVertsInRadius = picking.getPickedVertices();
    let intensity = this._intensity*Tablet.getPressureIntensity();

    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    iVertsInRadius = this.dynamicTopology(picking);

    let iVertsFront = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());
    if (this._culling)
      iVertsInRadius = iVertsFront;

    let aNormal = this.areaNormal(iVertsFront);
    if (!aNormal)
      return;
    let aCenter = this.areaCenter(iVertsFront);
    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);
    this.flatten(iVertsInRadius, aNormal, aCenter, picking.getIntersectionPoint(), picking.getLocalRadius2(), intensity, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Flatten, projection of the sculpting vertex onto a plane defined by the barycenter and normals of all the sculpting vertices */
  flatten(iVertsInRadius, aNormal, aCenter, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let radius = Math.sqrt(radiusSquared);
    let vProxy = this._accumulate === false && this._lockPosition === false ? mesh.getVerticesProxy() : vAr;
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let ax = aCenter[0];
    let ay = aCenter[1];
    let az = aCenter[2];
    let anx = aNormal[0];
    let any = aNormal[1];
    let anz = aNormal[2];
    let comp = this._negative ? -1.0 : 1.0;
    for (let i = 0, l = iVertsInRadius.length; i < l; ++i) {
      let ind = iVertsInRadius[i]*3;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let distToPlane = (vx - ax)*anx + (vy - ay)*any + (vz - az)*anz;
      if (distToPlane*comp > 0.0)
        continue;
      let dx = vProxy[ind] - cx;
      let dy = vProxy[ind + 1] - cy;
      let dz = vProxy[ind + 2] - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      if (dist >= 1.0)
        continue;
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff *= distToPlane*intensity*mAr[ind + 2]*picking.getAlpha(vx, vy, vz);
      vAr[ind] -= anx*fallOff;
      vAr[ind + 1] -= any*fallOff;
      vAr[ind + 2] -= anz*fallOff;
    }
  }
}

export default Flatten;
