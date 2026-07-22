export interface MarkdownFileStore {
  exists(path: string): Promise<boolean>;
  writeNew(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  list(prefix: string): Promise<string[]>;
  move(source: string, destination: string): Promise<void>;
}
