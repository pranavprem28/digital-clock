"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  ChevronDown,
  Clock3,
  Globe2,
  Moon,
  Sun,
  TimerReset,
  Trash2,
} from "lucide-react";

type Tab = "clock" | "alarm" | "stopwatch" | "world";
type Theme = "dark" | "light";

type AlarmItem = {
  id: string;
  time: string;
  enabled: boolean;
  triggeredAt?: string;
};

type Lap = {
  id: string;
  value: number;
};

type WorldClockItem = {
  id: string;
  city: string;
  timezone: string;
  locale: string;
};

const STORAGE_KEY = "clock-app-alarms";
const THEME_KEY = "clock-app-theme";
const WORLD_CLOCK_KEY = "clock-app-world-clocks";

const defaultWorldClocks: WorldClockItem[] = [
  { id: "kolkata", city: "Kolkata", timezone: "Asia/Kolkata", locale: "en-IN" },
  { id: "london", city: "London", timezone: "Europe/London", locale: "en-GB" },
  { id: "newyork", city: "New York", timezone: "America/New_York", locale: "en-US" },
  { id: "dubai", city: "Dubai", timezone: "Asia/Dubai", locale: "en-AE" },
];

const timezoneOptions = [
  { city: "Kolkata", timezone: "Asia/Kolkata", locale: "en-IN" },
  { city: "Dubai", timezone: "Asia/Dubai", locale: "en-AE" },
  { city: "London", timezone: "Europe/London", locale: "en-GB" },
  { city: "Paris", timezone: "Europe/Paris", locale: "fr-FR" },
  { city: "Berlin", timezone: "Europe/Berlin", locale: "de-DE" },
  { city: "New York", timezone: "America/New_York", locale: "en-US" },
  { city: "Los Angeles", timezone: "America/Los_Angeles", locale: "en-US" },
  { city: "Toronto", timezone: "America/Toronto", locale: "en-CA" },
  { city: "Tokyo", timezone: "Asia/Tokyo", locale: "ja-JP" },
  { city: "Singapore", timezone: "Asia/Singapore", locale: "en-SG" },
  { city: "Sydney", timezone: "Australia/Sydney", locale: "en-AU" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatClockTime = (date: Date, is24Hour: boolean) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  if (is24Hour) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;
  return `${pad(twelveHour)}:${pad(minutes)}:${pad(seconds)} ${period}`;
};

const formatDate = (date: Date, locale?: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

const formatStopwatch = (ms: number) => {
  const totalMilliseconds = Math.max(0, ms);
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);

  return `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
};

const formatWorldTime = (
  date: Date,
  timezone: string,
  is24Hour: boolean,
  locale: string
) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !is24Hour,
  }).format(date);

const formatWorldDate = (date: Date, timezone: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

const getTimezoneOffsetLabel = (timezone: string, date: Date) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(date);

    return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
};

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("clock");
  const [theme, setTheme] = useState<Theme>("dark");
  const [is24Hour, setIs24Hour] = useState(true);
  const [now, setNow] = useState<Date | null>(null);

  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [alarmInput, setAlarmInput] = useState("07:00");
  const [ringingAlarmId, setRingingAlarmId] = useState<string | null>(null);

  const [selectedTimezone, setSelectedTimezone] = useState(timezoneOptions[0].timezone);
  const [worldClocks, setWorldClocks] = useState<WorldClockItem[]>(defaultWorldClocks);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);

  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setMounted(true);

    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    const storedAlarms = localStorage.getItem(STORAGE_KEY);
    if (storedAlarms) {
      try {
        setAlarms(JSON.parse(storedAlarms) as AlarmItem[]);
      } catch {
        setAlarms([]);
      }
    }

    const storedWorldClocks = localStorage.getItem(WORLD_CLOCK_KEY);
    if (storedWorldClocks) {
      try {
        const parsed = JSON.parse(storedWorldClocks) as WorldClockItem[];
        if (parsed.length > 0) {
          setWorldClocks(parsed);
        }
      } catch {
        setWorldClocks(defaultWorldClocks);
      }
    }

    setNow(new Date());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  }, [alarms, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(WORLD_CLOCK_KEY, JSON.stringify(worldClocks));
  }, [worldClocks, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [mounted]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = () => {
      setDropdownOpen(false);
    };

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!now) return;

    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const currentDateKey = now.toDateString();

    const matchedAlarm = alarms.find(
      (alarm) =>
        alarm.enabled &&
        alarm.time === currentTime &&
        alarm.triggeredAt !== currentDateKey
    );

    if (matchedAlarm) {
      setRingingAlarmId(matchedAlarm.id);
      setAlarms((prev) =>
        prev.map((alarm) =>
          alarm.id === matchedAlarm.id
            ? { ...alarm, triggeredAt: currentDateKey }
            : alarm
        )
      );
      playBeepPattern();
      setTab("alarm");
    }
  }, [now, alarms]);

  useEffect(() => {
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning]);

  const playBeepPattern = async () => {
    if (typeof window === "undefined") return;

    try {
      if (!audioContextRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const audioContext = audioContextRef.current;
      await audioContext.resume();

      const nowTime = audioContext.currentTime;
      for (let i = 0; i < 3; i += 1) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, nowTime + i * 0.35);
        gainNode.gain.setValueAtTime(0.0001, nowTime + i * 0.35);
        gainNode.gain.exponentialRampToValueAtTime(0.2, nowTime + i * 0.35 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, nowTime + i * 0.35 + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(nowTime + i * 0.35);
        oscillator.stop(nowTime + i * 0.35 + 0.22);
      }
    } catch {
      // ignore
    }
  };

  const stopAlarm = () => {
    setRingingAlarmId(null);
  };

  const addAlarm = () => {
    if (!alarmInput) return;

    const newAlarm: AlarmItem = {
      id: createId(),
      time: alarmInput,
      enabled: true,
    };

    setAlarms((prev) => [...prev, newAlarm].sort((a, b) => a.time.localeCompare(b.time)));
    setTab("alarm");
  };

  const toggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
      )
    );
  };

  const deleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((alarm) => alarm.id !== id));
    if (ringingAlarmId === id) {
      setRingingAlarmId(null);
    }
  };

  const startStopwatch = () => {
    if (isRunning) return;
    startTimeRef.current = Date.now() - elapsedMs;
    setIsRunning(true);
  };

  const pauseStopwatch = () => {
    setIsRunning(false);
  };

  const resetStopwatch = () => {
    setIsRunning(false);
    setElapsedMs(0);
    setLaps([]);
    startTimeRef.current = null;
  };

  const addLap = () => {
    if (elapsedMs === 0) return;
    setLaps((prev) => [{ id: createId(), value: elapsedMs }, ...prev]);
  };

  const addWorldClock = () => {
    const selected = timezoneOptions.find((item) => item.timezone === selectedTimezone);
    if (!selected) return;

    const exists = worldClocks.some((clock) => clock.timezone === selected.timezone);
    if (exists) {
      setDropdownOpen(false);
      return;
    }

    setWorldClocks((prev) => [...prev, { ...selected, id: createId() }]);
    setDropdownOpen(false);
  };

  const removeWorldClock = (id: string) => {
    setWorldClocks((prev) => prev.filter((clock) => clock.id !== id));
  };

  const selectedTimezoneLabel =
    timezoneOptions.find((option) => option.timezone === selectedTimezone);

  const clockDisplay = useMemo(() => {
    if (!now) return "--:--:--";
    return formatClockTime(now, is24Hour);
  }, [now, is24Hour]);

  const dateDisplay = useMemo(() => {
    if (!now) return "Loading date...";
    return formatDate(now, undefined);
  }, [now]);

  const themeClasses =
    theme === "dark"
      ? {
          page:
            "bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.25),transparent_40%),linear-gradient(135deg,#020617,#020617,#0f172a)] text-white",
          card:
            "bg-white/5 border border-white/10 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]",
          muted: "text-white/60",
          soft:
            "bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl transition-all duration-300",
          active:
            "bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)]",
          clockGlow:
            "text-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.9)]",
          buttonPrimary:
            "border border-cyan-400/30 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25",
          buttonDanger:
            "border border-rose-400/30 bg-rose-400/15 text-rose-200 hover:bg-rose-400/25",
          buttonWarn:
            "border border-amber-400/30 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25",
          buttonSuccess:
            "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25",
          input:
            "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:ring-cyan-400/40",
          dropdown:
            "absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-900 shadow-xl backdrop-blur-xl",
          dropdownItem:
            "block w-full px-4 py-3 text-left text-sm text-white transition hover:bg-cyan-500/20",
          dropdownItemActive: "bg-cyan-500/15 text-cyan-300",
        }
      : {
          page:
            "bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_40%),linear-gradient(135deg,#f8fafc,#e2e8f0,#cbd5f5)] text-slate-900",
          card:
            "bg-white/70 border border-white/50 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)]",
          muted: "text-slate-600",
          soft:
            "bg-white/70 hover:bg-white border border-slate-200 backdrop-blur-xl transition-all duration-300",
          active:
            "bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-300 text-blue-700",
          clockGlow:
            "text-blue-700 drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]",
          buttonPrimary:
            "border border-sky-300 bg-sky-100 text-sky-700 hover:bg-sky-200",
          buttonDanger:
            "border border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200",
          buttonWarn:
            "border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200",
          buttonSuccess:
            "border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
          input:
            "border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:ring-sky-300",
          dropdown:
            "absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl backdrop-blur-xl",
          dropdownItem:
            "block w-full px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-sky-100",
          dropdownItemActive: "bg-sky-100 text-sky-700",
        };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
          <div className="text-lg font-medium tracking-wide text-white/70">
            Loading dashboard...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen transition-all duration-500 ${themeClasses.page}`}>
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4 sm:p-6">
        <div className={`w-full max-w-5xl rounded-[32px] ${themeClasses.card}`}>
          <div className="flex flex-col gap-6 p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm uppercase tracking-[0.35em] ${themeClasses.muted}`}>
                  Smart Clock Dashboard
                </p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                  Digital Clock, Alarm, Stopwatch & World Time
                </h1>
              </div>

              <button
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition hover:scale-[1.02] ${themeClasses.soft}`}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: "clock", label: "Clock", icon: Clock3 },
                { key: "alarm", label: "Alarm", icon: AlarmClock },
                { key: "stopwatch", label: "Stopwatch", icon: TimerReset },
                { key: "world", label: "World Clock", icon: Globe2 },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.key;

                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key as Tab)}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-medium transition hover:scale-[1.02] ${
                      isActive ? themeClasses.active : themeClasses.soft
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <section className={`rounded-[28px] p-5 sm:p-8 ${themeClasses.soft}`}>
              {tab === "clock" && (
                <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                  <p className={`mb-3 text-sm uppercase tracking-[0.3em] ${themeClasses.muted}`}>
                    Current Time
                  </p>

                  <div
                    className={`text-6xl font-extrabold tracking-[0.18em] sm:text-8xl md:text-[6.5rem] ${themeClasses.clockGlow}`}
                  >
                    {clockDisplay}
                  </div>

                  <p className={`mt-5 text-base sm:text-lg ${themeClasses.muted}`}>
                    {dateDisplay}
                  </p>

                  <button
                    onClick={() => setIs24Hour((prev) => !prev)}
                    className={`mt-8 rounded-2xl px-5 py-3 text-sm font-medium transition hover:scale-[1.02] ${themeClasses.soft}`}
                  >
                    Switch to {is24Hour ? "12-hour" : "24-hour"} format
                  </button>
                </div>
              )}

              {tab === "alarm" && (
                <div className="grid min-h-[430px] gap-6 lg:grid-cols-[320px_1fr]">
                  <div className={`rounded-[24px] p-5 ${themeClasses.card}`}>
                    <h2 className="text-xl font-semibold">Set Alarm</h2>
                    <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                      Create multiple alarms and enable or disable them anytime.
                    </p>

                    <div className="mt-6 space-y-4">
                      <input
                        type="time"
                        value={alarmInput}
                        onChange={(e) => setAlarmInput(e.target.value)}
                        className={`w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 ${themeClasses.input}`}
                      />

                      <button
                        onClick={addAlarm}
                        className={`w-full rounded-2xl px-4 py-3 font-medium transition hover:scale-[1.01] ${themeClasses.buttonPrimary}`}
                      >
                        Add Alarm
                      </button>

                      {ringingAlarmId && (
                        <div className={`rounded-2xl p-4 ${themeClasses.buttonDanger}`}>
                          <p className="font-semibold">Alarm is ringing</p>
                          <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                            Your scheduled time has been reached.
                          </p>
                          <button
                            onClick={stopAlarm}
                            className={`mt-3 rounded-xl px-4 py-2 text-sm font-medium transition ${themeClasses.soft}`}
                          >
                            Stop Alarm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`rounded-[24px] p-5 ${themeClasses.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">Saved Alarms</h2>
                      <span className={`text-sm ${themeClasses.muted}`}>
                        {alarms.length} total
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {alarms.length === 0 ? (
                        <div
                          className={`rounded-2xl border border-dashed p-8 text-center ${themeClasses.muted}`}
                        >
                          No alarms added yet.
                        </div>
                      ) : (
                        alarms.map((alarm) => {
                          const isRinging = ringingAlarmId === alarm.id;

                          return (
                            <div
                              key={alarm.id}
                              className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                isRinging
                                  ? "border-rose-400/30 bg-rose-400/10"
                                  : "border-white/10"
                              }`}
                            >
                              <div>
                                <p className="text-2xl font-bold tracking-[0.15em]">
                                  {alarm.time}
                                </p>
                                <p className={`text-sm ${themeClasses.muted}`}>
                                  {alarm.enabled ? "Enabled" : "Disabled"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleAlarm(alarm.id)}
                                  className={`rounded-xl px-4 py-2 text-sm font-medium transition hover:scale-[1.02] ${themeClasses.soft}`}
                                >
                                  {alarm.enabled ? "Turn Off" : "Turn On"}
                                </button>

                                <button
                                  onClick={() => deleteAlarm(alarm.id)}
                                  className={`rounded-xl px-3 py-2 transition hover:scale-[1.02] ${themeClasses.buttonDanger}`}
                                  aria-label="Delete alarm"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "stopwatch" && (
                <div className="grid min-h-[430px] gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div
                    className={`flex flex-col items-center justify-center rounded-[24px] p-5 text-center ${themeClasses.card}`}
                  >
                    <p className={`mb-3 text-sm uppercase tracking-[0.3em] ${themeClasses.muted}`}>
                      Stopwatch
                    </p>

                    <div
                      className={`text-5xl font-black tracking-[0.15em] sm:text-7xl ${themeClasses.clockGlow}`}
                    >
                      {formatStopwatch(elapsedMs)}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      {!isRunning ? (
                        <button
                          onClick={startStopwatch}
                          className={`rounded-2xl px-5 py-3 font-medium transition hover:scale-[1.02] ${themeClasses.buttonSuccess}`}
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={pauseStopwatch}
                          className={`rounded-2xl px-5 py-3 font-medium transition hover:scale-[1.02] ${themeClasses.buttonWarn}`}
                        >
                          Pause
                        </button>
                      )}

                      <button
                        onClick={addLap}
                        className={`rounded-2xl px-5 py-3 font-medium transition hover:scale-[1.02] ${themeClasses.soft}`}
                      >
                        Lap
                      </button>

                      <button
                        onClick={resetStopwatch}
                        className={`rounded-2xl px-5 py-3 font-medium transition hover:scale-[1.02] ${themeClasses.buttonDanger}`}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-[24px] p-5 ${themeClasses.card}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Lap Times</h2>
                      <span className={`text-sm ${themeClasses.muted}`}>{laps.length} laps</span>
                    </div>

                    <div className="mt-5 max-h-[300px] space-y-3 overflow-auto pr-1">
                      {laps.length === 0 ? (
                        <div
                          className={`rounded-2xl border border-dashed p-8 text-center ${themeClasses.muted}`}
                        >
                          No laps recorded yet.
                        </div>
                      ) : (
                        laps.map((lap, index) => (
                          <div
                            key={lap.id}
                            className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                          >
                            <span className="font-medium">Lap {laps.length - index}</span>
                            <span className="font-mono text-lg">
                              {formatStopwatch(lap.value)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "world" && now && (
                <div className="grid min-h-[430px] gap-6 lg:grid-cols-[320px_1fr]">
                  <div className={`rounded-[24px] p-5 ${themeClasses.card}`}>
                    <h2 className="text-xl font-semibold">Add Timezone</h2>
                    <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                      Build your own world clock dashboard with major cities.
                    </p>

                    <div className="mt-6 space-y-4">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen((prev) => !prev);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left outline-none focus:ring-2 ${themeClasses.input}`}
                        >
                          <span className="truncate">
                            {selectedTimezoneLabel?.city} — {selectedTimezone}
                          </span>
                          <ChevronDown
                            size={18}
                            className={`ml-3 shrink-0 transition-transform duration-200 ${
                              dropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {dropdownOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={themeClasses.dropdown}
                          >
                            {timezoneOptions.map((option) => (
                              <button
                                key={option.timezone}
                                type="button"
                                onClick={() => {
                                  setSelectedTimezone(option.timezone);
                                  setDropdownOpen(false);
                                }}
                                className={`${themeClasses.dropdownItem} ${
                                  selectedTimezone === option.timezone
                                    ? themeClasses.dropdownItemActive
                                    : ""
                                }`}
                              >
                                {option.city} — {option.timezone}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={addWorldClock}
                        className={`w-full rounded-2xl px-4 py-3 font-medium transition hover:scale-[1.01] ${themeClasses.buttonPrimary}`}
                      >
                        Add to World Clock
                      </button>

                      <div className={`rounded-2xl p-4 ${themeClasses.soft}`}>
                        <p className="text-sm font-medium">Format</p>
                        <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                          Currently showing {is24Hour ? "24-hour" : "12-hour"} time across
                          all cities.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[24px] p-5 ${themeClasses.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">World Clock</h2>
                      <span className={`text-sm ${themeClasses.muted}`}>
                        {worldClocks.length} cities
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {worldClocks.map((clock) => (
                        <div
                          key={clock.id}
                          className="rounded-[22px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold">{clock.city}</p>
                              <p className={`mt-1 text-xs ${themeClasses.muted}`}>
                                {clock.timezone}
                              </p>
                            </div>

                            <button
                              onClick={() => removeWorldClock(clock.id)}
                              className={`rounded-xl px-3 py-2 transition ${themeClasses.buttonDanger}`}
                              aria-label={`Remove ${clock.city}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div
                            className={`mt-6 text-3xl font-bold tracking-[0.12em] ${themeClasses.clockGlow}`}
                          >
                            {formatWorldTime(now, clock.timezone, is24Hour, clock.locale)}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <p className={`text-sm ${themeClasses.muted}`}>
                              {formatWorldDate(now, clock.timezone, clock.locale)}
                            </p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs ${themeClasses.soft}`}
                            >
                              {getTimezoneOffsetLabel(clock.timezone, now)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}