import Utils from '../misc/Utils.js';

let Subdivision = {};
Subdivision.LINEAR = false;

//       v3
//       /\
//      /3T\ 
//   m3/____\m2
//    /\ 0T /\
//   /1T\  /2T\
//  /____\/____\ 
// v1    m1    v2

// v4____m3____v3
// |     |     |
// |     |     |
// |m4___|c____|m2
// |     |     |
// |     |     |
// |_____|_____|
// v1   m1     v2

// Helper class
class OddVertexComputer {

  constructor(mesh, vArOut, cArOut, mArOut) {
    this._vArOut = vArOut;
    this._cArOut = cArOut;
    this._mArOut = mArOut;
    this._vAr = mesh.getVertices();
    this._cAr = mesh.getColors();
    this._mAr = mesh.getMaterials();
    this._eAr = mesh.getEdges();
    this._nbVertices = mesh.getNbVertices();
    this._tagEdges = new Int32Array(mesh.getNbEdges());
  }

  computeTriangleEdgeVertex(iv1, iv2, iv3, ide) {
    let vAr = this._vAr;
    let cAr = this._cAr;
    let mAr = this._mAr;
    let eAr = this._eAr;
    let vArOut = this._vArOut;
    let cArOut = this._cArOut;
    let mArOut = this._mArOut;
    let tagEdges = this._tagEdges;
    let id1 = iv1*3;
    let id2 = iv2*3;
    let idOpp = iv3*3;
    let testEdge = tagEdges[ide] - 1;
    let ivMid = testEdge === -1 ? this._nbVertices++ : testEdge;
    let idMid = ivMid*3;
    let edgeValue = eAr[ide];
    if (edgeValue === 1 || edgeValue >= 3 || Subdivision.LINEAR) { // mid edge vertex or non manifold shit
      if (testEdge !== -1) // no need to recompute weird non manifold stuffs
        return ivMid;
      tagEdges[ide] = ivMid + 1;
      vArOut[idMid] = 0.5*(vAr[id1] + vAr[id2]);
      vArOut[idMid + 1] = 0.5*(vAr[id1 + 1] + vAr[id2 + 1]);
      vArOut[idMid + 2] = 0.5*(vAr[id1 + 2] + vAr[id2 + 2]);

      cArOut[idMid] = 0.5*(cAr[id1] + cAr[id2]);
      cArOut[idMid + 1] = 0.5*(cAr[id1 + 1] + cAr[id2 + 1]);
      cArOut[idMid + 2] = 0.5*(cAr[id1 + 2] + cAr[id2 + 2]);

      mArOut[idMid] = 0.5*(mAr[id1] + mAr[id2]);
      mArOut[idMid + 1] = 0.5*(mAr[id1 + 1] + mAr[id2 + 1]);
      mArOut[idMid + 2] = 0.5*(mAr[id1 + 2] + mAr[id2 + 2]);
    } else if (testEdge === -1) { // new mid vertex
      tagEdges[ide] = ivMid + 1;
      vArOut[idMid] = 0.125*vAr[idOpp] + 0.375*(vAr[id1] + vAr[id2]);
      vArOut[idMid + 1] = 0.125*vAr[idOpp + 1] + 0.375*(vAr[id1 + 1] + vAr[id2 + 1]);
      vArOut[idMid + 2] = 0.125*vAr[idOpp + 2] + 0.375*(vAr[id1 + 2] + vAr[id2 + 2]);

      cArOut[idMid] = 0.125*cAr[idOpp] + 0.375*(cAr[id1] + cAr[id2]);
      cArOut[idMid + 1] = 0.125*cAr[idOpp + 1] + 0.375*(cAr[id1 + 1] + cAr[id2 + 1]);
      cArOut[idMid + 2] = 0.125*cAr[idOpp + 2] + 0.375*(cAr[id1 + 2] + cAr[id2 + 2]);

      mArOut[idMid] = 0.125*mAr[idOpp] + 0.375*(mAr[id1] + mAr[id2]);
      mArOut[idMid + 1] = 0.125*mAr[idOpp + 1] + 0.375*(mAr[id1 + 1] + mAr[id2 + 1]);
      mArOut[idMid + 2] = 0.125*mAr[idOpp + 2] + 0.375*(mAr[id1 + 2] + mAr[id2 + 2]);
    } else { // mid vertex already exists
      vArOut[idMid] += 0.125*vAr[idOpp];
      vArOut[idMid + 1] += 0.125*vAr[idOpp + 1];
      vArOut[idMid + 2] += 0.125*vAr[idOpp + 2];

      cArOut[idMid] += 0.125*cAr[idOpp];
      cArOut[idMid + 1] += 0.125*cAr[idOpp + 1];
      cArOut[idMid + 2] += 0.125*cAr[idOpp + 2];

      mArOut[idMid] += 0.125*mAr[idOpp];
      mArOut[idMid + 1] += 0.125*mAr[idOpp + 1];
      mArOut[idMid + 2] += 0.125*mAr[idOpp + 2];
    }
    return ivMid;
  }

