import { Schema } from 'prosemirror-model';

export const screenplaySchema = new Schema({
  nodes: {
    doc: {
      content: 'page+'
    },
    page: {
      content: 'screenplay_element*',
      attrs: {
        pageNumber: { default: 1 }
      },
      parseDOM: [{ tag: 'div.page' }],
      toDOM: (node) => ['div', { class: 'page', 'data-page': node.attrs.pageNumber }, 0]
    },
    screenplay_element: {
      content: 'text*',
      attrs: {
        type: { default: 'action' }, // action, scene_heading, character, dialogue, parenthetical, transition, shot, super, dual_dialogue
        characterName: { default: null },
        dual: { default: false }
      },
      parseDOM: [
        {
          tag: 'div.screenplay-element',
          getAttrs: (dom) => ({
            type: dom.getAttribute('data-type') || 'action',
            characterName: dom.getAttribute('data-character'),
            dual: dom.hasAttribute('data-dual')
          })
        }
      ],
      toDOM: (node) => {
        const attrs = {
          class: `screenplay-element element-${node.attrs.type}`,
          'data-type': node.attrs.type
        };
        if (node.attrs.characterName) {
          attrs['data-character'] = node.attrs.characterName;
        }
        if (node.attrs.dual) {
          attrs['data-dual'] = 'true';
        }
        return ['div', attrs, 0];
      }
    },
    text: {
      inline: true
    }
  },
  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0]
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0]
    },
    underline: {
      parseDOM: [{ tag: 'u' }],
      toDOM: () => ['u', 0]
    }
  }
});

export const screenplayElementTypes = {
  SCENE_HEADING: 'scene_heading',
  ACTION: 'action',
  CHARACTER: 'character',
  DIALOGUE: 'dialogue',
  PARENTHETICAL: 'parenthetical',
  TRANSITION: 'transition',
  SHOT: 'shot',
  SUPER: 'super',
  DUAL_DIALOGUE: 'dual_dialogue'
};

export const elementFormatting = {
  [screenplayElementTypes.SCENE_HEADING]: {
    marginLeft: 0,
    marginTop: 24,
    marginBottom: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  [screenplayElementTypes.ACTION]: {
    marginLeft: 0,
    marginTop: 12,
    marginBottom: 12
  },
  [screenplayElementTypes.CHARACTER]: {
    marginLeft: 220,
    marginTop: 24,
    marginBottom: 0,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  [screenplayElementTypes.DIALOGUE]: {
    marginLeft: 100,
    marginRight: 150,
    marginTop: 0,
    marginBottom: 12
  },
  [screenplayElementTypes.PARENTHETICAL]: {
    marginLeft: 160,
    marginRight: 200,
    marginTop: 0,
    marginBottom: 0,
    fontStyle: 'italic'
  },
  [screenplayElementTypes.TRANSITION]: {
    marginLeft: 400,
    marginTop: 24,
    marginBottom: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  [screenplayElementTypes.SHOT]: {
    marginLeft: 0,
    marginTop: 12,
    marginBottom: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  [screenplayElementTypes.SUPER]: {
    marginLeft: 0,
    marginTop: 12,
    marginBottom: 12,
    fontWeight: 'bold'
  },
  [screenplayElementTypes.DUAL_DIALOGUE]: {
    width: '50%',
    float: 'left',
    marginLeft: 100,
    marginRight: 50
  }
};