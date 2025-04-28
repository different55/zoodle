class Zoodle {
  constructor(sceneElem, overlayElem, uiElem, panelElem) {
    // TODO: Calculate appropriate zooms and sizes
    let zoom = 10;
    let rotate = { x: -Math.atan(1 / Math.sqrt(2)), y: TAU / 8 };

    this.scene = new Zdog.Illustration({
      element: sceneElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });
    this.overlay = new Zdog.Illustration({
      element: overlayElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });
    this.ui = new Zdog.Illustration({
      element: uiElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });

    this.selection = [];
    this.history = new History();
    this.tools = {
      orbit: new OrbitTool(this),
      translate: new TranslateTool(this),
      rotate: new RotateTool(this),
    };
    this.tool = this.tools.translate;

    this.props = new Properties(panelElem, this);

    this.presets = {
      solar: new Solar(),
    }

    this.presets.solar.load(this.scene);

    // TODO: We should capture input when dragging, but this seems to break clicking...
    this.sceneInput = new Zfetch({
      scene: this.scene,
      click: this.click.bind(this),
      dragStart: this.dragStart.bind(this),
      dragMove: this.dragMove.bind(this),
      dragEnd: this.dragEnd.bind(this),
    });

    this.uiInput = new Zfetch({
      scene: this.ui,
      capture: true,
      click: this.click.bind(this),
      dragStart: this.dragStart.bind(this),
      dragMove: this.dragMove.bind(this),
      dragEnd: this.dragEnd.bind(this),
    });

    uiElem.addEventListener("gotpointercapture", _ => uiElem.classList.add("active"));
    uiElem.addEventListener("lostpointercapture", _ => uiElem.classList.remove("active"));

    this.props.updatePanel();
    this.updateHighlights();
    this.updateUI();
    this.update();
  }

  update() {
    this.syncLayers();
    this.scene.updateRenderGraph();
    this.overlay.updateRenderGraph();
    this.ui.updateRenderGraph();
    //this.scene.element.setAttribute("data-zdog", JSON.stringify(this.scene));
    requestAnimationFrame(this.update.bind(this));
  }

  set tool(tool) {
    this._tool = tool;
    this.updateUI();
  }
  get tool() { return this._tool; }

  // Perform a command and add it to the history.
  do(command) {
    this.history.push(command);
    command.do();
  }

  // Store a record of a command that has already been performed.
  did(command) {
    this.history.push(command);
  }

  setSelection(targets) {
    if (!Array.isArray(targets)) {
      targets = [targets];
    }

    this.selection = targets;
  }

  toggleSelection(target) {
    const index = this.selection.indexOf(target);
    if (index !== -1) {
      this.selection.splice(index, 1);
    } else {
      this.selection.push(target);
    }
  }

  clearSelection() {
    this.selection.length = 0;
  }

  updateHighlights() {
    this.overlay.children = [];
    this.selection.forEach((selected) => {
      let highlight = selected.copyGraph({
        addTo: this.overlay,
        color: "#E62",
        backface: "#E62",
        ...this.getWorldTransforms(selected),
      });

      // Highlight all children
      highlight.flatGraph.forEach((child) => {
        child.color = '#E62';
        child.backface = '#E62';
      });

      // Apply parent transforms to selected object.
      // Zdog.extend(highlight, this.getWorldTransforms(selected));
    });
  }

  updateUI() {
    this.ui.children = [];

    if (this.selection.length === 0) {
      return;
    }

    this.tool.drawWidget(this.selection);
  }

  syncLayers() {
    const scene = this.scene;
    const targets = [this.overlay, this.ui];

    targets.forEach((target) => {
      target.translate = scene.translate;
      target.rotate = scene.rotate;
      target.scale = scene.scale;
      target.zoom = scene.zoom;
      target.updateGraph();
    });
  }

  getWorldTransforms(target) {
    let translate = new Zdog.Vector();
    let rotate = new Zdog.Vector();
    let scale = new Zdog.Vector({x: 1, y: 1, z: 1});

    let right = new Zdog.Vector({x: 1, y: 0, z: 0});
    let down = new Zdog.Vector({x: 0, y: 1, z: 0});
    let forward = new Zdog.Vector({x: 0, y: 0, z: 1});

    // Condense transforms from all ancestors except the root.
    while (target.addTo) {
      translate.transform(target.translate, target.rotate, target.scale);
      forward.rotate(target.rotate);
      down.rotate(target.rotate);
      right.rotate(target.rotate);
      scale.multiply(target.scale);

      target = target.addTo;
    }

    if (Math.abs(forward.x) > 0.99999) {
      // Gimbal lock case
      rotate.x = 0;
      rotate.y = forward.x > 0 ? -Math.PI/2 : Math.PI/2;
      rotate.z = Math.atan2(right.y, down.y);
    } else {
      rotate.y = -Math.asin(forward.x);
      rotate.x = Math.atan2(-forward.y, forward.z);
      rotate.z = Math.atan2(-down.x, right.x);
    }
    return {translate: translate, rotate: rotate, scale: scale};
  }

  // input
  click(ptr, target, x, y) {
    target.layer = this.getLayer(target.element)
    this.do(new SelectCommand(this, target));
  }

  dragStart(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    if (!target || !target.addTo) {
      this.tool = new TemporaryTool(this, this.tool, this.tools.orbit, true);
    }

    this.tool.start(ptr, target, x, y);
  }

  dragMove(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    this.tool.move(ptr, target, x, y);
  }

  dragEnd(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    this.tool.end(ptr, target, x, y);
  }

  getLayer(element) {
    switch (element) {
      case this.scene.element:
        return Zoodle.LAYER_CANVAS;
      case this.overlay.element:
        return Zoodle.LAYER_OVERLAY;
      case this.ui.element:
        return Zoodle.LAYER_UI;
      default:
        console.error(`Unsupported element ${element}`);
    }
  }

  // returns the distance of a point (x, y) from the origin along the axis defined by the angle.
  getAxisDistance(x, y, angle) {
    return x * Math.cos(angle) + y * Math.sin(angle);
  }

  static get LAYER_CANVAS() { return 1; }
  static get LAYER_OVERLAY() { return 2; }
  static get LAYER_UI() { return 3; }
}

