import TR from './GuiTR.js';
import Enums from '../misc/Enums.js';
import Tools from '../editing/tools/Tools.js';
import getOptionsURL from '../misc/getOptionsURL.js';
import GuiSculptingTools from './GuiSculptingTools.js';

let GuiTools = GuiSculptingTools.tools;

class GuiSculpting {

  constructor(guiParent, ctrlGui) {
    this._main = ctrlGui._main; // main application
    this._ctrlGui = ctrlGui; // main gui
    this._sculptManager = ctrlGui._main.getSculptManager(); // sculpting management
    this._toolOnRelease = -1; // tool to apply when the mouse or the key is released
    this._invertSign = false; // invert sign of tool (add/sub)

    this._modalBrushRadius = false; // modal brush radius change
    this._modalBrushIntensity = false; // modal brush intensity change

    // modal stuffs (not canvas based, because no 3D picking involved)
    this._lastPageX = 0;
    this._lastPageY = 0;
    // for modal radius
    this._refX = 0;
    this._refY = 0;

    this._menu = null;
    this._ctrlSculpt = null;
    this._ctrlSymmetry = null;
    this._ctrlContinuous = null;
    this._ctrlTitleCommon = null;
    this.init(guiParent);
  }

  init(guiParent) {
    let menu = this._menu = guiParent.addMenu(TR('sculptTitle'));
    menu.open();

    menu.addTitle(TR('sculptTool'));

    // sculpt tool
    let optTools = [];
    for (let i = 0, nbTools = Tools.length; i < nbTools; ++i) {
      if (Tools[i]) optTools[i] = TR(Tools[i].uiName);
    }
    this._ctrlSculpt = menu.addCombobox(TR('sculptTool'), this._sculptManager.getToolIndex(), this.onChangeTool.bind(this), optTools);

    GuiSculptingTools.initGuiTools(this._sculptManager, this._menu, this._main);

    this._ctrlTitleCommon = menu.addTitle(TR('sculptCommon'));
    // symmetry
    this._ctrlSymmetry = menu.addCheckbox(TR('sculptSymmetry'), this._sculptManager._symmetry, this.onSymmetryChange.bind(this));
    // continuous
    this._ctrlContinuous = menu.addCheckbox(TR('sculptContinuous'), this._sculptManager, '_continuous');

    GuiSculptingTools.show(this._sculptManager.getToolIndex());
    this.addEvents();
    this.onChangeTool(this._sculptManager.getToolIndex());
  }

  onSymmetryChange(value) {
    this._sculptManager._symmetry = value;
    this._main.render();
  }

  addEvents() {
    let cbLoadAlpha = this.loadAlpha.bind(this);
    document.getElementById('alphaopen').addEventListener('change', cbLoadAlpha, false);
    this.removeCallback = function () {
      document.getElementById('alphaopen').removeEventListener('change', cbLoadAlpha, false);
    };
  }

  removeEvents() {
    if (this.removeCallback) this.removeCallback();
  }

  getSelectedTool() {
    return this._ctrlSculpt.getValue();
  }

  releaseInvertSign() {
    if (!this._invertSign)
      return;
    this._invertSign = false;
    let tool = GuiTools[this.getSelectedTool()];
    if (tool.toggleNegative)
      tool.toggleNegative();
  }

  onChangeTool(newValue) {
    GuiSculptingTools.hide(this._sculptManager.getToolIndex());
    this._sculptManager.setToolIndex(newValue);
    GuiSculptingTools.show(newValue);

    let showContinuous = this._sculptManager.canBeContinuous() === true;
    this._ctrlContinuous.setVisibility(showContinuous);

    let showSym = newValue !== Enums.Tools.TRANSFORM;
    this._ctrlSymmetry.setVisibility(showSym);

    this._ctrlTitleCommon.setVisibility(showContinuous || showSym);

    this._main.getPicking().updateLocalAndWorldRadius2();
  }

  loadAlpha(event) {
    if (event.target.files.length === 0)
      return;

    let file = event.target.files[0];
    if (!file.type.match('image.*'))
      return;

    let reader = new FileReader();
    let main = this._main;
    let tool = GuiTools[this._sculptManager.getToolIndex()];

    reader.onload = function (evt) {
      let img = new Image();
      img.src = evt.target.result;
      img.onload = main.onLoadAlphaImage.bind(main, img, file.name || 'new alpha', tool);
    };

    document.getElementById('alphaopen').value = '';
    reader.readAsDataURL(file);
  }

  addAlphaOptions(opts) {
    for (let i = 0, nbTools = GuiTools.length; i < nbTools; ++i) {
      let gTool = GuiTools[i];
      if (gTool && gTool._ctrlAlpha) gTool._ctrlAlpha.addOptions(opts);
    }
  }

  updateMesh() {
    this._menu.setVisibility(!!this._main.getMesh());
  }

  _startModalBrushRadius(x, y) {
    this._refX = x;
    this._refY = y;
    let cur = GuiTools[this.getSelectedTool()];
    if (cur._ctrlRadius) {
      let rad = cur._ctrlRadius.getValue();
      this._refX -= rad;
      this._main.getSculptManager().getSelection().setOffsetX(-rad*this._main.getPixelRatio());
      this._main.renderSelectOverRtt();
    }
  }

