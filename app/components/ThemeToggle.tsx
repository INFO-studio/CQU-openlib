import { Moon, Sun } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useThemeStore } from '~/stores/themeStore';

const ThemeToggle = () => {
  const { theme, toggle } = useThemeStore();
  return (
    <Button
      variant="icon"
      aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      onClick={toggle}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </Button>
  );
};
export default ThemeToggle;