class Tool {
  constructor(editor) {
    this.editor = editor;
  }
  start(ptr, target, x, y) {}
  move(ptr, target, x, y) {}
  end(ptr, target, x, y) {}
  drawWidget(targets) {}
}

// this tool performs the actions of another tool without hiding the widgets of the original
class TemporaryTool extends Tool {
  constructor(editor, style, substance, autoRestore = true) {
    super(editor);
    this.style = style;
    this.substance = substance;
    this.autoRestore = autoRestore;
  }
  start(ptr, target, x, y) {
    this.substance.start(ptr, target, x, y);
  }
  move(ptr, target, x, y) {
    this.substance.move(ptr, target, x, y);
  }
  end(ptr, target, x, y) {
    this.substance.end(ptr, target, x, y);
    if (this.autoRestore) {
      this.editor.tool = this.style;
    }
  }
  drawWidget(targets) {
    this.style.drawWidget(targets);
  }
}

class OrbitTool extends Tool {
  constructor(editor) {
    super(editor);
    this.rotateStart = null;
  }
  start(ptr, target, x, y) {
    this.rotateStart = this.editor.scene.rotate.copy();
  }
  move(ptr, target, x, y) {
    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    let moveRY = x / displaySize * Math.PI * Zdog.TAU;
    let moveRX = y / displaySize * Math.PI * Zdog.TAU;
    this.editor.scene.rotate.x = this.rotateStart.x - moveRX;
    this.editor.scene.rotate.y = this.rotateStart.y - moveRY;

    this.editor.syncLayers();
  }
}

