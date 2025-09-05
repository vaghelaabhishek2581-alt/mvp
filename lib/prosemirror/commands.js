import { setBlockType } from 'prosemirror-commands';
import { screenplayElementTypes, screenplaySchema } from './schema.js';

export function setElementType(elementType, attrs = {}) {
  return setBlockType(
    screenplaySchema.nodes.screenplay_element,
    { type: elementType, ...attrs }
  );
}

export const screenplayCommands = {
  setSceneHeading: () => setElementType(screenplayElementTypes.SCENE_HEADING),
  setAction: () => setElementType(screenplayElementTypes.ACTION),
  setCharacter: () => setElementType(screenplayElementTypes.CHARACTER),
  setDialogue: () => setElementType(screenplayElementTypes.DIALOGUE),
  setParenthetical: () => setElementType(screenplayElementTypes.PARENTHETICAL),
  setTransition: () => setElementType(screenplayElementTypes.TRANSITION),
  setShot: () => setElementType(screenplayElementTypes.SHOT),
  setSuper: () => setElementType(screenplayElementTypes.SUPER),
  setDualDialogue: () => setElementType(screenplayElementTypes.DUAL_DIALOGUE, { dual: true })
};