  computeQuadEdgeVertex(iv1, iv2, iv3, iv4, ide) {
    let vAr = this._vAr;
    let cAr = this._cAr;
    let mAr = this._mAr;
    let eAr = this._eAr;
    let vArOut = this._vArOut;
    let cArOut = this._cArOut;
    let mArOut = this._mArOut;
    let tagEdges = this._tagEdges;
    let id1 = iv1*3;
    let id2 = iv2*3;
    let idOpp = iv3*3;
    let idOpp2 = iv4*3;
    let testEdge = tagEdges[ide] - 1;
    let ivMid = testEdge === -1 ? this._nbVertices++ : testEdge;
    let idMid = ivMid*3;
    let edgeValue = eAr[ide];
    if (edgeValue === 1 || edgeValue >= 3 || Subdivision.LINEAR) { // mid edge vertex or non manifold shit
      if (testEdge !== -1) // no need to recompute weird non manifold stuffs
        return ivMid;
      tagEdges[ide] = ivMid + 1;
      vArOut[idMid] = 0.5*(vAr[id1] + vAr[id2]);
      vArOut[idMid + 1] = 0.5*(vAr[id1 + 1] + vAr[id2 + 1]);
      vArOut[idMid + 2] = 0.5*(vAr[id1 + 2] + vAr[id2 + 2]);

      cArOut[idMid] = 0.5*(cAr[id1] + cAr[id2]);
      cArOut[idMid + 1] = 0.5*(cAr[id1 + 1] + cAr[id2 + 1]);
      cArOut[idMid + 2] = 0.5*(cAr[id1 + 2] + cAr[id2 + 2]);

      mArOut[idMid] = 0.5*(mAr[id1] + mAr[id2]);
      mArOut[idMid + 1] = 0.5*(mAr[id1 + 1] + mAr[id2 + 1]);
      mArOut[idMid + 2] = 0.5*(mAr[id1 + 2] + mAr[id2 + 2]);
    } else if (testEdge === -1) { // new mid vertex
      tagEdges[ide] = ivMid + 1;
      vArOut[idMid] = 0.0625*(vAr[idOpp] + vAr[idOpp2]) + 0.375*(vAr[id1] + vAr[id2]);
      vArOut[idMid + 1] = 0.0625*(vAr[idOpp + 1] + vAr[idOpp2 + 1]) + 0.375*(vAr[id1 + 1] + vAr[id2 + 1]);
      vArOut[idMid + 2] = 0.0625*(vAr[idOpp + 2] + vAr[idOpp2 + 2]) + 0.375*(vAr[id1 + 2] + vAr[id2 + 2]);

      cArOut[idMid] = 0.0625*(cAr[idOpp] + cAr[idOpp2]) + 0.375*(cAr[id1] + cAr[id2]);
      cArOut[idMid + 1] = 0.0625*(cAr[idOpp + 1] + cAr[idOpp2 + 1]) + 0.375*(cAr[id1 + 1] + cAr[id2 + 1]);
      cArOut[idMid + 2] = 0.0625*(cAr[idOpp + 2] + cAr[idOpp2 + 2]) + 0.375*(cAr[id1 + 2] + cAr[id2 + 2]);

      mArOut[idMid] = 0.0625*(mAr[idOpp] + mAr[idOpp2]) + 0.375*(mAr[id1] + mAr[id2]);
      mArOut[idMid + 1] = 0.0625*(mAr[idOpp + 1] + mAr[idOpp2 + 1]) + 0.375*(mAr[id1 + 1] + mAr[id2 + 1]);
      mArOut[idMid + 2] = 0.0625*(mAr[idOpp + 2] + mAr[idOpp2 + 2]) + 0.375*(mAr[id1 + 2] + mAr[id2 + 2]);
    } else { // mid vertex already exists
      vArOut[idMid] += 0.0625*(vAr[idOpp] + vAr[idOpp2]);
      vArOut[idMid + 1] += 0.0625*(vAr[idOpp + 1] + vAr[idOpp2 + 1]);
      vArOut[idMid + 2] += 0.0625*(vAr[idOpp + 2] + vAr[idOpp2 + 2]);

      cArOut[idMid] += 0.0625*(cAr[idOpp] + cAr[idOpp2]);
      cArOut[idMid + 1] += 0.0625*(cAr[idOpp + 1] + cAr[idOpp2 + 1]);
      cArOut[idMid + 2] += 0.0625*(cAr[idOpp + 2] + cAr[idOpp2 + 2]);

      mArOut[idMid] += 0.0625*(mAr[idOpp] + mAr[idOpp2]);
      mArOut[idMid + 1] += 0.0625*(mAr[idOpp + 1] + mAr[idOpp2 + 1]);
      mArOut[idMid + 2] += 0.0625*(mAr[idOpp + 2] + mAr[idOpp2 + 2]);
    }
    return ivMid;
  }