class TranslateTool extends Tool {
  constructor(editor) {
    super(editor);
    this.targets = null;
    this.startTranslate = null;
    this.mode = TranslateTool.MODE_NONE;
    this.widget = null;
  }
  start(ptr, target, x, y) {
    this.widget = target;
    this.targets = this.editor.selection;
    this.mode = TranslateTool.MODE_NONE;
    if (!this.targets.length || target.layer !== Zoodle.LAYER_UI || !target.color) {
      return;
    }
    // Ensure our widget target is the base and not the tip.
    if (this.widget.diameter)
        this.widget = this.widget.addTo;
    this.startTranslate = this.targets.map((t) => t.translate.copy());
    switch (target.color) {
      case rose:
        this.mode = TranslateTool.MODE_X;
        break;
      case lime:
        this.mode = TranslateTool.MODE_Y;
        break;
      case blueberry:
        this.mode = TranslateTool.MODE_Z;
        break;
      default:
        this.mode = TranslateTool.MODE_NONE;
        break;
    }
  }
  move(ptr, target, x, y) {
    if (!this.mode) { return; }
    let direction = this.widget.renderNormal; // TODO: Break out into a function.
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x));
    delta /= -this.editor.scene.zoom; // TODO: Include pixel ratio as well.
    delta *= this.widget.scale.x;
    this.targets.forEach((t, i) => {
      t.translate[this.mode] = this.startTranslate[i][this.mode] + delta;
    });
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
  end(ptr, target, x, y) {
    if (!this.mode) { return; }
    // ensure any final adjustments are applied.
    this.move(ptr, target, x, y);
    let direction = this.widget.renderNormal; // TODO: Break out into a function.
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x));
    delta /= -this.editor.scene.zoom;
    delta *= this.widget.scale.x;
    let command = new TranslateCommand(this.editor, this.targets, new Zdog.Vector({[this.mode]: delta}), this.startTranslate);
    this.editor.did(command);
  }
  drawWidget(targets) {
    // Create anchors matching selected objects.
    targets = targets.map((target) => {
      // TODO: Double check this is correct.
      let parentTransforms = this.editor.getWorldTransforms(target.addTo);
      let childTranslate = target.translate.copy().rotate(parentTransforms.rotate);
      parentTransforms.translate.add(childTranslate);
      parentTransforms.translate.multiply(parentTransforms.scale);
      return new Zdog.Anchor({
        addTo: this.editor.ui,
        ...parentTransforms,
      });
    });

    let origin = new Zdog.Shape({
      stroke: .5,
      color: lace,
    });
    let base = new Zdog.Shape({
      path: [ { z: -1.5 }, { z: 1.5 } ],
      stroke: 1,
      translate: { z: 3 },
    });
    new Zdog.Cone({
      addTo: base,
      diameter: 2,
      length: 1.5,
      stroke: .5,
      translate: { z: 1.5 },
    });
    let z = base.copyGraph({
      color: blueberry,
    });
    z.children[0].color = blueberry;
    let y = base.copyGraph({
      color: lime,
      rotate: { x: -TAU/4 },
      translate: { y: 3 },
    });
    y.children[0].color = lime;
    let x = base.copyGraph({
      color: rose,
      rotate: { y: -TAU/4 },
      translate: { x: 3 },
    });
    x.children[0].color = rose;
    targets.forEach(t => {
      origin.copyGraph({ addTo: t, scale: 1/t.scale.x });
      z.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { z: 3/t.scale.x },
      });
      y.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { y: 3/t.scale.x },
      });
      x.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { x: 3/t.scale.x },
      });
    });
  }

  static get MODE_NONE() { return ''; }
  static get MODE_X() { return 'x'; }
  static get MODE_Y() { return 'y'; }
  static get MODE_Z() { return 'z'; }
  static get MODE_VIEW() { return 'v'; }
}

// TODO: I think this is going to need to run on basis vectors like getWorldTransforms.
class RotateTool extends Tool {
  constructor(editor) {
    super(editor);
    this.targets = null;
    this.startRotate = null;
    this.mode = RotateTool.MODE_NONE;
    this.widget = null;
  }

  start(ptr, target, x, y) {
    this.widget = target;
    this.targets = this.editor.selection;
    this.mode = RotateTool.MODE_NONE;
    if (!this.targets.length || target.layer !== Zoodle.LAYER_UI || !target.color) {
      return;
    }

    this.startRotate = this.targets.map( t => t.rotate.copy() );

    switch (target.color) {
      case rose:
        this.mode = RotateTool.MODE_X;
        break;
      case lime:
        this.mode = RotateTool.MODE_Y;
        break;
      case blueberry:
        this.mode = RotateTool.MODE_Z;
        break;
    }
  }
  move( ptr, target, x, y ) {
    if (!this.mode) { return; }

    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    x /= displaySize / Math.PI * Zdog.TAU;
    y /= displaySize / Math.PI * Zdog.TAU;
    let direction = this.widget.renderNormal;
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x) + TAU/4 );
    this.targets.forEach((t, i) => {
      t.rotate[this.mode] = this.startRotate[i][this.mode] + delta;
    });
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
  // TODO: Let's stash `delta` somewhere so we don't have to recalculate it in end()
  end( ptr, target, x, y ) {
    if (!this.mode) { return; }
    // ensure any final adjustments are applied.
    this.move( ptr, target, x, y );
    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    x /= displaySize * Math.PI * Zdog.TAU;
    y /= displaySize * Math.PI * Zdog.TAU;
    let direction = this.widget.renderNormal;
    let delta = this.editor.getAxisDistance( x, y, Math.atan2(direction.y, direction.x) + TAU/4 );
    let command = new RotateCommand(this.editor, this.targets, new Zdog.Vector({[this.mode]: delta}));
    this.editor.did(command);
  }
  drawWidget(targets) {
    // Create anchors matching selected objects.
    targets = targets.map((target) => {
      return new Zdog.Anchor({
        addTo: this.editor.ui,
        ...this.editor.getWorldTransforms(target),
      });
    });

    const widgetDiameter = 10;
    const widgetStroke = 0.75;

    let origin = new Zdog.Shape({
      stroke: .5,
      color: lace,
    });
    let zRing = new Zdog.Ellipse({
      diameter: widgetDiameter,
      stroke: widgetStroke,
      color: blueberry,
    });
    let yRing = zRing.copyGraph({
      rotate: { x: TAU/4 },
      color: lime,
    });
    let xRing = zRing.copyGraph({
      rotate: { y: TAU/4 },
      color: rose,
    });
    targets.forEach(t => {
      origin.copyGraph({ addTo: t, scale: 1/t.scale.x });
      zRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
      yRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
      xRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
    });
  }

  static get MODE_NONE() { return ''; }
  static get MODE_X() { return 'x'; }
  static get MODE_Y() { return 'y'; }
  static get MODE_Z() { return 'z'; }
}

