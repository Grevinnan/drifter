export function createParagraph(description: string) {
  let descriptionObj = {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: description,
          },
        ],
      },
    ],
  };
  return descriptionObj;
}

export function parseDescription(description: any) {
  if (!description) {
    return '';
  }
  return description.content
    .map((x: any) => x.content.map((x: any) => x.text).join('\n'))
    .join('\n');
}
