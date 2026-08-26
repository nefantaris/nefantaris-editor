import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { Link } from "wouter";
import { preloadRoute } from "../routes";

type PreloadLinkProps = Omit<ComponentProps<"a">, "className" | "href"> & {
  href: string;
  className?: string | ((isActive: boolean) => string | undefined);
  replace?: boolean;
  state?: unknown;
};

const PreloadLink = (props: PreloadLinkProps) => {
  const handleIntent = () => {
    preloadRoute(props.href);
  };

  return (
    <Link
      {...props}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        handleIntent();
        props.onMouseEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        handleIntent();
        props.onFocus?.(event);
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        handleIntent();
        props.onTouchStart?.(event);
      }}
    />
  );
};

export default PreloadLink;