class Command {
  constructor(editor) {
    this.editor = editor;
  }
  do() {}
  undo() {}
}

class SelectCommand extends Command {
  constructor(editor, target, replace = false) {
    super(editor);
    this.replace = replace;
    this.oldSelection = null;

    // If this is a compositeChild, find its parent
    while (target && target.compositeChild) {
      target = target.addTo;
    }
    // Don't select root elements.
    if (target && !target.addTo) {
      target = null;
    }
    this.target = target;
  }
  do() {
    this.oldSelection = this.editor.selection;
    if (!this.target) {
      this.editor.clearSelection();
    } else if (this.replace) {
      this.editor.setSelection(this.target);
    } else {
      this.editor.toggleSelection(this.target);
    }
    this.refresh();
  }
  undo() {
    this.editor.selection = this.oldSelection;
    this.refresh();
  }
  refresh() {
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
}

class TranslateCommand extends Command {
  constructor(editor, target, delta) {
    super(editor);
    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.delta = delta;
    this.oldTranslate = target.map((t) => t.translate.copy());
  }

  do() {
    if (!this.target) return console.error("Doing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]).add(this.delta);
    });
  }
  undo() {
    if (!this.target) return console.error("Undoing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]);
    });
  }
}

class RotateCommand extends Command {
  // TODO: Add oldTranslate and oldRotate to the constructor, or maybe a flag to tell it if it's getting new or old transforms.
  constructor(editor, target, delta) {
    super(editor);
    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.delta = delta;
    this.oldRotate = target.map((t) => t.rotate.copy());
  }

  do() {
    // TODO: Probably better to just throw in the constructor.
    if (!this.target) return console.error("Doing RotateCommand with no target.");

    this.target.forEach((t, i) => {
      t.rotate.set(this.oldRotate[i]).add(this.delta);
    });
  }
  undo() {
    if (!this.target) return console.error("Undoing RotateCommand with no target.");

    this.target.forEach((t, i) => {
      t.rotate.set(this.oldRotate[i]);
    });
  }
}

class EditCommand extends Command {
  constructor(editor, target, propId, value, oldValue = null) {
    super(editor);
    if (!target) {
      throw new Error("No target specified for EditCommand");
    }

    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.propId = propId;
    this.value = value;
    this.oldValue = oldValue || target.map( (t) => t[propId]);
  }
  do() {
    this.target.forEach( (t) => {
      t[this.propId] = this.value;
    });
  }
  undo() {
    this.target.forEach( (t, i) => {
      t[this.propId] = this.oldValue[i];
    });
  }
}

class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  push(command, newCommand = true) {
    if (newCommand) {
      this.undoStack[this.undoStack.length - 1] = command;
    } else {
      this.undoStack.push(command);
    }

    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) {
      return;
    }

    let command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
  }

  redo() {
    if (this.redoStack.length === 0) {
      return;
    }

    let command = this.redoStack.pop();
    command.do();
    this.undoStack.push(command);
  }
}

class Properties {
  constructor(panel, editor) {
    this.panel = panel;
    this.editor = editor;
    this.header = this.panel.querySelector("h2");
    this.panel.addEventListener("input", this.handleInput.bind(this));
    this.panel.addEventListener("change", this.handleChange.bind(this));
    this.command = null;
  }

