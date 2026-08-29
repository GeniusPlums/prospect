export function collectRoutePathsFromTree(_tree: unknown): string[] {
  return ["/", "/searches", "/rules", "/inbox", "/ats", "/evals", "/dashboard", "/settings"];
}

export function installPreviewHostBridge(_opts: {
  navigate: (path: string) => void;
  getRoutePaths: () => string[];
}): () => void {
  return () => undefined;
}
