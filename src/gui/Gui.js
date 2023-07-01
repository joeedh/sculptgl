import yagui from '../lib/yagui.js';
import TR from './GuiTR.js';
import GuiBackground from './GuiBackground.js';
import GuiCamera from './GuiCamera.js';
import GuiConfig from './GuiConfig.js';
import GuiFiles from './GuiFiles.js';
import GuiMesh from './GuiMesh.js';
import GuiTopology from './GuiTopology.js';
import GuiRendering from './GuiRendering.js';
import GuiScene from './GuiScene.js';
import GuiSculpting from './GuiSculpting.js';
import GuiStates from './GuiStates.js';
import GuiTablet from './GuiTablet.js';
import ShaderContour from '../render/shaders/ShaderContour.js';

import Export from '../files/Export.js';

class Gui {

  constructor(main) {
    this._main = main;

    this._guiMain = null;
    this._sidebar = null;
    this._topbar = null;

    this._ctrlTablet = null;
    this._ctrlFiles = null;
    this._ctrlScene = null;
    this._ctrlStates = null;
    this._ctrlCamera = null;
    this._ctrlBackground = null;

    this._ctrlSculpting = null;
    this._ctrlTopology = null;
    this._ctrlRendering = null;

    this._ctrlNotification = null;

    this._ctrls = []; // list of controllers

    // upload
    this._notifications = {};
    this._xhrs = {};
  }

  destroy() {
    this._guiMain.domMain.remove();

  }

  initGui() {
    this.deleteGui();

    this._guiMain = new yagui.GuiMain(this._main.getViewport(), this._main.onCanvasResize.bind(this._main));

    let ctrls = this._ctrls;
    ctrls.length = 0;
    let idc = 0;

    // Initialize the topbar
    this._topbar = this._guiMain.addTopbar();
    ctrls[idc++] = this._ctrlFiles = new GuiFiles(this._topbar, this);
    // this.initPrint(this._topbar);
    ctrls[idc++] = this._ctrlScene = new GuiScene(this._topbar, this);
    ctrls[idc++] = this._ctrlStates = new GuiStates(this._topbar, this);
    ctrls[idc++] = this._ctrlBackground = new GuiBackground(this._topbar, this);
    ctrls[idc++] = this._ctrlCamera = new GuiCamera(this._topbar, this);
    // TODO find a way to get pressure event
    ctrls[idc++] = this._ctrlTablet = new GuiTablet(this._topbar, this);
    ctrls[idc++] = this._ctrlConfig = new GuiConfig(this._topbar, this);
    ctrls[idc++] = this._ctrlMesh = new GuiMesh(this._topbar, this);

    // Initialize the sidebar
    this._sidebar = this._guiMain.addRightSidebar();
    ctrls[idc++] = this._ctrlRendering = new GuiRendering(this._sidebar, this);
    ctrls[idc++] = this._ctrlTopology = new GuiTopology(this._sidebar, this);
    ctrls[idc++] = this._ctrlSculpting = new GuiSculpting(this._sidebar, this);

    // gui extra
    let extra = this._topbar.addExtra();
    // Extra : Настройка интерфейса
    extra.addTitle(TR('contour'));
    extra.addColor(TR('contourColor'), ShaderContour.color, this.onContourColor.bind(this));

    extra.addTitle(TR('resolution'));
    extra.addSlider('', this._main._pixelRatio, this.onPixelRatio.bind(this), 0.5, 2.0, 0.02);

    this.addAboutButton();

    this.updateMesh();
    this.setVisibility(true);

    if (window.postprocessGui) window.postprocessGui();
  }

  getNotification(notifName) {
    let notif = this._notifications[notifName];
    if (!notif) {
      notif = this._topbar.addMenu();
      notif.isVisible = function () {
        return !this.domContainer.hidden;
      };
      notif.setMessage = function (msg) {
        this.domContainer.innerHTML = msg;
        this.setVisibility(!!msg);
      };

      notif.domContainer.style.color = 'red';
      notif.setMessage('');

      this._notifications[notifName] = notif;
      return notif;
    }

    if (this._xhrs[notifName] && notif.isVisible()) {
      if (window.confirm('Abort ' + notifName + ' previous upload?')) {
        this._xhrs[notifName].abort();
        this._xhrs[notifName].isAborted = true;
        notif.setMessage(null);
      }
      return;
    }

    return notif;
  }

  initPrint(guiParent) {
    let menu = guiParent.addMenu('Print it!');
    // menu.addButton('with Sculpteo', this, 'exportSculpteo');
    menu.addButton('Go to Materialise!', this, 'exportMaterialise');
  }

  exportSculpteo() {
    this._export('sculpteo');
  }

  exportMaterialise() {
    if (window.confirm('A new webpage will be opened. Start upload?')) {
      this._export('materialise');
    }
  }

  exportSketchfab() {
    this._export('sketchfab');
  }

  _export(notifName) {
    let mesh = this._main.getMesh();
    if (!mesh) return;

    let notif = this.getNotification(notifName);
    if (!notif) return;

    let fName = 'export' + notifName.charAt(0).toUpperCase() + notifName.slice(1);
    this._xhrs[notifName] = Export[fName](this._main, notif);
  }

  onPixelRatio(val) {
    this._main._pixelRatio = val;
    this._main.onCanvasResize();
  }

  onContourColor(col) {
    ShaderContour.color[0] = col[0];
    ShaderContour.color[1] = col[1];
    ShaderContour.color[2] = col[2];
    ShaderContour.color[3] = col[3];
    this._main.render();
  }

  addAboutButton() {
    let ctrlAbout = this._topbar.addMenu();
    ctrlAbout.domContainer.innerHTML = TR('about');
    ctrlAbout.domContainer.addEventListener('mousedown', function () {
      window.open('http://stephaneginier.com', '_blank');
    });
  }

  updateMesh() {
    this._ctrlRendering.updateMesh();
    this._ctrlTopology.updateMesh();
    this._ctrlSculpting.updateMesh();
    this._ctrlScene.updateMesh();
    this.updateMeshInfo();
  }

  updateMeshInfo() {
    this._ctrlMesh.updateMeshInfo();
  }

  getFlatShading() {
    return this._ctrlRendering.getFlatShading();
  }

  getWireframe() {
    return this._ctrlRendering.getWireframe();
  }

  getShaderType() {
    return this._ctrlRendering.getShaderType();
  }

  addAlphaOptions(opts) {
    this._ctrlSculpting.addAlphaOptions(opts);
  }

  deleteGui() {
    if (!this._guiMain || !this._guiMain.domMain.parentNode)
      return;
    this.callFunc('removeEvents');
    this.setVisibility(false);
    this._guiMain.domMain.parentNode.removeChild(this._guiMain.domMain);
  }

  setVisibility(bool) {
    this._guiMain.setVisibility(bool);
  }

  callFunc(func, event) {
    for (let i = 0, ctrls = this._ctrls, nb = ctrls.length; i < nb; ++i) {
      let ct = ctrls[i];
      if (ct && ct[func])
        ct[func](event);
    }
  }
}

export default Gui;