  computeFaceVertex(iv1, iv2, iv3, iv4) {
    let id1 = iv1*3;
    let id2 = iv2*3;
    let id3 = iv3*3;
    let id4 = iv4*3;
    let vAr = this._vAr;
    let cAr = this._cAr;
    let mAr = this._mAr;
    let vArOut = this._vArOut;
    let cArOut = this._cArOut;
    let mArOut = this._mArOut;
    let ivCen = this._nbVertices++;
    let idCen = ivCen*3;
    vArOut[idCen] = 0.25*(vAr[id1] + vAr[id2] + vAr[id3] + vAr[id4]);
    vArOut[idCen + 1] = 0.25*(vAr[id1 + 1] + vAr[id2 + 1] + vAr[id3 + 1] + vAr[id4 + 1]);
    vArOut[idCen + 2] = 0.25*(vAr[id1 + 2] + vAr[id2 + 2] + vAr[id3 + 2] + vAr[id4 + 2]);

    cArOut[idCen] = 0.25*(cAr[id1] + cAr[id2] + cAr[id3] + cAr[id4]);
    cArOut[idCen + 1] = 0.25*(cAr[id1 + 1] + cAr[id2 + 1] + cAr[id3 + 1] + cAr[id4 + 1]);
    cArOut[idCen + 2] = 0.25*(cAr[id1 + 2] + cAr[id2 + 2] + cAr[id3 + 2] + cAr[id4 + 2]);

    mArOut[idCen] = 0.25*(mAr[id1] + mAr[id2] + mAr[id3] + mAr[id4]);
    mArOut[idCen + 1] = 0.25*(mAr[id1 + 1] + mAr[id2 + 1] + mAr[id3 + 1] + mAr[id4 + 1]);
    mArOut[idCen + 2] = 0.25*(mAr[id1 + 2] + mAr[id2 + 2] + mAr[id3 + 2] + mAr[id4 + 2]);
    return ivCen;
  }
}

