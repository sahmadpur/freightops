export function PageHeader({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      {action}
    </div>
  );
}
