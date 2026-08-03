import { Moon, Sun } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { usePreferencesStore } from '~/stores/preferencesStore';

const ThemeToggle = () => {
  const { theme, toggleTheme } = usePreferencesStore();
  return (
    <Button
      variant="icon"
      aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      onClick={toggleTheme}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </Button>
  );
};
export default ThemeToggle;
