import { parseString, Builder } from 'xml2js';

export function parseFDX(xmlString) {
  return new Promise((resolve, reject) => {
    parseString(xmlString, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const elements = [];
      const paragraphs = result?.FinalDraft?.Content?.[0]?.Paragraph || [];

      for (const para of paragraphs) {
        const type = para.$?.Type?.toLowerCase() || 'action';
        const text = para.Text?.[0] || '';

        let elementType = 'action';
        switch (type) {
          case 'scene heading':
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
          default:
            elementType = 'action';
        }

        elements.push({
          type: elementType,
          content: text,
          dual: false
        });
      }

      resolve(elements);
    });
  });
}

export function exportToFDX(elements) {
  const paragraphs = elements.map(element => {
    let type = 'Action';
    switch (element.type) {
      case 'scene_heading':
        type = 'Scene Heading';
        break;
      case 'character':
        type = 'Character';
        break;
      case 'dialogue':
        type = 'Dialogue';
        break;
      case 'parenthetical':
        type = 'Parenthetical';
        break;
      case 'transition':
        type = 'Transition';
        break;
      case 'shot':
        type = 'Shot';
        break;
      default:
        type = 'Action';
    }

    return {
      $: { Type: type },
      Text: [element.content]
    };
  });

  const fdxStructure = {
    FinalDraft: {
      $: {
        DocumentType: 'Script',
        Template: 'No',
        Version: '1'
      },
      Content: [{ Paragraph: paragraphs }]
    }
  };

  const builder = new Builder();
  return builder.buildObject(fdxStructure);
}