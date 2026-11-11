import type { CSSProperties, ImgHTMLAttributes } from "react";

type IconProps = ImgHTMLAttributes<HTMLImageElement> & { color?: string };

function CategoryImg(props: IconProps & { src: string }) {
  const { color: _color, className, style, ...rest } = props;
  const fill: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    ...(style ?? {}),
  };
  return (
    <img
      {...rest}
      src={props.src}
      alt=""
      draggable={false}
      className={className || "w-full h-full"}
      style={fill}
    />
  );
}

export function TruckIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/truck-category.png" />;
}

export function LoadsIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/load-category.png" />;
}

export function JobsIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/job-category.png" />;
}

export function WorkshopIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/workshop-category.png" />;
}

export function SparePartsIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/spareparts-category.png" />;
}

export function FinanceIcon(props: IconProps) {
  return <CategoryImg {...props} src="/category-icons/finance-category.png" />;
}