export function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-md border border-line" />
          <div className="absolute inset-0 rounded-md border border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-2xs uppercase tracking-wider text-fg-muted font-medium">Загрузка</p>
      </div>
    </div>
  )
}
