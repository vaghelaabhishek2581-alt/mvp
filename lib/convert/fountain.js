import fountain from 'fountain-js';

export function parseFountain(text) {
  const parsed = fountain.parse(text);
  const elements = [];

  for (const token of parsed.tokens) {
    let elementType = 'action';
    let content = token.text || '';

    switch (token.type) {
      case 'scene_heading':
        elementType = 'scene_heading';
        break;
      case 'character':
        elementType = 'character';
        break;
      case 'dialogue':
        elementType = 'dialogue';
        break;
      case 'parenthetical':
        elementType = 'parenthetical';
        break;
      case 'transition':
        elementType = 'transition';
        break;
      case 'shot':
        elementType = 'shot';
        break;
      case 'action':
      default:
        elementType = 'action';
        break;
    }

    elements.push({
      type: elementType,
      content: content.trim(),
      dual: token.dual || false
    });
  }

  return elements;
}

export function exportToFountain(elements) {
  let fountain = '';

  for (const element of elements) {
    switch (element.type) {
      case 'scene_heading':
        fountain += `${element.content.toUpperCase()}\n\n`;
        break;
      case 'character':
        fountain += `${element.content.toUpperCase()}\n`;
        break;
      case 'dialogue':
        fountain += `${element.content}\n\n`;
        break;
      case 'parenthetical':
        fountain += `(${element.content})\n`;
        break;
      case 'transition':
        fountain += `${element.content.toUpperCase()}\n\n`;
        break;
      case 'action':
      default:
        fountain += `${element.content}\n\n`;
        break;
    }
  }

  return fountain;
}