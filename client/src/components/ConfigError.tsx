/** Full-page message shown instead of the app when it was built without an API address. */
export function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <h1 className="heading text-xl text-ink">App is misconfigured</h1>
        <p className="mt-3 text-sm text-slateink">
          VITE_API_URL is not set, so this build doesn&apos;t know where the server is. The site owner needs to set it and
          rebuild.
        </p>
      </div>
    </div>
  );
}
