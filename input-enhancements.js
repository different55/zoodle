class EnhancedInput {
    constructor( input ) {
        this.input = input;
        this.startX = 0;
        this.startY = 0;
        this.startValue = 0;

        this._dragStart = this.dragStart.bind(this);
        this._dragMove = this.dragMove.bind(this);
        this._dragEnd = this.dragEnd.bind(this);

        this.input.addEventListener( "focus", this.enableDrag.bind(this) );
        this.input.addEventListener( "blur", this.disableDrag.bind(this) );
    }
    enableDrag() {
        console.log(this.input + " focused");
        this.input.addEventListener( "pointerdown", this._dragStart );
    }
    disableDrag() {
        console.log(this.input + " blurred");
        this.input.removeEventListener( "pointerdown", this._dragStart );
        this.input.removeEventListener( "pointermove", this._dragMove );
        this.input.removeEventListener( "pointerup", this._dragEnd );
        this.input.removeEventListener( "pointercancel", this._dragEnd );
    }
    dragStart(event) {
        console.log(this.input + " dragging");
        this.startX = event.screenX;
        this.startY = event.screenY;
        this.startValue = this.input.valueAsNumber;

        this.input.setPointerCapture( event.pointerId );
        this.input.addEventListener( "pointermove", this._dragMove );
        this.input.addEventListener( "pointerup", this._dragEnd );
        this.input.addEventListener( "pointercancel", this._dragEnd );
    }
    dragMove(event) {
        const dx = event.screenX - this.startX;
        const dy = event.screenY - this.startY;
        let step = this.input.step ? parseFloat(this.input.step) : 1;
        this.input.valueAsNumber = this.startValue + dy * 0.1 * step;

        // Manually fire input event since updating it programmatically won't.
        const inputEvent = new Event('input', {
            bubbles: true,
            cancelable: true
        });
        this.input.dispatchEvent(inputEvent);
    }
    dragEnd(event) {
        console.log(this.input + " released");
        this.startX = 0;
        this.startY = 0;

        this.input.removeEventListener( "pointermove", this._dragMove );
        this.input.removeEventListener( "pointerup", this._dragEnd );
        this.input.removeEventListener( "pointercancel", this._dragEnd );
    }
}

document.querySelectorAll("input[type='number']").forEach(input => {
    input.enhanced = new EnhancedInput(input);
});