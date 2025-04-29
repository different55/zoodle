class Outliner {
  constructor(panel, editor) {
    this.panel = panel;
    this.editor = editor;
  }

  updatePanel() {
    // Loop over children of scene and populate lists
    const list = document.getElementById( "outliner-list" );
    list.innerHTML = ""; // Clear the list

    const li = this.listify( this.editor.scene );
    if ( li ) {
      list.appendChild( li );
    }
  }

  // Take a Zdog object, produce a list element.
  // if this object has children, this list element has another list nested inside.
  // this function is called recursively.
  listify(obj) {
    if (obj.compositeChild) return null;
    const li = document.createElement( "li" );
    li.setAttribute( "data-type", obj.constructor.type );
    li.obj = obj;
    li.style.setProperty( "--color", obj.color || "#333" );

    const icon = document.createElement( "span" );
    icon.classList.add( "icon" );

    const label = document.createElement( "span" );
    label.classList.add( "name" );

    const name = document.createTextNode( obj.name || obj.constructor.type );

    label.appendChild( icon );
    label.appendChild( name );
    li.appendChild( label );

    label.onclick = () => this.editor.do(new SelectCommand( this.editor, obj, true ));

    let children = obj.children.map( this.listify.bind( this ) );
    children = children.filter( child => child !== null );

    if ( children.length === 0 ) {
      return li;
    }

    const list = document.createElement( "ul" );
    children.forEach( child => {
      list.appendChild( child );
    });
    li.appendChild( list );

    return li;
  }

  updateHighlights() {
    const list = document.getElementById( "outliner-list" );
    const items = list.querySelectorAll( "li" );
    items.forEach( item => {
      if ( this.editor.selection.indexOf( item.obj ) !== -1 ) {
        item.classList.add( "selected" );
      } else {
        item.classList.remove( "selected" );
      }
    });
  }
}