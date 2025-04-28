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
      this.command = new EditCommand(this.editor, this.editor.selection.slice(0), propElem.id, newValue, [oldValue]);
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
    if (value === null) value = this.readPanel(propElem);
    let targets = this.editor.selection;
    targets.forEach( (target) => {
      target[propElem.id] = value;
      // TODO: Add additional type information to props so we can check if we actually need to do this.
      if (t.updatePath) target.updatePath();
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