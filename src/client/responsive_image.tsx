import type { DetailedHTMLProps, FC, ImgHTMLAttributes } from "react";
import { createCDN } from "../cdn";

export type ResponsiveImageProps = Omit<
  DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
  "src" | "srcSet" | "alt"
> & {
  alt: string;
  src?: string;
  file?: {
    key: string;
  };
  ratio?: number;
};

const SIZES = [
  64, 128, 256, 320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560, 3840,
] as const;

export const createResponsiveImage = ({
  cdnOrigin,
  defaultProps,
}: {
  cdnOrigin: string | (() => string);
  defaultProps?: Partial<ResponsiveImageProps>;
}): FC<ResponsiveImageProps> => {
  const Component: FC<ResponsiveImageProps> = ({
    alt,
    file,
    ratio,
    ...props
  }) => {
    const cdnOriginValue =
      typeof cdnOrigin === "function" ? cdnOrigin() : cdnOrigin;

    const src = createCDN(cdnOriginValue)(file?.key) || props.src || "#";

    return (
      <img
        {...defaultProps}
        {...props}
        src={src}
        alt={alt}
        srcSet={generateSrcSet(cdnOriginValue, src, ratio, props)}
      />
    );
  };

  return Component;
};

export function ResponsiveImage({
  cdnOrigin,
  ...props
}: ResponsiveImageProps & {
  cdnOrigin: string | (() => string);
}) {
  const Component = createResponsiveImage({ cdnOrigin });

  return <Component {...props} />;
}

const generateSrc = (
  cdnOrigin: string,
  src: string,
  width?: number,
  height?: number,
  ratio?: number,
  image: {
    width?: string | number;
    height?: string | number;
  } = {},
): string => {
  const searchParams = new URLSearchParams();

  if (image.width) {
    searchParams.set("w", image.width.toString());
  }

  if (width) {
    searchParams.set("w", width.toString());

    if (ratio) {
      searchParams.set("h", Math.round(width / ratio).toString());
    }
  }

  if (image.height) {
    searchParams.set("h", image.height.toString());
  }

  if (height) {
    searchParams.set("h", height.toString());
  }

  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

  if (!src.includes(cdnOrigin)) {
    return src;
  }

  return `${encodeURI(decodeURI(src))}${search}`;
};

export function generateSrcSet(
  cdnOrigin: string,
  image: HTMLImageElement | string,
  ratio?: number,
  props: {
    width?: string | number;
    height?: string | number;
  } = {},
  sizes = SIZES,
) {
  const src = typeof image === "string" ? image : image.src;

  const isGif = src.endsWith(".gif");

  if (isGif) {
    return undefined;
  }

  if (props.width) {
    return [1, 2, 3]
      .map((scale) => {
        const genWidth = Number(props.width) * scale;

        return `${generateSrc(
          cdnOrigin,
          src,
          genWidth,
          props.height
            ? Number(props.height) * scale
            : ratio
              ? Math.round(genWidth / ratio)
              : undefined,
        )} ${scale}x`;
      })
      .join(", ");
  }

  return sizes
    .map(
      (size) =>
        `${generateSrc(cdnOrigin, src, size, undefined, ratio, props)} ${size}w`,
    )
    .join(", ");
}
