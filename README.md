# Zoodle

*A round, flat, designer-friendly pseudo-3D editor for Zdog*

## Status

Currently under active development.

https://github.com/user-attachments/assets/35aab4f8-db0d-4ed8-adf6-0dbd22ef859e

## About Zoodle

Zoodle is a live WYSIWYG editor for Zdog, the round, flat, designer-friendly
pseudo-3D engine concocted by [desandro](https://github.com/desandro/). I think
Zdog's pretty nifty, that SVGs are cool technology, and want others to be able
to play with them more. And I thought it looked like a good brain-bending exercise.

## Current state

Currently, most of the work has gone into the infrastructure and scaffolding.
A new input handling library, [Zfetch](https://github.com/different55/zfetch),
has been written that is Zdog-aware and allows clicks and drags to detect where
they are in Zdog-space.

Objects can be clicked on to be added or removed from the current selection.
Zoodle supports having multiple tools that can draw widgets based on the
selection, and will properly transform those widgets into the object's local
space. Given Zdog's pleasant simplicitly and (usually) blessed lack of anything
like Quaternions or Matrices, this was A Chore. But hey, it's theoretically all
downhill from here.

## Acknowledgements

Zoodle depends on a few
[pre-existing patches](https://github.com/metafizzy/zdog/pull/63) to Zdog
itself to allow scene state to be saved and loaded as JSON. Huge thanks go to
@natemoo-re for developing these, and to @desandro for creating Zdog in the
first place!