  _checkModifierKey(event) {
    let selectedTool = this.getSelectedTool();

    if (this._main._action === Enums.Action.NOTHING) {
      if (event.shiftKey && !event.altKey && !event.ctrlKey) {
        // smoothing on shift key
        if (selectedTool !== Enums.Tools.SMOOTH) {
          this._toolOnRelease = selectedTool;
          this._ctrlSculpt.setValue(Enums.Tools.SMOOTH);
        }
      }
      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        // masking on ctrl key
        if (selectedTool !== Enums.Tools.MASKING) {
          this._toolOnRelease = selectedTool;
          this._ctrlSculpt.setValue(Enums.Tools.MASKING);
        }
      }
    }
    if (event.altKey) {
      // invert sign on alt key
      if (this._invertSign || event.shiftKey) return true;
      this._invertSign = true;
      let curTool = GuiTools[selectedTool];
      if (curTool.toggleNegative)
        curTool.toggleNegative();
      return true;
    }
    return false;
  }

  ////////////////
  // KEY EVENTS
  //////////////// 
  onKeyDown(event) {
    if (event.handled === true)
      return;

    let main = this._main;
    let shk = getOptionsURL.getShortKey(event.which);
    event.stopPropagation();

    if (!main._focusGui || shk === Enums.KeyAction.RADIUS || shk === Enums.KeyAction.INTENSITY)
      event.preventDefault();

    event.handled = true;
    if (this._checkModifierKey(event))
      return;

    if (main._action !== Enums.Action.NOTHING)
      return;

    if (shk !== undefined && Tools[shk])
      return this._ctrlSculpt.setValue(shk);

    let cur = GuiTools[this.getSelectedTool()];

    switch (shk) {
      case Enums.KeyAction.DELETE:
        main.deleteCurrentSelection();
        break;
      case Enums.KeyAction.INTENSITY:
        this._modalBrushIntensity = main._focusGui = true;
        break;
      case Enums.KeyAction.RADIUS:
        if (!this._modalBrushRadius) this._startModalBrushRadius(this._lastPageX, this._lastPageY);
        this._modalBrushRadius = main._focusGui = true;
        break;
      case Enums.KeyAction.NEGATIVE:
        if (cur.toggleNegative) cur.toggleNegative();
        break;
      case Enums.KeyAction.PICKER:
        let ctrlPicker = cur._ctrlPicker;
        if (ctrlPicker && !ctrlPicker.getValue()) ctrlPicker.setValue(true);
        break;
      default:
        event.handled = false;
    }
  }

  onKeyUp(event) {
    let releaseTool = this._main._action === Enums.Action.NOTHING && this._toolOnRelease !== -1 && !event.ctrlKey && !event.shiftKey;
    if (!event.altKey || releaseTool)
      this.releaseInvertSign();

    if (releaseTool) {
      this._ctrlSculpt.setValue(this._toolOnRelease);
      this._toolOnRelease = -1;
    }

    let main = this._main;
    switch (getOptionsURL.getShortKey(event.which)) {
      case Enums.KeyAction.RADIUS:
        this._modalBrushRadius = main._focusGui = false;
        let selRadius = this._main.getSculptManager().getSelection();
        selRadius.setOffsetX(0.0);
        event.pageX = this._lastPageX;
        event.pageY = this._lastPageY;
        main.setMousePosition(event);
        main.getPicking().intersectionMouseMeshes();
        main.renderSelectOverRtt();
        break;
      case Enums.KeyAction.PICKER:
        let cur = GuiTools[this.getSelectedTool()];
        let ctrlPicker = cur._ctrlPicker;
        if (ctrlPicker && ctrlPicker.getValue()) ctrlPicker.setValue(false);
        break;
      case Enums.KeyAction.INTENSITY:
        this._modalBrushIntensity = main._focusGui = false;
        break;
    }
  }

  ////////////////
  // MOUSE EVENTS
  ////////////////
  onMouseUp(event) {
    if (this._toolOnRelease !== -1 && !event.ctrlKey && !event.shiftKey) {
      this.releaseInvertSign();
      this._ctrlSculpt.setValue(this._toolOnRelease);
      this._toolOnRelease = -1;
    }
  }

  onMouseMove(event) {
    let wid = GuiTools[this.getSelectedTool()];

    if (this._modalBrushRadius && wid._ctrlRadius) {
      let dx = event.pageX - this._refX;
      let dy = event.pageY - this._refY;
      wid._ctrlRadius.setValue(Math.sqrt(dx*dx + dy*dy));
      this._main.renderSelectOverRtt();
    }

    if (this._modalBrushIntensity && wid._ctrlIntensity) {
      wid._ctrlIntensity.setValue(wid._ctrlIntensity.getValue() + event.pageX - this._lastPageX);
    }

    this._lastPageX = event.pageX;
    this._lastPageY = event.pageY;
  }

  onMouseOver(event) {
    if (this._modalBrushRadius)
      this._startModalBrushRadius(event.pageX, event.pageY);
  }
}

export default GuiSculpting;