/** Even vertices smoothing */
let applyEvenSmooth = function (baseMesh, even, colorOut, materialOut) {
  let nbVerts = baseMesh.getNbVertices();

  colorOut.set(baseMesh.getColors().subarray(0, nbVerts*3));
  materialOut.set(baseMesh.getMaterials().subarray(0, nbVerts*3));

  let vArOld = baseMesh.getVertices();
  let fArOld = baseMesh.getFaces();
  let eArOld = baseMesh.getEdges();
  let feArOld = baseMesh.getFaceEdges();
  let vertOnEdgeOld = baseMesh.getVerticesOnEdge();
  let vrvStartCount = baseMesh.getVerticesRingVertStartCount();
  let vertRingVert = baseMesh.getVerticesRingVert();
  let vrfStartCount = baseMesh.getVerticesRingFaceStartCount();
  let vertRingFace = baseMesh.getVerticesRingFace();
  let onlyTri = baseMesh.hasOnlyTriangles();

  for (let i = 0; i < nbVerts; ++i) {
    let j = i*3;
    let avx = 0.0;
    let avy = 0.0;
    let avz = 0.0;
    let beta = 0.0;
    let alpha = 0.0;
    let k = 0;
    let id = 0;

    // edge vertex
    if (vertOnEdgeOld[i] || Subdivision.LINEAR) {
      let startF = vrfStartCount[i*2];
      let endF = startF + vrfStartCount[i*2 + 1];
      for (k = startF; k < endF; ++k) {
        let idFace = vertRingFace[k]*4;
        let i1 = fArOld[idFace];
        let i2 = fArOld[idFace + 1];
        let i3 = fArOld[idFace + 2];
        let i4 = fArOld[idFace + 3];
        let isTri = i4 === Utils.TRI_INDEX;
        id = Utils.TRI_INDEX;

        if (i1 === i) {
          if (eArOld[feArOld[idFace]] === 1) id = i2;
          else if (eArOld[feArOld[isTri ? idFace + 2 : idFace + 3]] === 1) id = isTri ? i3 : i4;
        } else if (i2 === i) {
          if (eArOld[feArOld[idFace]] === 1) id = i1;
          else if (eArOld[feArOld[idFace + 1]] === 1) id = i3;
        } else if (i3 === i) {
          if (eArOld[feArOld[idFace + 1]] === 1) id = i2;
          else if (eArOld[feArOld[idFace + 2]] === 1) id = isTri ? i1 : i4;
        } else if (i4 === i) {
          if (eArOld[feArOld[idFace + 2]] === 1) id = i3;
          else if (eArOld[feArOld[idFace + 3]] === 1) id = i1;
        }

        if (id === Utils.TRI_INDEX) continue;
        id *= 3;
        avx += vArOld[id];
        avy += vArOld[id + 1];
        avz += vArOld[id + 2];
        beta++;
      }
      if (beta < 2) { // non manifold boring stuffs
        even[j] = vArOld[j];
        even[j + 1] = vArOld[j + 1];
        even[j + 2] = vArOld[j + 2];
      } else {
        beta = 0.25/beta;
        alpha = 0.75;
        even[j] = vArOld[j]*alpha + avx*beta;
        even[j + 1] = vArOld[j + 1]*alpha + avy*beta;
        even[j + 2] = vArOld[j + 2]*alpha + avz*beta;
      }
      continue;
    }
    let start = vrvStartCount[i*2];
    let count = vrvStartCount[i*2 + 1];
    let end = start + count;
    // interior vertex
    for (k = start; k < end; ++k) {
      id = vertRingVert[k]*3;
      avx += vArOld[id];
      avy += vArOld[id + 1];
      avz += vArOld[id + 2];
    }
    // only vertex tri
    if (onlyTri) {
      if (count === 6) {
        beta = 0.0625;
        alpha = 0.625;
      } else if (count === 3) { // warren weights
        beta = 0.1875;
        alpha = 0.4375;
      } else {
        beta = 0.375/count;
        alpha = 0.625;
      }
      even[j] = vArOld[j]*alpha + avx*beta;
      even[j + 1] = vArOld[j + 1]*alpha + avy*beta;
      even[j + 2] = vArOld[j + 2]*alpha + avz*beta;
      continue;
    }
    let oppx = 0.0;
    let oppy = 0.0;
    let oppz = 0.0;
    let gamma = 0.0;

    let startFace = vrfStartCount[i*2];
    let endFace = startFace + vrfStartCount[i*2 + 1];
    let nbQuad = 0;
    for (k = startFace; k < endFace; ++k) {
      id = vertRingFace[k]*4;
      let iv4 = fArOld[id + 3];
      if (iv4 === Utils.TRI_INDEX) continue;

      nbQuad++;
      let iv1 = fArOld[id];
      let iv2 = fArOld[id + 1];
      let iv3 = fArOld[id + 2];
      let ivOpp = 0;
      if (iv1 === i) ivOpp = iv3*3;
      else if (iv2 === i) ivOpp = iv4*3;
      else if (iv3 === i) ivOpp = iv1*3;
      else ivOpp = iv2*3;
      oppx += vArOld[ivOpp];
      oppy += vArOld[ivOpp + 1];
      oppz += vArOld[ivOpp + 2];
    }

    // interior vertex quad
    if (nbQuad === (endFace - startFace)) {
      if (count === 4) {
        alpha = 0.5625;
        beta = 0.09375;
        gamma = 0.015625;
      } else {
        beta = 1.5/(count*count);
        gamma = 0.25/(count*count);
        alpha = 1.0 - (beta + gamma)*count;
      }
      even[j] = vArOld[j]*alpha + avx*beta + oppx*gamma;
      even[j + 1] = vArOld[j + 1]*alpha + avy*beta + oppy*gamma;
      even[j + 2] = vArOld[j + 2]*alpha + avz*beta + oppz*gamma;
      continue;
    }
    // interior vertex tri
    if (nbQuad === 0) {
      if (count === 6) {
        beta = 0.0625;
        alpha = 0.625;
      } else if (count === 3) { // warren weights
        beta = 0.1875;
        alpha = 0.4375;
      } else {
        beta = 0.375/count;
        alpha = 0.625;
      }
      even[j] = vArOld[j]*alpha + avx*beta;
      even[j + 1] = vArOld[j + 1]*alpha + avy*beta;
      even[j + 2] = vArOld[j + 2]*alpha + avz*beta;
      continue;
    }
    // interior tri-quad
    alpha = 1.0/(1.0 + count*0.5 + nbQuad*0.25);
    beta = alpha*0.5;
    gamma = alpha*0.25;
    even[j] = vArOld[j]*alpha + avx*beta + oppx*gamma;
    even[j + 1] = vArOld[j + 1]*alpha + avy*beta + oppy*gamma;
    even[j + 2] = vArOld[j + 2]*alpha + avz*beta + oppz*gamma;
  }
};

