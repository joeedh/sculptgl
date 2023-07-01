import Enums from '../../misc/Enums.js';
import Utils from '../../misc/Utils.js';

// Overview sculpt :
// start (check if we hit the mesh, start state stack) -> startSculpt
// startSculpt (init stuffs specific to the tool) -> sculptStroke

// sculptStroke (handle sculpt stroke by throttling/smoothing stroke) -> makeStroke
// makeStroke (handle symmetry and picking before sculping) -> stroke
// stroke (tool specific, move vertices, etc)

// update -> sculptStroke

class SculptBase {

  constructor(main) {
    this._main = main;
    this._cbContinuous = this.updateContinuous.bind(this); // callback continuous
    this._lastMouseX = 0.0;
    this._lastMouseY = 0.0;
  }

  setToolMesh(mesh) {
    // to be called when we create a new instance of a tool operator
    // that is no part of the main application Sculpt container (e.g smooth)
    this._forceToolMesh = mesh;
  }

  getMesh() {
    return this._forceToolMesh || this._main.getMesh();
  }

  start(ctrl) {
    let main = this._main;
    let picking = main.getPicking();

    if (!picking.intersectionMouseMeshes())
      return false;

    let mesh = main.setOrUnsetMesh(picking.getMesh(), ctrl);
    if (!mesh)
      return false;

    picking.initAlpha();
    let pickingSym = main.getSculptManager().getSymmetry() ? main.getPickingSymmetry() : null;
    if (pickingSym) {
      pickingSym.intersectionMouseMesh(mesh);
      pickingSym.initAlpha();
    }

    this.pushState();
    this._lastMouseX = main._mouseX;
    this._lastMouseY = main._mouseY;
    this.startSculpt();

    return true;
  }

  end() {
    if (this.getMesh())
      this.getMesh().balanceOctree();
  }

  pushState() {
    this._main.getStateManager().pushStateGeometry(this.getMesh());
  }

  startSculpt() {
    if (this._lockPosition === true)
      return;
    this.sculptStroke();
  }

  preUpdate(canBeContinuous) {
    let main = this._main;
    let picking = main.getPicking();
    let isSculpting = main._action === Enums.Action.SCULPT_EDIT;

    if (isSculpting && !canBeContinuous)
      return;

    if (isSculpting)
      picking.intersectionMouseMesh();
    else
      picking.intersectionMouseMeshes();

    let mesh = picking.getMesh();
    if (mesh && main.getSculptManager().getSymmetry())
      main.getPickingSymmetry().intersectionMouseMesh(mesh);
  }

  update(continuous) {
    if (this._lockPosition === true)
      return this.updateSculptLock(continuous);
    this.sculptStroke();
  }

  /** Update lock position */
  updateSculptLock(continuous) {
    let main = this._main;
    if (!continuous)
      this._main.getStateManager().getCurrentState().undo(); // tricky

    let picking = main.getPicking();
    let origRad = this._radius;
    let pickingSym = main.getSculptManager().getSymmetry() ? main.getPickingSymmetry() : null;

    let dx = main._mouseX - this._lastMouseX;
    let dy = main._mouseY - this._lastMouseY;
    this._radius = Math.sqrt(dx*dx + dy*dy);
    // it's a bit hacky... I just simulate another stroke with a very small offset
    // so that the stroke still has a direction (the mask can be rotated correctly then)
    let offx = dx/this._radius;
    let offy = dy/this._radius;
    this.makeStroke(this._lastMouseX + offx*1e-3, this._lastMouseY + offy*1e-3, picking, pickingSym);
    this._radius = origRad;

    this.updateRender();
    main.setCanvasCursor('default');
  }

  sculptStroke() {
    let main = this._main;
    let picking = main.getPicking();
    let pickingSym = main.getSculptManager().getSymmetry() ? main.getPickingSymmetry() : null;

    let dx = main._mouseX - this._lastMouseX;
    let dy = main._mouseY - this._lastMouseY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let minSpacing = 0.15*this._radius*main.getPixelRatio();

    if (dist <= minSpacing)
      return;

    let step = 1.0/Math.floor(dist/minSpacing);
    dx *= step;
    dy *= step;
    let mouseX = this._lastMouseX + dx;
    let mouseY = this._lastMouseY + dy;

    for (let i = step; i <= 1.0; i += step) {
      if (!this.makeStroke(mouseX, mouseY, picking, pickingSym))
        break;
      mouseX += dx;
      mouseY += dy;
    }

    this.updateRender();

    this._lastMouseX = main._mouseX;
    this._lastMouseY = main._mouseY;
  }

  updateRender() {
    this.updateMeshBuffers();
    this._main.render();
  }

