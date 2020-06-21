export default interface IResourceWorker {
  getResource(pathParts: string[]): Promise<any>;
  saveResource(pathParts: string[], data: string): Promise<boolean>;
}
