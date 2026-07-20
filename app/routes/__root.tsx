import { createRootRoute, Outlet } from '@tanstack/react-router';
import 'virtual:uno.css';
import '~/assets/css/base.css';
import { useNavIndex } from '~/queries/nav';
import { useBookmarkStore } from '~/stores/bookmarkStore';
import { useThemeStore } from '~/stores/themeStore';

const RootComponent = () => {
  // Warm global caches / mount UI stores once at the app root.
  useThemeStore();
  useBookmarkStore();
  useNavIndex();
  return <Outlet />;
};

const ErrorComponent = ({ error }: { error: Error }) => (
  <main className="mx-auto max-w-2xl px-4 py-16">
    <h1 className="font-display text-2xl font-semibold">出错了</h1>
    <p className="mt-2 text-muted">{error.message}</p>
    {import.meta.env.DEV && error.stack && (
      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel p-4 text-sm">
        <code>{error.stack}</code>
      </pre>
    )}
  </main>
);

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorComponent,
});