  handleInput(event) {
    const propElem = event.target.closest(".prop");
    if (!propElem) return;

    console.log("modifying", propElem.id);

    const oldValue = this.readProperty(propElem.id);
    if (Array.isArray(oldValue)) {
      return;
    }
    const newValue = this.readPanel(propElem);
    // start a new edit command
    if (!this.command) {
      this.command = new EditCommand(this.editor, this.editor.selection, propElem.id, newValue, oldValue);
    } else {
      this.command.value = newValue;
    }
    this.writeProperty(propElem, newValue);
    this.editor.updateUI();
    this.editor.updateHighlights();
  }

  handleChange(event) {
    // as far as I know, change always fires after input.
    this.editor.did(this.command);
    this.command = null;
  }

  // Synchronize the properties panel with the selected objects
  updatePanel() {
    this.updateHeader();
    this.updateBody();
  }

  updateHeader() {
    const selected = this.editor.selection;
    if (selected.length === 0) {
      this.header.textContent = "No objects selected";
    } else if (selected.length > 1) {
      this.header.textContent = `${selected.length} objects selected`;
    } else {
      let breadcrumbs = [];
      let target = selected[0];
      for (let offset = 0; target.addTo; offset++) {
        breadcrumbs.unshift(`<span class="breadcrumb" data-parent-index="${offset}">${target.constructor.type}</span>`);
        target = target.addTo;
      }
      this.header.innerHTML = breadcrumbs.join(" / ");
    }
  }

  updateBody() {
    // Shortcut: Just hide all entries if nothing's selected.
    if (this.editor.selection.length === 0) {
      this.panel.classList.add("hidden");
      return;
    }
    this.panel.classList.remove("hidden");

    // Set properties from first selected object.
    this.updatePanelProps(this.editor.selection[0], true);

    // Merge in properties from the rest of the selected objects.
    for (let i = 1; i < this.editor.selection.length; i++) {
      this.updatePanelProps(this.editor.selection[i]);
    }
  }

  // Hides properties in the panel that are incompatible with the given object.
  // If overwrite is true, it updates the values in the panel from the object.
  // If overwrite is false, it hides properties whose values don't match the object.
  updatePanelProps(srcObj, overwrite = false) {
    let srcProps = srcObj.constructor.optionKeys;
    let destProps = this.panel.querySelectorAll(".prop");
    destProps.forEach( (propElem) => {
      if (!srcProps.includes(propElem.id)) {
        propElem.classList.add("hidden");
        return;
      }
      propElem.classList.remove("hidden");

      if (overwrite) {
        this.updatePanelProp(srcObj, propElem);
        return;
      }

      const objValue = srcObj[propElem.id];
      const panelValue = this.readPanel(propElem);
      // TODO: This won't work for vector types.
      if (panelValue != objValue) {
        propElem.classList.add("hidden");
      }
    });
  }

  // Writes a single property from the object to the properties panel.
  updatePanelProp(srcObj, propElem) {
    const type = this.readType(propElem);

    if (this.isOptional(propElem)) {
      document.getElementById(`${propElem.id}-enabled`).enabled = srcObj[propElem.id] !== false;
    }

    const input = document.getElementById(`${propElem.id}-value`);

    switch (type) {
      case "bool":
        input.checked = srcObj[propElem.id] != false;
        break;
      case "number":
        input.valueAsNumber = srcObj[propElem.id];
        break;
      case "color":
        input.value = this.normalizeColor(srcObj[propElem.id]);
        break;
      case "vector":
        let {x, y, z} = srcObj[propElem.id];
        document.getElementById(`${propElem.id}-x`).value = x;
        document.getElementById(`${propElem.id}-y`).value = y;
        document.getElementById(`${propElem.id}-z`).value = z;
        break;
      default:
        console.warn(`Unknown property type: ${type}`);
    }
  }

  normalizeColor(color) {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      return color;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }

