import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { screenplayCommands } from './commands.js';

export const screenplayKeymap = keymap({
  ...baseKeymap,
  'Alt-h': screenplayCommands.setSceneHeading(),
  'Alt-a': screenplayCommands.setAction(),
  'Alt-c': screenplayCommands.setCharacter(),
  'Alt-d': screenplayCommands.setDualDialogue(),
  'Alt-s': screenplayCommands.setShot(),
  'Alt-u': screenplayCommands.setSuper(),
  'Alt-t': screenplayCommands.setTransition(),
  'Enter': (state, dispatch) => {
    // Auto-format based on current element type
    const { $head } = state.selection;
    const currentElement = $head.node();
    
    if (currentElement && currentElement.attrs.type === 'character') {
      // After character, switch to dialogue
      return screenplayCommands.setDialogue()(state, dispatch);
    } else if (currentElement && currentElement.attrs.type === 'dialogue') {
      // After dialogue, switch to action
      return screenplayCommands.setAction()(state, dispatch);
    }
    
    return false;
  }
});