/** Odd vertices smoothing */
let applyOddSmooth = function (mesh, odds, colorOut, materialOut, fArOut) {
  let fAr = mesh.getFaces();
  let feAr = mesh.getFaceEdges();
  let oddComputer = new OddVertexComputer(mesh, odds, colorOut, materialOut);
  for (let i = 0, len = mesh.getNbFaces(); i < len; ++i) {
    let id = i*4;
    let iv1 = fAr[id];
    let iv2 = fAr[id + 1];
    let iv3 = fAr[id + 2];
    let iv4 = fAr[id + 3];
    let isQuad = iv4 !== Utils.TRI_INDEX;
    let ivMid1, ivMid2, ivMid3, ivMid4, ivCen;

    if (isQuad) {
      ivMid1 = oddComputer.computeQuadEdgeVertex(iv1, iv2, iv3, iv4, feAr[id]);
      ivMid2 = oddComputer.computeQuadEdgeVertex(iv2, iv3, iv4, iv1, feAr[id + 1]);
      ivMid3 = oddComputer.computeQuadEdgeVertex(iv3, iv4, iv1, iv2, feAr[id + 2]);
      ivMid4 = oddComputer.computeQuadEdgeVertex(iv4, iv1, iv2, iv3, feAr[id + 3]);
      ivCen = oddComputer.computeFaceVertex(iv1, iv2, iv3, iv4);
    } else {
      ivMid1 = oddComputer.computeTriangleEdgeVertex(iv1, iv2, iv3, feAr[id]);
      ivMid2 = oddComputer.computeTriangleEdgeVertex(iv2, iv3, iv1, feAr[id + 1]);
      ivMid3 = oddComputer.computeTriangleEdgeVertex(iv3, iv1, iv2, feAr[id + 2]);
    }

    if (!fArOut)
      continue;

    id *= 4;
    if (isQuad) {
      fArOut[id + 1] = fArOut[id + 4] = ivMid1;
      fArOut[id + 6] = fArOut[id + 9] = ivMid2;
      fArOut[id + 11] = fArOut[id + 14] = ivMid3;
      fArOut[id + 3] = fArOut[id + 12] = ivMid4;
      fArOut[id + 2] = fArOut[id + 7] = fArOut[id + 8] = fArOut[id + 13] = ivCen;
      fArOut[id] = iv1;
      fArOut[id + 5] = iv2;
      fArOut[id + 10] = iv3;
      fArOut[id + 15] = iv4;
    } else {
      fArOut[id] = fArOut[id + 5] = fArOut[id + 8] = ivMid1;
      fArOut[id + 1] = fArOut[id + 10] = fArOut[id + 12] = ivMid2;
      fArOut[id + 2] = fArOut[id + 6] = fArOut[id + 14] = ivMid3;
      fArOut[id + 3] = fArOut[id + 7] = fArOut[id + 11] = fArOut[id + 15] = Utils.TRI_INDEX;
      fArOut[id + 4] = iv1;
      fArOut[id + 9] = iv2;
      fArOut[id + 13] = iv3;
    }
  }
  return oddComputer._tagEdges;
};

