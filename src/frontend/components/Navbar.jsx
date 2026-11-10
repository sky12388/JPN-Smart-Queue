import React from 'react';
import { translations } from '../i18n';
import { 
  Smartphone, 
  Tv, 
  UserCheck, 
  BarChart3, 
  Moon, 
  Sun, 
  Globe, 
  Radio, 
  Building2 
} from 'lucide-react';

export default function Navbar({ 
  activeView, 
  setActiveView, 
  lang, 
  setLang, 
  isDark, 
  setIsDark, 
  isConnected 
}) {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Agency Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveView('citizen')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-900 to-indigo-900 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-2 ring-amber-400">
              <span className="font-extrabold text-sm tracking-tighter">JPN</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  SmartQueue JPN
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PoC Pilot
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                {t.agency} • Putrajaya
              </p>
            </div>
          </div>

          {/* Navigation Views Switcher */}
          <nav className="hidden md:flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setActiveView('citizen')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'citizen'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.navCitizen}</span>
            </button>

            <button
              onClick={() => setActiveView('counter')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'counter'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{t.navCounter}</span>
            </button>

            <button
              onClick={() => setActiveView('tv')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'tv'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{t.navTv}</span>
            </button>

            <button
              onClick={() => setActiveView('supervisor')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'supervisor'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{t.navAdmin}</span>
            </button>
          </nav>

          {/* Right Action Controls: Lang & Theme & Connection Status */}
          <div className="flex items-center space-x-2">
            
            {/* Live Connection indicator */}
            <div 
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
                isConnected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
              }`}
              title={isConnected ? 'WebSocket Connected (Sub-second sync)' : 'Reconnecting...'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'SYNC'}</span>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ms' ? 'en' : 'ms')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Tukar Bahasa / Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold">{lang === 'ms' ? 'BM' : 'EN'}</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isDark ? t.themeLight : t.themeDark}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveView('citizen')}
            className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeView === 'citizen' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.navCitizen}
          </button>
          <button
            onClick={() => setActiveView('counter')}
            className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeView === 'counter' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.navCounter}
          </button>
          <button
            onClick={() => setActiveView('tv')}
            className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeView === 'tv' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.navTv}
          </button>
          <button
            onClick={() => setActiveView('supervisor')}
            className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
              activeView === 'supervisor' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.navAdmin}
          </button>
        </div>

      </div>
    </header>
  );
}
