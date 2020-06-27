import * as fs from 'fs';
import * as path from 'path';

export function getAllFiles(dirPath: string, allFiles: string[]) {
  let files = fs.readdirSync(dirPath);

  for (let file of files) {
    let filePath = path.join(dirPath, file);
    allFiles.push(filePath);
    if (fs.statSync(filePath).isDirectory()) {
      allFiles = getAllFiles(filePath, allFiles);
    }
  }

  return allFiles;
}

export function getTotalSize(directoryPath: string) {
  const baseFileList = [directoryPath];
  const allFiles = getAllFiles(directoryPath, baseFileList);

  return allFiles.reduce(
    (totalSize, filePath) => fs.statSync(filePath).size + totalSize,
    0
  );
}
