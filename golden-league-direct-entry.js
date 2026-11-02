/* Direct Andalus Golden League entry.
   Clicking the student-portal league tile opens the full leaderboard page directly. */
(function () {
  'use strict';

  function install() {
    if (window.__andalusDirectGoldenLeagueEntryInstalled) return true;
    if (typeof window.openGoldenLeagueFullPage !== 'function') return false;

    window.goToPortalWeeklyQuiz = function () {
      window.openGoldenLeagueFullPage('board');
    };

    window.__andalusDirectGoldenLeagueEntryInstalled = true;
    return true;
  }

  let tries = 0;
  const timer = setInterval(function () {
    if (install() || ++tries >= 40) clearInterval(timer);
  }, 250);
  install();
})();
