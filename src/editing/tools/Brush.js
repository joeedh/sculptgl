import {vec3} from '../../lib/gl-matrix.js';
import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';
import Flatten from './Flatten.js';

class Brush extends SculptBase {
  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.5;
    this._negative = false;
    this._clay = true;
    this._culling = false;
    this._accumulate = true; // if we ignore the proxy
    this._idAlpha = 0;
    this._lockPosition = false;
  }

  stroke(picking) {
    let iVertsInRadius = picking.getPickedVertices();
    let intensity = this._intensity*Tablet.getPressureIntensity();

    if (!this._accumulate && !this._lockPosition)
      this.updateProxy(iVertsInRadius);
    // undo-redo
    this._main.getStateManager().pushVertices(iVertsInRadius);
    if (!this._lockPosition)
      iVertsInRadius = this.dynamicTopology(picking);

    let iVertsFront = this.getFrontVertices(iVertsInRadius, picking.getEyeDirection());
    if (this._culling)
      iVertsInRadius = iVertsFront;

    let r2 = picking.getLocalRadius2();
    picking.updateAlpha(this._lockPosition);
    picking.setIdAlpha(this._idAlpha);

    if (!this._clay) {
      this.brush(iVertsInRadius, picking.getPickedNormal(), picking.getIntersectionPoint(), r2, intensity, picking);
    } else {
      let aNormal = this.areaNormal(iVertsFront);
      if (!aNormal)
        return;
      let aCenter = this._lockPosition ? picking.getIntersectionPoint() : this.areaCenter(iVertsFront);
      let off = Math.sqrt(r2)*0.1;
      vec3.scaleAndAdd(aCenter, aCenter, aNormal, this._negative ? -off : off);
      Flatten.prototype.flatten.call(this, iVertsInRadius, aNormal, aCenter, picking.getIntersectionPoint(), r2, intensity, picking);
    }

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  brush(iVertsInRadius, aNormal, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let vProxy = this._accumulate || this._lockPosition ? vAr : mesh.getVerticesProxy();
    let radius = Math.sqrt(radiusSquared);
    let deformIntensityBrush = intensity*radius*0.1;
    if (this._negative)
      deformIntensityBrush = -deformIntensityBrush;
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    let anx = aNormal[0];
    let any = aNormal[1];
    let anz = aNormal[2];
    for (let i = 0, l = iVertsInRadius.length; i < l; ++i) {
      let ind = iVertsInRadius[i]*3;
      let dx = vProxy[ind] - cx;
      let dy = vProxy[ind + 1] - cy;
      let dz = vProxy[ind + 2] - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      if (dist >= 1.0)
        continue;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff *= mAr[ind + 2]*deformIntensityBrush*picking.getAlpha(vx, vy, vz);
      vAr[ind] = vx + anx*fallOff;
      vAr[ind + 1] = vy + any*fallOff;
      vAr[ind + 2] = vz + anz*fallOff;
    }
  }
}

export default Brush;
