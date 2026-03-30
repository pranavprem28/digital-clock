"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Clock3, Moon, Sun, TimerReset, Trash2 } from "lucide-react";

type Tab = "clock" | "alarm" | "stopwatch";
type Theme = "dark" | "light";
type AlarmItem = {
  id: string;
  time: string; // HH:MM in 24-hour format
  enabled: boolean;
  triggeredAt?: string;
};

type Lap = {
  id: string;
  value: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

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

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
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

const STORAGE_KEY = "clock-app-alarms";
const THEME_KEY = "clock-app-theme";

export default function Page() {
  const [tab, setTab] = useState<Tab>("clock");
  const [theme, setTheme] = useState<Theme>("dark");
  const [is24Hour, setIs24Hour] = useState(true);
  const [now, setNow] = useState(new Date());
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [alarmInput, setAlarmInput] = useState("07:00");
  const [ringingAlarmId, setRingingAlarmId] = useState<string | null>(null);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);

  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AlarmItem[];
        setAlarms(parsed);
      } catch {
        setAlarms([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
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
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      // Ignore audio errors silently.
    }
  };

  const stopAlarm = () => {
    setRingingAlarmId(null);
  };

  const addAlarm = () => {
    if (!alarmInput) return;

    const newAlarm: AlarmItem = {
      id: crypto.randomUUID(),
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
    setLaps((prev) => [
      { id: crypto.randomUUID(), value: elapsedMs },
      ...prev,
    ]);
  };

  const clockDisplay = useMemo(() => formatClockTime(now, is24Hour), [now, is24Hour]);
  const dateDisplay = useMemo(() => formatDate(now), [now]);
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
          "text-blue-700 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]",
      };

  return (
    <main className={`min-h-screen transition-all duration-500 ${themeClasses.page}`}>
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-4 sm:p-6">
        <div className={`w-full max-w-4xl rounded-[28px] border backdrop-blur-xl ${themeClasses.card}`}>
          <div className="flex flex-col gap-6 p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm uppercase tracking-[0.35em] ${themeClasses.muted}`}>
                  Smart Clock Dashboard
                </p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Digital Clock, Alarm & Stopwatch</h1>
              </div>

              <button
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${themeClasses.soft}`}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { key: "clock", label: "Clock", icon: Clock3 },
                { key: "alarm", label: "Alarm", icon: AlarmClock },
                { key: "stopwatch", label: "Stopwatch", icon: TimerReset },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key as Tab)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                      isActive ? themeClasses.active : themeClasses.soft
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <section className={`rounded-[24px] border p-5 sm:p-8 ${themeClasses.soft}`}>
              {tab === "clock" && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <p className={`mb-3 text-sm uppercase tracking-[0.3em] ${themeClasses.muted}`}>
                    Current Time
                  </p>
                  <div className={`text-5xl font-black tracking-[0.15em] sm:text-7xl md:text-8xl ${themeClasses.clockGlow}`}>
                    {clockDisplay}
                  </div>
                  <p className={`mt-5 text-base sm:text-lg ${themeClasses.muted}`}>{dateDisplay}</p>

                  <button
                    onClick={() => setIs24Hour((prev) => !prev)}
                    className={`mt-8 rounded-2xl border px-5 py-3 text-sm font-medium transition ${themeClasses.soft}`}
                  >
                    Switch to {is24Hour ? "12-hour" : "24-hour"} format
                  </button>
                </div>
              )}

              {tab === "alarm" && (
                <div className="grid min-h-[420px] gap-6 lg:grid-cols-[320px_1fr]">
                  <div className={`rounded-[22px] border p-5 ${themeClasses.card}`}>
                    <h2 className="text-xl font-semibold">Set Alarm</h2>
                    <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                      Create multiple alarms and enable or disable them anytime.
                    </p>

                    <div className="mt-6 space-y-4">
                      <input
                        type="time"
                        value={alarmInput}
                        onChange={(e) => setAlarmInput(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400/40"
                      />

                      <button
                        onClick={addAlarm}
                        className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-3 font-medium text-cyan-200 transition hover:bg-cyan-400/25"
                      >
                        Add Alarm
                      </button>

                      {ringingAlarmId && (
                        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4">
                          <p className="font-semibold text-rose-300">Alarm is ringing</p>
                          <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                            Your scheduled time has been reached.
                          </p>
                          <button
                            onClick={stopAlarm}
                            className="mt-3 rounded-xl border border-rose-400/30 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10"
                          >
                            Stop Alarm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`rounded-[22px] border p-5 ${themeClasses.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">Saved Alarms</h2>
                      <span className={`text-sm ${themeClasses.muted}`}>{alarms.length} total</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {alarms.length === 0 ? (
                        <div className={`rounded-2xl border border-dashed p-8 text-center ${themeClasses.muted}`}>
                          No alarms added yet.
                        </div>
                      ) : (
                        alarms.map((alarm) => {
                          const isRinging = ringingAlarmId === alarm.id;
                          return (
                            <div
                              key={alarm.id}
                              className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                isRinging ? "border-rose-400/40 bg-rose-400/10" : "border-white/10"
                              }`}
                            >
                              <div>
                                <p className="text-2xl font-bold tracking-[0.15em]">{alarm.time}</p>
                                <p className={`text-sm ${themeClasses.muted}`}>
                                  {alarm.enabled ? "Enabled" : "Disabled"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleAlarm(alarm.id)}
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${themeClasses.soft}`}
                                >
                                  {alarm.enabled ? "Turn Off" : "Turn On"}
                                </button>
                                <button
                                  onClick={() => deleteAlarm(alarm.id)}
                                  className="rounded-xl border border-rose-400/30 px-3 py-2 text-rose-300 transition hover:bg-rose-400/10"
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
                <div className="grid min-h-[420px] gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className={`flex flex-col items-center justify-center rounded-[22px] border p-5 text-center ${themeClasses.card}`}>
                    <p className={`mb-3 text-sm uppercase tracking-[0.3em] ${themeClasses.muted}`}>
                      Stopwatch
                    </p>
                    <div className={`text-5xl font-black tracking-[0.15em] sm:text-7xl ${themeClasses.clockGlow}`}>
                      {formatStopwatch(elapsedMs)}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      {!isRunning ? (
                        <button
                          onClick={startStopwatch}
                          className="rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-5 py-3 font-medium text-emerald-200 transition hover:bg-emerald-400/25"
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={pauseStopwatch}
                          className="rounded-2xl border border-amber-400/30 bg-amber-400/15 px-5 py-3 font-medium text-amber-200 transition hover:bg-amber-400/25"
                        >
                          Pause
                        </button>
                      )}

                      <button
                        onClick={addLap}
                        className={`rounded-2xl border px-5 py-3 font-medium transition ${themeClasses.soft}`}
                      >
                        Lap
                      </button>

                      <button
                        onClick={resetStopwatch}
                        className="rounded-2xl border border-rose-400/30 bg-rose-400/15 px-5 py-3 font-medium text-rose-200 transition hover:bg-rose-400/25"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-[22px] border p-5 ${themeClasses.card}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Lap Times</h2>
                      <span className={`text-sm ${themeClasses.muted}`}>{laps.length} laps</span>
                    </div>

                    <div className="mt-5 max-h-[300px] space-y-3 overflow-auto pr-1">
                      {laps.length === 0 ? (
                        <div className={`rounded-2xl border border-dashed p-8 text-center ${themeClasses.muted}`}>
                          No laps recorded yet.
                        </div>
                      ) : (
                        laps.map((lap, index) => (
                          <div
                            key={lap.id}
                            className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                          >
                            <span className="font-medium">Lap {laps.length - index}</span>
                            <span className="font-mono text-lg">{formatStopwatch(lap.value)}</span>
                          </div>
                        ))
                      )}
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
