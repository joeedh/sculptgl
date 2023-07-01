import Tablet from '../../misc/Tablet.js';
import SculptBase from './SculptBase.js';

class Inflate extends SculptBase {

  constructor(main) {
    super(main);

    this._radius = 50;
    this._intensity = 0.3;
    this._negative = false;
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
    this.inflate(iVertsInRadius, picking.getIntersectionPoint(), picking.getLocalRadius2(), intensity, picking);

    let mesh = this.getMesh();
    mesh.updateGeometry(mesh.getFacesFromVertices(iVertsInRadius), iVertsInRadius);
  }

  /** Inflate a group of vertices */
  inflate(iVerts, center, radiusSquared, intensity, picking) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let vProxy = mesh.getVerticesProxy();
    let nAr = mesh.getNormals();
    let radius = Math.sqrt(radiusSquared);
    let deformIntensity = intensity*radius*0.1;
    if (this._negative)
      deformIntensity = -deformIntensity;
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i]*3;
      let dx = vProxy[ind] - cx;
      let dy = vProxy[ind + 1] - cy;
      let dz = vProxy[ind + 2] - cz;
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)/radius;
      if (dist >= 1.0)
        continue;
      let fallOff = dist*dist;
      fallOff = 3.0*fallOff*fallOff - 4.0*fallOff*dist + 1.0;
      fallOff = deformIntensity*fallOff;
      let vx = vAr[ind];
      let vy = vAr[ind + 1];
      let vz = vAr[ind + 2];
      let nx = nAr[ind];
      let ny = nAr[ind + 1];
      let nz = nAr[ind + 2];
      fallOff /= Math.sqrt(nx*nx + ny*ny + nz*nz);
      fallOff *= mAr[ind + 2]*picking.getAlpha(vx, vy, vz);
      vAr[ind] = vx + nx*fallOff;
      vAr[ind + 1] = vy + ny*fallOff;
      vAr[ind + 2] = vz + nz*fallOff;
    }
  }
}

export default Inflate;