  makeStroke(mouseX, mouseY, picking, pickingSym) {
    let mesh = this.getMesh();
    picking.intersectionMouseMesh(mesh, mouseX, mouseY);
    let pick1 = picking.getMesh();
    if (pick1) {
      picking.pickVerticesInSphere(picking.getLocalRadius2());
      picking.computePickedNormal();
    }
    // if dyn topo, we need to the picking and the sculpting altogether
    let dynTopo = mesh.isDynamic && !this._lockPosition;
    if (dynTopo && pick1)
      this.stroke(picking, false);

    let pick2;
    if (pickingSym) {
      pickingSym.intersectionMouseMesh(mesh, mouseX, mouseY);
      pick2 = pickingSym.getMesh();
      if (pick2) {
        pickingSym.setLocalRadius2(picking.getLocalRadius2());
        pickingSym.pickVerticesInSphere(pickingSym.getLocalRadius2());
        pickingSym.computePickedNormal();
      }
    }

    if (!dynTopo && pick1) this.stroke(picking, false);
    if (pick2) this.stroke(pickingSym, true);
    return pick1 || pick2;
  }

  updateMeshBuffers() {
    let mesh = this.getMesh();
    if (mesh.isDynamic)
      mesh.updateBuffers();
    else
      mesh.updateGeometryBuffers();
  }

  updateContinuous() {
    if (this._lockPosition) return this.update(true);
    let main = this._main;
    let picking = main.getPicking();
    let pickingSym = main.getSculptManager().getSymmetry() ? main.getPickingSymmetry() : null;
    this.makeStroke(main._mouseX, main._mouseY, picking, pickingSym);
    this.updateRender();
  }

  /** Return the vertices that point toward the camera */
  getFrontVertices(iVertsInRadius, eyeDir) {
    let nbVertsSelected = iVertsInRadius.length;
    let iVertsFront = new Uint32Array(Utils.getMemory(4*nbVertsSelected), 0, nbVertsSelected);
    let acc = 0;
    let nAr = this.getMesh().getNormals();
    let eyeX = eyeDir[0];
    let eyeY = eyeDir[1];
    let eyeZ = eyeDir[2];
    for (let i = 0; i < nbVertsSelected; ++i) {
      let id = iVertsInRadius[i];
      let j = id*3;
      if ((nAr[j]*eyeX + nAr[j + 1]*eyeY + nAr[j + 2]*eyeZ) <= 0.0)
        iVertsFront[acc++] = id;
    }
    return new Uint32Array(iVertsFront.subarray(0, acc));
  }

