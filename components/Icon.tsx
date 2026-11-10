type IconProps = {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
};

/** Material Symbols Outlined, loaded once in the root layout. */
export function Icon({ name, size = 20, fill = false, className = "" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined shrink-0 ${className}`}
      data-fill={fill ? "1" : "0"}
      style={{ fontSize: `${size}px` }}
    >
      {name}
    </span>
  );
}
