import { useState } from 'react';
import { COLLECTIBLES, THEMES, ALL_COLLECTIBLE_IDS } from '../config/collectibles';

interface Props {
  owned: Set<string>;
}

/**
 * Shows all 100 collectibles grouped by theme.
 * Unlocked: full emoji + name. Locked: "?" silhouette.
 * Completed themes get a badge. Rare themes have a gold border.
 */
export default function CollectiblesGrid({ owned }: Props) {
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const totalOwned = owned.size;
  const total = ALL_COLLECTIBLE_IDS.length;

  const completedThemes = THEMES.filter((t) => t.ids.every((id) => owned.has(id)));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Collectibles</h2>
        <span className="text-xs font-medium text-orange-500">{totalOwned} / {total}</span>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-700"
          style={{ width: `${(totalOwned / total) * 100}%` }}
        />
      </div>

      {/* Completed theme badges */}
      {completedThemes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {completedThemes.map((t) => (
            <span
              key={t.key}
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                t.rarity === 'rare'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-400'
                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
              }`}
            >
              ✓ {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Theme filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setActiveTheme(null)}
          className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            activeTheme === null
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          All
        </button>
        {THEMES.map((t) => {
          const themeOwned = t.ids.filter((id) => owned.has(id)).length;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTheme(t.key === activeTheme ? null : t.key)}
              className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                activeTheme === t.key
                  ? t.rarity === 'rare'
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {t.label.split(' ')[0]} {themeOwned}/10
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {(activeTheme ? THEMES.filter((t) => t.key === activeTheme) : THEMES).map((theme) => {
        const themeOwned = theme.ids.filter((id) => owned.has(id)).length;
        const isComplete = themeOwned === 10;

        return (
          <div key={theme.key}>
            {/* Theme header */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${
                theme.rarity === 'rare' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {theme.label}
                {isComplete && <span className="ml-1.5 text-green-500">✓ Complete!</span>}
              </span>
              <span className="text-xs text-gray-400">{themeOwned}/10</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {theme.ids.map((id) => {
                const def = COLLECTIBLES[id];
                const isOwned = owned.has(id);
                const isRare = theme.rarity === 'rare';

                return (
                  <div
                    key={id}
                    title={isOwned ? def?.name : '???'}
                    className={[
                      'flex flex-col items-center justify-center rounded-xl p-1.5 aspect-square transition-all',
                      isOwned
                        ? isRare
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600'
                          : 'bg-orange-50 dark:bg-gray-700 border border-orange-200 dark:border-gray-600'
                        : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-40',
                    ].join(' ')}
                  >
                    {isOwned ? (
                      <>
                        <span className="text-xl leading-none">{def?.emoji}</span>
                        <span className="text-[9px] text-center text-gray-600 dark:text-gray-300 mt-0.5 leading-tight line-clamp-1 w-full text-center">
                          {def?.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg text-gray-300 dark:text-gray-600">?</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {totalOwned === 0 && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-1">
          Spin the wheel to discover collectibles!
        </p>
      )}
    </div>
  );
}
