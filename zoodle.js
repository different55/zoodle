class Zoodle {
  constructor(sceneElem, overlayElem, uiElem, propElem, outlineElem) {
    // TODO: Calculate appropriate zooms and sizes
    let zoom = 30;
    let rotate = { x: -Math.atan(1 / Math.sqrt(2)), y: Zdog.TAU / 8 };

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

    this.props = new Properties(propElem, this);
    this.outliner = new Outliner(outlineElem, this);

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

    // TODO: Maybe we shouldn't listen to these if they're in an input element
    this.registerShortcut("z", this.history.undo.bind(this.history), true);
    this.registerShortcut("Z", this.history.redo.bind(this.history), true);
    this.registerShortcut("y", this.history.redo.bind(this.history), true);

    this.selection = [this.scene.children[0].children[0]];

    this.props.updatePanel();
    this.outliner.updatePanel();
    this.updateHighlights();
    this.updateUI();
    this.update();
  }

  registerShortcut(key, callback, preventDefault) {
    document.body.addEventListener("keydown", e => {
      if (e.ctrlKey && e.key === key) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback();
      }
    });
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
    this.outliner.updateHighlights();

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

class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  push(command) {
    this.undoStack.push(command);
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

const sceneElem = document.querySelector("#canvas");
const overlayElem = document.querySelector("#overlay");
const uiElem = document.querySelector("#ui");
const propElem = document.querySelector("#properties");
const outlineElem = document.querySelector("#outliner");
const zoodle = new Zoodle(sceneElem, overlayElem, uiElem, propElem, outlineElem);