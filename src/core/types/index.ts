// Export shared types and interfaces here
export interface GameObject {
  update?(time: number, delta: number): void;
  destroy?(): void;
}
