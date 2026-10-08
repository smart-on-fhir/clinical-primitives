import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
    test: {
        // West of UTC, where a date-only value shown in local time reads a day
        // early. CI runs in UTC, where that bug can't show, so without this no
        // test would catch it.
        env: { TZ: 'America/New_York' }
    }
}));
