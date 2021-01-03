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