/** Computes uv faces and uv coordinates for center vertices */
let computeFaceTexCoords = function (mesh, newMesh, tagEdges) {
  let fArUVOld = mesh.getFacesTexCoord();
  let fAr = newMesh.getFaces();
  let fArUV = new Uint32Array(fAr.length);
  let feAr = mesh.getFaceEdges();

  let nbVertices = mesh.getNbVertices();
  let offset = newMesh.getNbVertices() - nbVertices;

  let startCount = newMesh.getVerticesDuplicateStartCount();
  let uvAr = newMesh.getTexCoords();
  for (let i = 0, len = mesh.getNbFaces(); i < len; ++i) {
    let id = i*4;
    let iuv1 = fArUVOld[id];
    let iuv2 = fArUVOld[id + 1];
    let iuv3 = fArUVOld[id + 2];
    let iuv4 = fArUVOld[id + 3];
    if (iuv1 >= nbVertices) iuv1 += offset;
    if (iuv2 >= nbVertices) iuv2 += offset;
    if (iuv3 >= nbVertices) iuv3 += offset;
    if (iuv4 !== Utils.TRI_INDEX && iuv4 >= nbVertices) iuv4 += offset;

    let ide = feAr[id];
    let tg1 = tagEdges[ide] - 1;
    if (tg1 < 0)
      tg1 = startCount[(-tg1 - 1)*2];
    else if (startCount[tg1*2] > 0)
      tagEdges[ide] = -tg1;

    ide = feAr[id + 1];
    let tg2 = tagEdges[ide] - 1;
    if (tg2 < 0)
      tg2 = startCount[(-tg2 - 1)*2];
    else if (startCount[tg2*2] > 0)
      tagEdges[ide] = -tg2;

    ide = feAr[id + 2];
    let tg3 = tagEdges[ide] - 1;
    if (tg3 < 0)
      tg3 = startCount[(-tg3 - 1)*2];
    else if (startCount[tg3*2] > 0)
      tagEdges[ide] = -tg3;

    id *= 4;
    if (iuv4 !== Utils.TRI_INDEX) {
      ide = feAr[i*4 + 3];
      let tg4 = tagEdges[ide] - 1;
      if (tg4 < 0)
        tg4 = startCount[(-tg4 - 1)*2];
      else if (startCount[tg4*2] > 0)
        tagEdges[ide] = -tg4;

      fArUV[id + 1] = fArUV[id + 4] = tg1;
      fArUV[id + 6] = fArUV[id + 9] = tg2;
      fArUV[id + 11] = fArUV[id + 14] = tg3;
      fArUV[id + 3] = fArUV[id + 12] = tg4;
      fArUV[id + 2] = fArUV[id + 7] = fArUV[id + 8] = fArUV[id + 13] = fAr[id + 2];
      fArUV[id] = iuv1;
      fArUV[id + 5] = iuv2;
      fArUV[id + 10] = iuv3;
      fArUV[id + 15] = iuv4;

      // even averaging for center quad
      let im = fAr[id + 2]*2;
      uvAr[im] = (uvAr[iuv1*2] + uvAr[iuv2*2] + uvAr[iuv3*2] + uvAr[iuv4*2])*0.25;
      uvAr[im + 1] = (uvAr[iuv1*2 + 1] + uvAr[iuv2*2 + 1] + uvAr[iuv3*2 + 1] + uvAr[iuv4*2 + 1])*0.25;
    } else {
      fArUV[id] = fArUV[id + 5] = fArUV[id + 8] = tg1;
      fArUV[id + 1] = fArUV[id + 10] = fArUV[id + 12] = tg2;
      fArUV[id + 2] = fArUV[id + 6] = fArUV[id + 14] = tg3;
      fArUV[id + 3] = fArUV[id + 7] = fArUV[id + 11] = fArUV[id + 15] = Utils.TRI_INDEX;
      fArUV[id + 4] = iuv1;
      fArUV[id + 9] = iuv2;
      fArUV[id + 13] = iuv3;
    }
  }

  newMesh.setFacesTexCoord(fArUV);
};

