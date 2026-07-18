export interface PersistentStorageAdapter<TData> {
  load(): Promise<TData | null>;
  save(data: TData): Promise<void>;
}
