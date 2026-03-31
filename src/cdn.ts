export type CDN = <T extends string | undefined>(
  key: T,
  options?: { width?: number }
) => T extends undefined ? T : string;

export const createCDN = (origin: string): CDN => {
  return <T extends string | undefined>(
    key: T,
    { width }: { width?: number } = {}
  ): T extends undefined ? T : string => {
    return (
      key ? `${origin}/${key}${width ? `?w=${width}` : ""}` : undefined
    ) as T extends undefined ? T : string;
  };
};