    return "#000000";
  }

  // Read a property from the selected objects.
  // Returns an array if the property differs across the selection.
  readProperty(propId) {
    if (!this.editor.selection.length) {
      return null;
    }

    if (this.editor.selection.length === 1) {
      return this.editor.selection[0][propId];
    }

    let values = this.editor.selection.map( (target) => target[propId]);
    let allEqual = values.every( (val) => val === values[0]);
    if (allEqual) {
      return values[0];
    }
    return values;
  }

  // Write property to the selected objects
  // If value is null, it reads the value from the properties panel.
  writeProperty(propElem, value = null) {
    value = value || this.readPanel(propElem);
    let targets = this.editor.selection;
    targets.forEach( (target) => {
      target[propElem.id] = value;
      // TODO: Add additional type information so we can check if we actually need to do this.
      if (target.updatePath) target.updatePath();
    });
  }

  // Get the type of a property from the properties panel
  readType(propElem) {
    let types = ["vector", "number", "color", "bool"];
    for (let i = 0; i < types.length; i++) {
      if (propElem.classList.contains(types[i])) {
        return types[i];
      }
    }
    return null;
  }

  isOptional(propElem) {
    return propElem.classList.contains("optional");
  }

  isEnabled(propElem) {
    if (!this.isOptional(propElem)) {
      return true;
    }
    return document.getElementById(propElem.id + "-enabled").checked;
  }

  // Read the value of a property from the properties panel
  readPanel(propElem) {
    const type = this.readType(propElem);

    if (!this.isEnabled(propElem)) {
      return false;
    }

    const input = document.getElementById(`${propElem.id}-value`);

    switch (type) {
      case "bool":
        return input.checked;
      case "number":
        return input.valueAsNumber;
      case "color":
        return input.value;
      case "vector":
        return new Zdog.Vector({
          x: document.getElementById(`${propElem.id}-x`).valueAsNumber,
          y: document.getElementById(`${propElem.id}-y`).valueAsNumber,
          z: document.getElementById(`${propElem.id}-z`).valueAsNumber,
        });
      default:
        return null;
    }
  }
}

class Preset {
  load(illo) {}
}

class Solar extends Preset {
  load(illo) {
    let sun = new Zdog.Shape({
      addTo: illo,
      stroke: 10,
      color: gold,
    });

    let arrow = new Zdog.Cone({
      addTo: sun,
      diameter: 1.5,
      length: 1.5,
      stroke: false,
      translate: { y: -7.5 },
      rotate: { x: -TAU / 4 },
      color: orange,
    });

    new Zdog.Cylinder({
      addTo: arrow,
      color: orange,
      stroke: false,
      length: 1,
      diameter: 0.75,
      translate: { z: -.5 },
    });

    new Zdog.Shape({
      addTo: sun,
      stroke: 1,
      translate: { x: 6 },
      color: raisin,
    });

    let orbit = new Zdog.Anchor({
      addTo: sun,
      rotate: { x: TAU / 4 },
    });

    let orbitalProps = {
      stroke: 0.5,
      color: charcoal,
      closed: false,
    };

    let quadrant = new Zdog.Shape({
      addTo: orbit,
      path: [
        { x: 5.8, y: -1.55 },
        { bezier: [
            { x: 5.1, y: -4.17 },
            { x: 2.71, y: -6 },
            { x: 0, y: -6 },
          ]},
      ],
    });

    Zdog.extend(quadrant, orbitalProps);

    quadrant.copy({
      scale: { y: -1 },
    });

    quadrant = new Zdog.Shape({
      addTo: orbit,
      path: [
        { x: 0, y: -6 },
        { arc: [
            { x: -6, y: -6 },
            { x: -6, y: 0 },
          ]},
      ]
    });

    Zdog.extend(quadrant, orbitalProps);

    quadrant.copy({
      scale: { y: -1 },
    });

    let middleOrbit = orbit.copyGraph({
      rotate: { x: TAU / 5, z: TAU / 8 },
      scale: 8/6,
    });

    new Zdog.Shape({
      addTo: middleOrbit,
      stroke: 2,
      translate: { x: 6 },
      color: rose,
    });

    let outerOrbit = orbit.copyGraph({
      rotate: { x: TAU / 3, z: TAU / 4 },
      scale: 10 / 6,
    });

    new Zdog.Shape({
      addTo: outerOrbit,
      stroke: 2,
      translate: { x: 6 },
      color: blueberry,
    });
  }
}

const TAU = Zdog.TAU;

const charcoal = "#333";
const raisin = "#534";
const plum = "#636";
const rose = "#C25";
const orange = "#E62";
const gold = "#EA0";
const lemon = "#ED0";
const peach = "#FDB";
const lace = "#FFF4E8";
const mint = "#CFD";
const lime = "#4A2";
const blueberry = "#359";

const sceneElem = document.querySelector("#canvas");
const overlayElem = document.querySelector("#overlay");
const uiElem = document.querySelector("#ui");
const props = document.querySelector("#properties");
const zoodle = new Zoodle(sceneElem, overlayElem, uiElem, props);