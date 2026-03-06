export default function ResponsiveTable({ children, className = "" }) {
  return (
    <div className={`-mx-4 overflow-x-auto sm:mx-0 ${className}`}>
      <div className="inline-block min-w-full align-middle">
        {children}
      </div>
    </div>
  );
}