/** Subdivide tex coords mesh */
let computeTexCoords = function (mesh, newMesh, tagEdges) {
  let newNbVertices = newMesh.getNbVertices();
  let startCount = new Uint32Array(newNbVertices*2);
  startCount.set(mesh.getVerticesDuplicateStartCount());

  let fArOld = mesh.getFaces();
  let fArUVOld = mesh.getFacesTexCoord();

  let bound = newMesh.getNbFaces()*3;
  let uvArOld = mesh.getTexCoords();
  let uvAr = new Float32Array(Utils.getMemory(bound*4*2), 0, bound*2);

  let i = 0;
  let len = mesh.getNbVertices();
  let offset = newNbVertices - len;
  // reorder even duplicates vertex indices
  for (i = 0; i < len; ++i) {
    let start = startCount[i*2];
    if (start > 0)
      startCount[i*2] = start + offset;
  }
  uvAr.set(uvArOld);
  uvAr.set(uvArOld.subarray(len*2), (len + offset)*2);
  let nbTexCoords = mesh.getNbTexCoords();

  let acc = offset + nbTexCoords;
  let feAr = mesh.getFaceEdges();

  // compute uv for new odd vertices
  let tagUVMin = new Uint32Array(tagEdges.length);
  let tagUVMax = new Uint32Array(tagEdges.length);
  len = fArOld.length;
  for (i = 0; i < len; ++i) {
    let ide = feAr[i];
    if (ide === Utils.TRI_INDEX)
      continue;

    let iNext = (i + 1)%4 === 0 ? i - 3 : i + 1;
    let iuv1 = fArUVOld[i];
    let iuv2 = fArUVOld[iNext];
    if (iuv2 === Utils.TRI_INDEX)
      iuv2 = fArUVOld[i - 2];
    let tg = tagEdges[ide] - 1;

    // test if we already processed this edge
    let tgMax = tagUVMax[ide];
    let iuvMax = iuv1 > iuv2 ? iuv1 : iuv2;
    let iuvMin = iuv1 < iuv2 ? iuv1 : iuv2;
    if (tgMax !== 0) {
      // test if we already processed this UV edge or if it's a duplicate
      if (tgMax !== iuvMax || tagUVMin[ide] !== iuvMin) {
        uvAr[acc*2] = (uvArOld[iuv1*2] + uvArOld[iuv2*2])*0.5;
        uvAr[acc*2 + 1] = (uvArOld[iuv1*2 + 1] + uvArOld[iuv2*2 + 1])*0.5;
        startCount[tg*2] = acc++;
        startCount[tg*2 + 1] = 1;
      }
    } else {
      // first time we process this edge
      uvAr[tg*2] = (uvArOld[iuv1*2] + uvArOld[iuv2*2])*0.5;
      uvAr[tg*2 + 1] = (uvArOld[iuv1*2 + 1] + uvArOld[iuv2*2 + 1])*0.5;
      tagUVMin[ide] = iuvMin;
      tagUVMax[ide] = iuvMax;
    }
  }
  let texCoords = new Float32Array(acc*2);
  texCoords.set(uvAr.subarray(0, acc*2));

  newMesh.setTexCoords(texCoords);
  newMesh.setVerticesDuplicateStartCount(startCount);

  computeFaceTexCoords(mesh, newMesh, tagEdges);
};

/** Apply a complete subdivision (by updating the topology) */
Subdivision.fullSubdivision = function (baseMesh, newMesh) {
  let nbVertices = baseMesh.getNbVertices() + baseMesh.getNbEdges() + baseMesh.getNbQuads();
  newMesh.setVertices(new Float32Array(nbVertices*3));
  newMesh.setColors(new Float32Array(nbVertices*3));
  newMesh.setMaterials(new Float32Array(nbVertices*3));
  newMesh.setFaces(new Uint32Array(baseMesh.getNbFaces()*4*4));
  applyEvenSmooth(baseMesh, newMesh.getVertices(), newMesh.getColors(), newMesh.getMaterials());
  let tags = applyOddSmooth(baseMesh, newMesh.getVertices(), newMesh.getColors(), newMesh.getMaterials(), newMesh.getFaces());
  if (baseMesh.hasUV())
    computeTexCoords(baseMesh, newMesh, tags);
  newMesh.allocateArrays();
};

/** Apply subdivision without topology computation */
Subdivision.partialSubdivision = function (baseMesh, vertOut, colorOut, materialOut) {
  applyEvenSmooth(baseMesh, vertOut, colorOut, materialOut);
  applyOddSmooth(baseMesh, vertOut, colorOut, materialOut);
};

export default Subdivision;
