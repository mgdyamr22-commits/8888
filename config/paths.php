<?php
/**
 * Path Definitions and Storage Directories
 */

declare(strict_types=1);

namespace Almakhzoun\Config;

class Paths
{
    public static function root(): string
    {
        return dirname(__DIR__);
    }

    public static function storage(): string
    {
        return self::root() . '/storage';
    }

    public static function uploads(): string
    {
        return self::storage() . '/uploads';
    }

    public static function documents(): string
    {
        return self::storage() . '/documents';
    }

    public static function backups(): string
    {
        return self::storage() . '/backups';
    }

    public static function logs(): string
    {
        return self::storage() . '/logs';
    }

    public static function ensureDirectories(): void
    {
        $dirs = [
            self::storage(),
            self::uploads(),
            self::documents(),
            self::backups(),
            self::logs(),
            self::storage() . '/framework',
            self::root() . '/config'
        ];

        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
        }
    }
}