  /** Compute average normal of a group of vertices with culling */
  areaNormal(iVerts) {
    let mesh = this.getMesh();
    let nAr = mesh.getNormals();
    let mAr = mesh.getMaterials();
    let anx = 0.0;
    let any = 0.0;
    let anz = 0.0;
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let ind = iVerts[i]*3;
      let f = mAr[ind + 2];
      anx += nAr[ind]*f;
      any += nAr[ind + 1]*f;
      anz += nAr[ind + 2]*f;
    }
    let len = Math.sqrt(anx*anx + any*any + anz*anz);
    if (len === 0.0)
      return;
    len = 1.0/len;
    return [anx*len, any*len, anz*len];
  }

  /** Compute average center of a group of vertices (with culling) */
  areaCenter(iVerts) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let mAr = mesh.getMaterials();
    let nbVerts = iVerts.length;
    let ax = 0.0;
    let ay = 0.0;
    let az = 0.0;
    let acc = 0;
    for (let i = 0; i < nbVerts; ++i) {
      let ind = iVerts[i]*3;
      let f = mAr[ind + 2];
      acc += f;
      ax += vAr[ind]*f;
      ay += vAr[ind + 1]*f;
      az += vAr[ind + 2]*f;
    }
    return [ax/acc, ay/acc, az/acc];
  }

  /** Updates the vertices original coords that are sculpted for the first time in this stroke */
  updateProxy(iVerts) {
    let mesh = this.getMesh();
    let vAr = mesh.getVertices();
    let vProxy = mesh.getVerticesProxy();
    if (vAr === vProxy)
      return;
    let vertStateFlags = mesh.getVerticesStateFlags();
    let stateFlag = Utils.STATE_FLAG;
    for (let i = 0, l = iVerts.length; i < l; ++i) {
      let id = iVerts[i];
      if (vertStateFlags[id] !== stateFlag) {
        let ind = id*3;
        vProxy[ind] = vAr[ind];
        vProxy[ind + 1] = vAr[ind + 1];
        vProxy[ind + 2] = vAr[ind + 2];
      }
    }
  }

  /** Laplacian smooth. Special rule for vertex on the edge of the mesh. */
  laplacianSmooth(iVerts, smoothVerts, vField) {
    let mesh = this.getMesh();
    let vrvStartCount = mesh.getVerticesRingVertStartCount();
    let vertRingVert = mesh.getVerticesRingVert();
    let ringVerts = vertRingVert instanceof Array ? vertRingVert : null;
    let vertOnEdge = mesh.getVerticesOnEdge();
    let vAr = vField || mesh.getVertices();
    let nbVerts = iVerts.length;

    for (let i = 0; i < nbVerts; ++i) {
      let i3 = i*3;
      let id = iVerts[i];

      let start, end;
      if (ringVerts) {
        vertRingVert = ringVerts[id];
        start = 0;
        end = vertRingVert.length;
      } else {
        start = vrvStartCount[id*2];
        end = start + vrvStartCount[id*2 + 1];
      }

      let idv = 0;
      let vcount = end - start;
      if (vcount <= 2) {
        idv = id*3;
        smoothVerts[i3] = vAr[idv];
        smoothVerts[i3 + 1] = vAr[idv + 1];
        smoothVerts[i3 + 2] = vAr[idv + 2];
        continue;
      }

      let avx = 0.0;
      let avy = 0.0;
      let avz = 0.0;
      let j = 0;

      if (vertOnEdge[id] === 1) {
        let nbVertEdge = 0;
        for (j = start; j < end; ++j) {
          idv = vertRingVert[j];
          // we average only with vertices that are also on the edge
          if (vertOnEdge[idv] === 1) {
            idv *= 3;
            avx += vAr[idv];
            avy += vAr[idv + 1];
            avz += vAr[idv + 2];
            ++nbVertEdge;
          }
        }

        if (nbVertEdge >= 2) {
          smoothVerts[i3] = avx/nbVertEdge;
          smoothVerts[i3 + 1] = avy/nbVertEdge;
          smoothVerts[i3 + 2] = avz/nbVertEdge;
          continue;
        }
        avx = avy = avz = 0.0;
      }

      for (j = start; j < end; ++j) {
        idv = vertRingVert[j]*3;
        avx += vAr[idv];
        avy += vAr[idv + 1];
        avz += vAr[idv + 2];
      }

      smoothVerts[i3] = avx/vcount;
      smoothVerts[i3 + 1] = avy/vcount;
      smoothVerts[i3 + 2] = avz/vcount;
    }
  }

  dynamicTopology(picking) {
    let mesh = this.getMesh();
    let iVerts = picking.getPickedVertices();
    if (!mesh.isDynamic)
      return iVerts;

    let subFactor = mesh.getSubdivisionFactor();
    let decFactor = mesh.getDecimationFactor();
    if (subFactor === 0.0 && decFactor === 0.0)
      return iVerts;

    if (iVerts.length === 0) {
      iVerts = mesh.getVerticesFromFaces([picking.getPickedFace()]);
      // undo-redo
      this._main.getStateManager().pushVertices(iVerts);
    }

    let iFaces = mesh.getFacesFromVertices(iVerts);
    let radius2 = picking.getLocalRadius2();
    let center = picking.getIntersectionPoint();
    let d2Max = radius2*(1.1 - subFactor)*0.2;
    let d2Min = (d2Max/4.2025)*decFactor;

    // undo-redo
    this._main.getStateManager().pushFaces(iFaces);

    if (subFactor)
      iFaces = mesh.subdivide(iFaces, center, radius2, d2Max, this._main.getStateManager());
    if (decFactor)
      iFaces = mesh.decimate(iFaces, center, radius2, d2Min, this._main.getStateManager());
    iVerts = mesh.getVerticesFromFaces(iFaces);

    let nbVerts = iVerts.length;
    let sculptFlag = Utils.SCULPT_FLAG;
    let vscf = mesh.getVerticesSculptFlags();
    let iVertsInRadius = new Uint32Array(Utils.getMemory(nbVerts*4), 0, nbVerts);
    let acc = 0;
    for (let i = 0; i < nbVerts; ++i) {
      let iVert = iVerts[i];
      if (vscf[iVert] === sculptFlag)
        iVertsInRadius[acc++] = iVert;
    }

    iVertsInRadius = new Uint32Array(iVertsInRadius.subarray(0, acc));
    mesh.updateTopology(iFaces, iVerts);
    mesh.updateGeometry(iFaces, iVerts);

    return iVertsInRadius;
  }

  getUnmaskedVertices() {
    return this.filterMaskedVertices(0.0, Infinity);
  }

  getMaskedVertices() {
    return this.filterMaskedVertices(-Infinity, 1.0);
  }

  filterMaskedVertices(lowerBound = -Infinity, upperBound = Infinity) {
    let mesh = this.getMesh();
    let mAr = mesh.getMaterials();
    let nbVertices = mesh.getNbVertices();
    let cleaned = new Uint32Array(Utils.getMemory(4*nbVertices), 0, nbVertices);
    let acc = 0;
    for (let i = 0; i < nbVertices; ++i) {
      let mask = mAr[i*3 + 2];
      if (mask > lowerBound && mask < upperBound)
        cleaned[acc++] = i;
    }
    return new Uint32Array(cleaned.subarray(0, acc));
  }

  postRender(selection) {
    selection.render(this._main);
  }

  addSculptToScene() {
  }

  getScreenRadius() {
    return (this._radius || 1)*this._main.getPixelRatio();
  }
}

export default SculptBase;
