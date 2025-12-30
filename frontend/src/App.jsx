import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { 
  LayoutDashboard, CheckCircle, Flame, Target, Activity, Trash2, Timer, Play, Pause, RotateCcw, Moon, 
  AlertTriangle, ShieldCheck, BookOpen, Save, Upload, Download, RefreshCw, Settings, Crosshair
} from 'lucide-react'
import { format, subDays, isSameDay, parseISO } from 'date-fns'

// --- SOUND ENGINE ---
const playSound = (type) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
            gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.type = 'square'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'startup') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(600, now + 0.5);
            gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.1, now + 0.2); gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else if (type === 'alarm') {
            osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else if (type === 'lock') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    } catch (e) { console.error(e); }
}

// --- CONFIG ---
const SYSTEM_CODES = ["INITIALIZING NEURAL LINK...", "LOADING LOCAL MEMORY...", "RESTORING SESSION...", "SYSTEM ONLINE"]
const MANUAL_DATA = [
    { id: 'OUTPUT', color: '#00d4ff', desc: 'Total Work Volume', instruction: 'Increase completion of Side Missions & Tasks.' },
    { id: 'DISCIPLINE', color: '#ef4444', desc: 'Willpower Test', instruction: 'Complete "Critical Protocols" (Red Tasks) daily.' },
    { id: 'RECOVERY', color: '#10b981', desc: 'Neural Recharge', instruction: 'Maintain 7-8 hours of sleep in Recovery Mode.' },
    { id: 'CONSISTENCY', color: '#f59e0b', desc: 'Streak Maintenance', instruction: 'Check-in Habits daily in the Grid.' },
    { id: 'ENDURANCE', color: '#8b5cf6', desc: 'System Resilience', instruction: 'Combination of High Discipline & High Recovery.' },
]

const PulsingDot = (props) => {
    const { cx, cy, stroke } = props;
    if (!cx || !cy) return null; 
    return (
        <circle cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="#000">
            <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-width" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
    );
};

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  
  // --- PERSISTENT STATE INITIALIZATION ---
  const loadState = (key, defaultVal) => {
      try {
          const saved = localStorage.getItem(key);
          if (saved) return JSON.parse(saved);
      } catch (e) { console.error("Load Error", e); }
      return defaultVal;
  }

  const [tasks, setTasks] = useState(() => loadState('kronix_tasks', []))
  const [sleepData, setSleepData] = useState(() => loadState('kronix_sleep', []))
  const [habits, setHabits] = useState(() => loadState('kronix_habits', []))
  const [graphData, setGraphData] = useState([])
  
  // --- INPUTS ---
  const [criticalInput, setCriticalInput] = useState('')
  const [sideInput, setSideInput] = useState('')
  const [newHabit, setNewHabit] = useState('')
  
  // --- FOCUS STATE ---
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [totalDuration, setTotalDuration] = useState(25 * 60)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [timerMode, setTimerMode] = useState('work')
  const [focusGoal, setFocusGoal] = useState('') 

  // --- RECOVERY ---
  const [todaySleep, setTodaySleep] = useState(0)

  // --- AUTO SAVE EFFECT ---
  useEffect(() => { localStorage.setItem('kronix_tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('kronix_habits', JSON.stringify(habits)) }, [habits])
  useEffect(() => { localStorage.setItem('kronix_sleep', JSON.stringify(sleepData)) }, [sleepData])

  // --- INITIALIZATION ---
  useEffect(() => { 
    setLoadingText(SYSTEM_CODES[Math.floor(Math.random() * SYSTEM_CODES.length)])
    calculateGraph(tasks);
    
    // Check today's sleep
    const todayStr = new Date().toDateString().split(' ')[0];
    const todayEntry = Array.isArray(sleepData) ? sleepData.find(d => d.day === todayStr) : null;
    if (todayEntry) setTodaySleep(todayEntry.hours);

    // Request Notification
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();

    const timer = setTimeout(() => { setIsLoading(false); playSound('startup') }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleTabChange = (tab) => { playSound('click'); setActiveTab(tab) }
  const handleTyping = (setter, val) => { setter(val) }

  // --- LOCAL DATA HANDLERS ---
  const addTask = (content, isMandatory) => {
      if (!content) return;
      playSound('success');
      const newTask = {
          id: Date.now(),
          content,
          is_done: false,
          is_mandatory: isMandatory,
          created_at: new Date().toISOString()
      };
      const updatedTasks = [newTask, ...tasks];
      setTasks(updatedTasks);
      calculateGraph(updatedTasks);
      if(isMandatory) setCriticalInput(''); else setSideInput('');
  }

  const toggleTask = (task) => {
      playSound('click');
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t);
      setTasks(updatedTasks);
      calculateGraph(updatedTasks);
  }

  const deleteTask = (e, taskId) => {
      e.preventDefault();
      if(confirm("Delete protocol?")) {
          playSound('click');
          const updatedTasks = tasks.filter(t => t.id !== taskId);
          setTasks(updatedTasks);
          calculateGraph(updatedTasks);
      }
  }

  const addHabit = () => {
      if(!newHabit) return;
      playSound('success');
      setHabits([...habits, { id: Date.now(), name: newHabit, completed_days: '' }]);
      setNewHabit('');
  }

  const toggleHabitDay = (habitId, day) => {
      playSound('click');
      setHabits(habits.map(h => {
          if (h.id === habitId) {
              const days = h.completed_days ? h.completed_days.split(',') : [];
              const dayStr = day.toString();
              const newDays = days.includes(dayStr) ? days.filter(d => d !== dayStr) : [...days, dayStr];
              return { ...h, completed_days: newDays.join(',') };
          }
          return h;
      }));
  }

  const deleteHabit = (id) => {
      if(confirm("Stop tracking?")) { playSound('click'); setHabits(habits.filter(h => h.id !== id)); }
  }

  const logSleep = (hours) => {
      playSound('success');
      setTodaySleep(hours);
      const todayStr = new Date().toDateString().split(' ')[0];
      const existingIndex = sleepData.findIndex(d => d.day === todayStr);
      let updatedSleep = [...sleepData];
      
      if (existingIndex >= 0) {
          updatedSleep[existingIndex].hours = hours;
      } else {
          updatedSleep = [...updatedSleep, { day: todayStr, hours }];
          if(updatedSleep.length > 7) updatedSleep.shift(); 
      }
      setSleepData(updatedSleep);
  }

  // --- DATA MANAGEMENT ---
  const exportData = () => {
      const dataStr = JSON.stringify({ tasks, habits, sleepData });
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', 'kronix_backup.json');
      linkElement.click();
      playSound('success');
  }

  const importData = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e) => {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.readAsText(file, "UTF-8");
          reader.onload = (readerEvent) => {
              try {
                  const content = JSON.parse(readerEvent.target.result);
                  if(content.tasks) setTasks(content.tasks);
                  if(content.habits) setHabits(content.habits);
                  if(content.sleepData) setSleepData(content.sleepData);
                  alert("SYSTEM RESTORED SUCCESSFULLY.");
                  playSound('startup');
              } catch (err) { alert("CORRUPT DATA FILE."); }
          }
      }
      input.click();
  }

  const resetSystem = () => {
      if(confirm("WARNING: THIS WILL WIPE ALL LOCAL DATA. PROCEED?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  // --- LOGIC ---
  useEffect(() => { 
      let interval = null; 
      if (isTimerActive && timeLeft > 0) {
          interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000); 
      } else if (timeLeft === 0 && isTimerActive) { 
          setIsTimerActive(false); playSound('alarm'); 
          if ("Notification" in window && Notification.permission === "granted") new Notification("KRONIX ALERT", { body: "Focus Sequence Complete.", icon: '/vite.svg' });
      } 
      return () => clearInterval(interval) 
  }, [isTimerActive, timeLeft])

  const formatTime = (sec) => { if (isNaN(sec)) return "00:00"; return `${Math.floor(sec/60)<10?'0':''}${Math.floor(sec/60)}:${sec%60<10?'0':''}${sec%60}` }
  
  const setMode = (mode) => { 
      playSound('click'); 
      setIsTimerActive(false); 
      setTimerMode(mode); 
      let time = 25*60; 
      if(mode==='short') time=5*60; 
      if(mode==='long') time=15*60; 
      setTimeLeft(time); 
      setTotalDuration(time); 
  }
  
  const toggleTimerWithSound = useCallback(() => { 
      if(!focusGoal && !isTimerActive) { alert("ENTER MISSION OBJECTIVE FIRST."); return; } 
      if(!isTimerActive) playSound('lock'); 
      else playSound('click'); 
      setIsTimerActive(prev => !prev); 
  }, [focusGoal, isTimerActive]); 
  
  const calculateGraph = (taskList) => { 
      const last7Days = Array.from({ length: 7 }, (_, i) => { const d = subDays(new Date(), 6 - i); return { date: d, name: format(d, 'EEE'), xp: 0 } }); 
      taskList.forEach(task => { if (task.is_done && task.created_at) { const dStat = last7Days.find(d => isSameDay(d.date, parseISO(task.created_at))); if(dStat) dStat.xp += (task.is_mandatory?25:10) } }); 
      setGraphData(last7Days) 
  }

  // --- ANALYTICS (CRASH PROOF) ---
  const systemIntegrity = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeSleep = Array.isArray(sleepData) ? sleepData : [];
    const safeHabits = Array.isArray(habits) ? habits : [];

    const outputScore = safeTasks.length === 0 ? 0 : Math.round((safeTasks.filter(t => t.is_done).length / safeTasks.length) * 100);
    const mandatoryTasks = safeTasks.filter(t => t.is_mandatory);
    const disciplineScore = mandatoryTasks.length === 0 ? 0 : Math.round((mandatoryTasks.filter(t => t.is_done).length / mandatoryTasks.length) * 100);
    const avgSleep = safeSleep.length > 0 ? safeSleep.reduce((acc, curr) => acc + (curr.hours || 0), 0) / (safeSleep.length || 1) : 0;
    const recoveryScore = Math.min(Math.round((avgSleep / 8) * 100), 100);
    const totalHabitScore = safeHabits.reduce((acc, h) => { const days = h.completed_days ? h.completed_days.split(',').length : 0; return acc + (days / 31); }, 0);
    const consistencyScore = safeHabits.length === 0 ? 0 : Math.min(Math.round((totalHabitScore / safeHabits.length) * 100), 100);
    const enduranceScore = Math.round((disciplineScore + recoveryScore) / 2);
    
    return [
        { subject: 'OUTPUT', A: outputScore || 0, fullMark: 100 }, 
        { subject: 'DISCIPLINE', A: disciplineScore || 0, fullMark: 100 }, 
        { subject: 'RECOVERY', A: recoveryScore || 0, fullMark: 100 }, 
        { subject: 'CONSISTENCY', A: consistencyScore || 0, fullMark: 100 }, 
        { subject: 'ENDURANCE', A: enduranceScore || 0, fullMark: 100 }
    ];
  }, [tasks, sleepData, habits])

  const weakestLink = useMemo(() => {
      if (!systemIntegrity || systemIntegrity.length === 0) return { subject: 'CALIBRATING', A: 0 };
      return systemIntegrity.reduce((prev, curr) => (prev.A < curr.A ? prev : curr), systemIntegrity[0]);
  }, [systemIntegrity])

  const systemStatus = useMemo(() => {
      const totalScore = systemIntegrity.reduce((acc, curr) => acc + curr.A, 0);
      const avg = Math.round(totalScore / 5);
      if (avg >= 90) return { text: "SYSTEM OPTIMAL", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
      if (avg >= 70) return { text: "SYSTEM STABLE", color: "#00d4ff", bg: "rgba(0, 212, 255, 0.1)" };
      if (avg >= 50) return { text: "MAINTENANCE REQUIRED", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
      return { text: "CRITICAL FAILURE", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", blink: true };
  }, [systemIntegrity])

  const getHabitStats = (habit) => { const completedDays = habit.completed_days ? habit.completed_days.split(',').map(Number) : []; return { efficiency: Math.round((completedDays.length / 31) * 100), total: completedDays.length } }
  
  const completed = Array.isArray(tasks) ? tasks.filter(t => t.is_done).length : 0;
  const pending = Array.isArray(tasks) ? tasks.length - completed : 0;
  const progress = tasks.length===0?0:Math.round((completed/tasks.length)*100)
  const totalXP = Array.isArray(tasks) ? tasks.reduce((acc, t) => t.is_done ? acc + (t.is_mandatory?25:10) : acc, 0) : 0;
  const level = Math.floor(totalXP / 100) + 1

  if (isLoading) return <div style={styles.loadingContainer}><div style={styles.spinner}></div><h2 style={styles.loadingTitle}>KRONIX</h2><div style={styles.loadingBarContainer}><div style={styles.loadingBarFill}></div></div><p style={styles.loadingText}>_{loadingText}</p></div>

  return (
    <div style={styles.appContainer}>
      <div style={styles.sidebar}>
        <div style={styles.logoArea}><Activity color="#00d4ff" size={28} /><h1 style={styles.logoText}>KRONIX</h1></div>
        <div style={styles.nav}>
          <div onClick={()=>handleTabChange('overview')}><NavItem icon={<LayoutDashboard size={20}/>} label="Overview" active={activeTab==='overview'} /></div>
          <div onClick={()=>handleTabChange('missions')}><NavItem icon={<Target size={20}/>} label="Habit Grid" active={activeTab==='missions'} /></div>
          <div onClick={()=>handleTabChange('focus')}><NavItem icon={<Timer size={20}/>} label="Focus Mode" active={activeTab==='focus'} /></div>
          <div onClick={()=>handleTabChange('recovery')}><NavItem icon={<Moon size={20}/>} label="Neural Recovery" active={activeTab==='recovery'} /></div>
          <div onClick={()=>handleTabChange('analytics')}><NavItem icon={<Flame size={20}/>} label="System Integrity" active={activeTab==='analytics'} /></div>
          <div onClick={()=>handleTabChange('settings')}><NavItem icon={<Settings size={20}/>} label="Data Management" active={activeTab==='settings'} /></div>
        </div>
        <div style={styles.userProfile}>
          <div style={styles.profileHeader}><div style={styles.avatar}>C</div><div><p style={{fontSize:'14px',fontWeight:'bold',margin:0}}>Commander</p><p style={{fontSize:'12px',color:'#00d4ff',margin:0}}>Level {level}</p></div></div>
          <div style={styles.xpContainer}><div style={styles.progressBarBg}><div style={{...styles.progressBarFill, width:`${totalXP%100}%`}}></div></div><div style={styles.xpLabels}><span>{totalXP%100} / 100 XP</span></div></div>
        </div>
      </div>

      <div style={styles.main}>
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            <div style={styles.header}><div><h2 style={styles.pageTitle}>Command Center</h2><p style={styles.date}>{new Date().toDateString()}</p></div><div style={styles.xpBadge}>⚡ {totalXP} XP EARNED</div></div>
            <div style={styles.grid}>
              <div style={styles.cardLarge}>
                <h3 style={styles.cardTitle}>Productivity Flow (XP)</h3>
                <div style={{width:'100%', height:'100%'}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={graphData}><defs><linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/><stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} /><XAxis dataKey="name" stroke="#666" /><YAxis stroke="#666" /><Tooltip contentStyle={{backgroundColor:'#111', border:'1px solid #333'}} /><Area type="monotone" dataKey="xp" stroke="#00d4ff" fillOpacity={1} fill="url(#colorXp)" isAnimationActive={true} animationDuration={2000}/></AreaChart></ResponsiveContainer></div>
              </div>
              <div style={styles.statsColumn}><StatCard title="Tasks Done" value={completed} color="#10b981" /><StatCard title="Pending" value={pending} color="#f59e0b" /><StatCard title="Efficiency" value={`${progress}%`} color="#8b5cf6" /></div>
            </div>
            <div style={styles.taskGrid}>
              <div style={styles.taskColumn}><div style={styles.columnHeader}><Target size={18} color="#ef4444"/><h3>CRITICAL PROTOCOLS</h3></div><div style={styles.inputWrapper}><input style={styles.input} placeholder="New Critical Task..." value={criticalInput} onChange={(e)=>handleTyping(setCriticalInput, e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&addTask(criticalInput, true)}/><button style={{...styles.addBtn, background:'#ef4444'}} onClick={()=>addTask(criticalInput, true)}>+</button></div><div style={styles.taskList}>{tasks.filter(t=>t.is_mandatory).map(task=><TaskItem key={task.id} task={task} toggle={toggleTask} del={deleteTask} color="#ef4444" />)}</div></div>
              <div style={styles.taskColumn}><div style={styles.columnHeader}><CheckCircle size={18} color="#3b82f6"/><h3>SIDE MISSIONS</h3></div><div style={styles.inputWrapper}><input style={styles.input} placeholder="New Side Task..." value={sideInput} onChange={(e)=>handleTyping(setSideInput, e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&addTask(sideInput, false)}/><button style={{...styles.addBtn, background:'#3b82f6'}} onClick={()=>addTask(sideInput, false)}>+</button></div><div style={styles.taskList}>{tasks.filter(t=>!t.is_mandatory).map(task=><TaskItem key={task.id} task={task} toggle={toggleTask} del={deleteTask} color="#3b82f6" />)}</div></div>
            </div>
          </>
        )}

        {/* SETTINGS (DATA MANAGEMENT) */}
        {activeTab === 'settings' && (
            <div style={{height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
                <div style={{maxWidth:'600px', width:'100%', background:'#0a0a0a', border:'1px solid #333', borderRadius:'16px', padding:'40px'}}>
                    <div style={{textAlign:'center', marginBottom:'40px'}}>
                        <Save size={40} color="#00d4ff" style={{marginBottom:'15px'}}/>
                        <h2 style={{margin:0, fontSize:'24px', letterSpacing:'2px'}}>DATA MANAGEMENT</h2>
                        <p style={{color:'#666', marginTop:'10px', fontSize:'14px'}}>BACKUP OR RESTORE YOUR NEURAL LINK</p>
                    </div>
                    
                    <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                        <button onClick={exportData} style={{padding:'20px', background:'#111', border:'1px solid #333', borderRadius:'8px', color:'white', display:'flex', alignItems:'center', gap:'15px', cursor:'pointer', transition:'all 0.2s', fontSize:'16px', fontWeight:'bold'}}>
                            <Download size={24} color="#10b981"/> 
                            <div>
                                <span style={{display:'block'}}>EXPORT SYSTEM DATA</span>
                                <span style={{fontSize:'10px', color:'#666', fontWeight:'normal'}}>Download a JSON backup of your progress.</span>
                            </div>
                        </button>

                        <button onClick={importData} style={{padding:'20px', background:'#111', border:'1px solid #333', borderRadius:'8px', color:'white', display:'flex', alignItems:'center', gap:'15px', cursor:'pointer', transition:'all 0.2s', fontSize:'16px', fontWeight:'bold'}}>
                            <Upload size={24} color="#f59e0b"/> 
                            <div>
                                <span style={{display:'block'}}>RESTORE FROM BACKUP</span>
                                <span style={{fontSize:'10px', color:'#666', fontWeight:'normal'}}>Upload your .JSON file to restore data.</span>
                            </div>
                        </button>

                        <button onClick={resetSystem} style={{padding:'20px', background:'rgba(239, 68, 68, 0.1)', border:'1px solid #ef4444', borderRadius:'8px', color:'#ef4444', display:'flex', alignItems:'center', gap:'15px', cursor:'pointer', transition:'all 0.2s', fontSize:'16px', fontWeight:'bold', marginTop:'20px'}}>
                            <RefreshCw size={24} /> 
                            <div>
                                <span style={{display:'block'}}>FACTORY RESET</span>
                                <span style={{fontSize:'10px', color:'#ef4444', fontWeight:'normal'}}>WARNING: Wipes all local data permanently.</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
            <div style={{height:'100%', display:'flex', flexDirection:'column'}}>
                 <div style={styles.header}><div><h2 style={styles.pageTitle}>System Integrity</h2><p style={styles.date}>Balance & Efficiency Analysis</p></div><div style={{...styles.xpBadge, borderColor: systemStatus.color, color: systemStatus.color, background: systemStatus.bg, animation: systemStatus.blink ? 'pulse 2s infinite' : 'none' }}>{systemStatus.text}</div></div>
                 <div style={{display:'flex', gap:'30px', height:'450px', alignItems:'flex-start', marginBottom:'30px'}}>
                    <div style={{...styles.cardLarge, flex:2, height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}><h3 style={styles.cardTitle}>Performance Radar</h3><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="80%" data={systemIntegrity}><PolarGrid stroke="#333" /><PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 12 }} /><PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#333" /><Radar name="System Status" dataKey="A" stroke={systemStatus.color} strokeWidth={3} fill={systemStatus.color} fillOpacity={0.3} isAnimationActive={true} /><Tooltip contentStyle={{backgroundColor:'#111', border:`1px solid ${systemStatus.color}`, color:'white'}} /></RadarChart></ResponsiveContainer></div>
                    <div style={{flex:1, display:'flex', flexDirection:'column', gap:'20px', height:'100%'}}>
                        <div style={{background:'#1a0b0b', border:'1px solid #ef4444', padding:'25px', borderRadius:'16px', flex:1}}><div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', color:'#ef4444'}}><AlertTriangle size={24}/><h3 style={{margin:0, fontSize:'18px'}}>SYSTEM ALERT</h3></div><p style={{color:'#aaa', fontSize:'14px', marginBottom:'5px'}}>WEAKEST LINK DETECTED:</p><h2 style={{color:'white', margin:0, fontSize:'28px'}}>{weakestLink.subject}</h2><p style={{color:'#666', fontSize:'12px', marginTop:'10px'}}>Efficiency at {weakestLink.A}%. Immediate optimization required.</p></div>
                        <div style={{background:'#0a0a0a', border:`1px solid ${systemStatus.color}`, padding:'25px', borderRadius:'16px', flex:1.5, overflowY:'auto'}}><div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', color:systemStatus.color}}><ShieldCheck size={24}/><h3 style={{margin:0, fontSize:'18px'}}>METRICS</h3></div><div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>{systemIntegrity.map(stat => (<div key={stat.subject}><div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'5px', color:'#ccc'}}><span>{stat.subject}</span><span>{stat.A}%</span></div><div style={{width:'100%', height:'4px', background:'#222', borderRadius:'2px'}}><div style={{width:`${stat.A}%`, height:'100%', background: stat.A < 40 ? '#ef4444' : stat.A < 70 ? '#f59e0b' : '#10b981', transition:'width 0.5s'}}></div></div></div>))}</div></div>
                    </div>
                 </div>
                 <div style={{background:'#0a0a0a', border:'1px solid #333', borderRadius:'16px', padding:'20px'}}><div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', borderBottom:'1px solid #222', paddingBottom:'10px'}}><BookOpen size={20} color="#666" /><h3 style={{margin:0, fontSize:'16px', color:'#888', letterSpacing:'1px'}}>OPERATIONAL MANUAL: PROTOCOL DEFINITIONS</h3></div><div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px'}}>{MANUAL_DATA.map(item => (<div key={item.id} style={{padding:'15px', background:'#111', borderRadius:'8px', borderLeft:`3px solid ${item.color}`}}><h4 style={{margin:'0 0 5px 0', fontSize:'14px', color:item.color}}>{item.id}</h4><p style={{margin:0, fontSize:'12px', color:'#bbb', fontWeight:'bold'}}>{item.desc}</p><p style={{margin:'5px 0 0 0', fontSize:'11px', color:'#666', fontStyle:'italic'}}>{item.instruction}</p></div>))}</div></div>
            </div>
        )}

        {activeTab === 'missions' && <div style={{height: '100%', display:'flex', flexDirection:'column'}}><div style={styles.header}><div><h2 style={styles.pageTitle}>Monthly Protocols</h2><p style={styles.date}>Track your consistency</p></div><div style={styles.inputWrapperSimple}><input style={styles.input} placeholder="New Habit..." value={newHabit} onChange={(e)=>handleTyping(setNewHabit, e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&addHabit()}/><button style={{...styles.addBtn, background:'#00d4ff'}} onClick={addHabit}>+</button></div></div><div style={styles.habitTableContainer}><table style={styles.habitTable}><thead><tr><th style={{textAlign:'left', padding:'15px', color:'#888', minWidth:'150px'}}>PROTOCOL</th><th style={{color:'#f59e0b', textAlign:'center', minWidth:'120px'}}>PERFORMANCE</th>{[...Array(31)].map((_, i) => (<th key={i} style={{color:'#444', fontSize:'10px', textAlign:'center', width:'30px'}}>{i+1}</th>))}<th></th></tr></thead><tbody>{habits.map(habit => { const completedDays = habit.completed_days ? habit.completed_days.split(',') : []; const stats = getHabitStats(habit); return (<tr key={habit.id} style={{borderBottom:'1px solid #222'}}><td style={{padding:'15px', fontWeight:'bold', color:'white'}}>{habit.name}</td><td style={{textAlign:'center'}}><div style={{background: stats.efficiency > 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: stats.efficiency > 80 ? '#10b981' : '#f59e0b', fontSize:'12px', padding:'4px 8px', borderRadius:'12px', fontWeight:'bold', border:`1px solid ${stats.efficiency > 80 ? '#10b981' : '#f59e0b'}`, display:'inline-block'}}>{stats.efficiency}% ({stats.total}/31)</div></td>{[...Array(31)].map((_, i) => {const dayStr = (i + 1).toString(); const isChecked = completedDays.includes(dayStr); return (<td key={i} style={{textAlign:'center'}}><div onClick={() => toggleHabitDay(habit, i + 1)} style={{width:'12px', height:'12px', borderRadius:'2px', background: isChecked ? '#00d4ff' : '#1a1a1a', border: isChecked ? 'none' : '1px solid #333', cursor:'pointer', margin:'0 auto', boxShadow: isChecked ? '0 0 5px #00d4ff' : 'none', transition: 'all 0.2s'}}></div></td>)})}<td><Trash2 size={16} color="#444" style={{cursor:'pointer', opacity:0.5}} onClick={()=>deleteHabit(habit.id)}/></td></tr>)})}</tbody></table></div></div>}
        
        {activeTab === 'focus' && (
             <div style={{height: '100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                <div style={styles.focusContainer}>
                    <div style={{position:'relative', width:'300px', height:'300px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'30px'}}>
                        <svg width="300" height="300" style={{transform:'rotate(-90deg)', position:'absolute'}}>
                            <circle r="135" cx="150" cy="150" fill="transparent" stroke="#222" strokeWidth="8" />
                            <circle r="135" cx="150" cy="150" fill="transparent" stroke={timerMode==='work'?'#00d4ff':'#10b981'} strokeWidth="8" strokeDasharray={2 * Math.PI * 135} strokeDashoffset={2 * Math.PI * 135 * (1 - timeLeft / (totalDuration || 1))} strokeLinecap="round" style={{transition: 'stroke-dashoffset 1s linear'}} />
                        </svg>
                        <div style={{textAlign:'center', zIndex:10}}>
                            <h2 style={{fontSize:'80px', fontWeight:'bold', fontFamily:'monospace', color: isTimerActive ? (timerMode==='work'?'#00d4ff':'#10b981') : '#444', textShadow: isTimerActive ? `0 0 30px ${timerMode==='work'?'#00d4ff':'#10b981'}` : 'none', margin:0}}>{formatTime(timeLeft)}</h2>
                            <p style={{color:'#666', marginTop:'10px', letterSpacing:'3px'}}>STATUS: <span style={{color: isTimerActive ? (timerMode==='work'?'#00d4ff':'#10b981') : '#444'}}>{isTimerActive ? 'ENGAGED' : 'STANDBY'}</span></p>
                        </div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'10px', background:'#111', padding:'15px 25px', borderRadius:'30px', border: focusGoal ? `1px solid ${timerMode==='work'?'#00d4ff':'#10b981'}` : '1px solid #333', marginBottom:'40px', width:'400px', transition:'all 0.3s', boxShadow: focusGoal && isTimerActive ? `0 0 20px ${timerMode==='work'?'#00d4ff':'#10b981'}40` : 'none'}}>
                        <Crosshair size={20} color={focusGoal ? (timerMode==='work'?'#00d4ff':'#10b981') : '#444'} />
                        {isTimerActive ? (<span style={{flex:1, textAlign:'center', color:'white', fontWeight:'bold', letterSpacing:'1px'}}>{focusGoal}</span>) : (<input style={{flex:1, background:'transparent', border:'none', color:'white', fontSize:'14px', outline:'none', textAlign:'center', letterSpacing:'1px'}} placeholder="ENTER PRIMARY OBJECTIVE..." value={focusGoal} onChange={(e)=>setFocusGoal(e.target.value.toUpperCase())}/>)}
                    </div>
                    <div style={{display:'flex', gap:'30px', marginBottom:'40px'}}>
                        <button onClick={toggleTimerWithSound} style={{...styles.timerBtn, background: timerMode==='work'?'#00d4ff':'#10b981', width:'70px', height:'70px', boxShadow: isTimerActive ? `0 0 30px ${timerMode==='work'?'#00d4ff':'#10b981'}60` : 'none', transform: isTimerActive ? 'scale(1.1)' : 'scale(1)'}}>{isTimerActive ? <Pause size={28}/> : <Play size={28}/>}</button>
                        <button onClick={()=>setMode(timerMode)} style={{...styles.timerBtnSecondary, width:'70px', height:'70px'}}><RotateCcw size={24}/></button>
                    </div>
                    <div style={styles.modeSelector}><button onClick={() => setMode('work')} style={{...styles.modeBtn, background: timerMode === 'work' ? '#1f2937' : 'transparent', color: timerMode==='work'?'white':'#666'}}>DEEP WORK (25)</button><button onClick={() => setMode('short')} style={{...styles.modeBtn, background: timerMode === 'short' ? '#1f2937' : 'transparent', color: timerMode==='short'?'#10b981':'#666'}}>RECHARGE (5)</button><button onClick={() => setMode('long')} style={{...styles.modeBtn, background: timerMode === 'long' ? '#1f2937' : 'transparent', color: timerMode==='long'?'#f59e0b':'#666'}}>REBOOT (15)</button></div>
                </div>
             </div>
        )}

        {activeTab === 'recovery' && (
            <div style={{height: '100%', display:'flex', flexDirection:'column'}}>
                 <div style={styles.header}><div><h2 style={styles.pageTitle}>Neural Recovery</h2><p style={styles.date}>Sleep Efficiency Monitor (ECG Mode)</p></div><div style={{...styles.xpBadge, borderColor:'#10b981', color:'#10b981', background:'rgba(16, 185, 129, 0.1)'}}>RESTORED</div></div>
                <div style={styles.cardLarge}>
                    <h3 style={styles.cardTitle}>Last Night's Recharge (Hours)</h3>
                    <div style={{display:'flex', gap:'8px', marginBottom:'40px', flexWrap:'wrap'}}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (<button key={num} onClick={() => logSleep(num)} style={{width:'50px', height:'50px', borderRadius:'8px', border:'1px solid #333', background: todaySleep === num ? '#10b981' : '#111', color: todaySleep === num ? 'black' : '#888', fontWeight:'bold', cursor:'pointer', boxShadow: todaySleep === num ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none', transition: 'all 0.2s'}}>{num}</button>))}</div>
                    <div style={{width:'100%', height:'300px', background:'#000', borderRadius:'12px', padding:'20px', border:'1px solid #222'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sleepData}><CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} /><XAxis dataKey="day" stroke="#666" /><YAxis domain={[0, 12]} stroke="#666" /><Tooltip contentStyle={{backgroundColor:'#111', border:'1px solid #10b981', color:'white'}} /><ReferenceLine y={8} stroke="#333" strokeDasharray="5 5" label={{ value: 'OPTIMAL (8h)', position: 'insideBottomRight', fill: '#666', fontSize: 10 }} /><Line type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={3} dot={<PulsingDot />} activeDot={{r: 8, fill: '#10b981', stroke: 'rgba(16, 185, 129, 0.5)', strokeWidth: 10}} isAnimationActive={true} animationDuration={3000} animationEasing="ease-in-out" style={{filter: 'drop-shadow(0px 0px 8px rgba(16, 185, 129, 0.6))'}}/></LineChart></ResponsiveContainer></div>
                </div>
            </div>
        )}
      </div>
    </div>
  )
}

// --- SUB COMPONENTS ---
const NavItem = ({ icon, label, active }) => ( <div style={{display:'flex', alignItems:'center', gap:'10px', padding:'12px', borderRadius:'8px', cursor:'pointer', color: active ? 'white' : '#666', backgroundColor: active ? '#1f2937' : 'transparent', marginBottom:'5px'}} onMouseEnter={()=>playSound('hover')}>{icon} <span style={{fontSize:'14px', fontWeight:'500'}}>{label}</span></div> )
const StatCard = ({ title, value, color }) => ( <div style={{background:'#111', padding:'20px', borderRadius:'12px', border:'1px solid #222', flex:1, display:'flex', flexDirection:'column', justifyContent:'center'}}><p style={{color:'#666', fontSize:'12px', marginBottom:'5px'}}>{title}</p><h3 style={{fontSize:'28px', color: color, margin:0}}>{value}</h3></div> )
const TaskItem = ({ task, toggle, del, color }) => ( <div onClick={() => toggle(task)} onContextMenu={(e) => del(e, task.id)} style={{padding:'15px', background:'#111', borderRadius:'8px', borderLeft:`3px solid ${color}`, marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', opacity: task.is_done ? 0.5 : 1}}><div style={{width:'18px', height:'18px', borderRadius:'50%', border:`2px solid ${color}`, background: task.is_done ? color : 'transparent'}}></div><span style={{color:'white', fontSize:'14px', flex:1, textDecoration: task.is_done ? 'line-through' : 'none'}}>{task.content}</span></div> )

// --- STYLES ---
const styles = {
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#000', color: '#00d4ff', fontFamily: 'monospace' },
  spinner: { width: '50px', height: '50px', border: '3px solid #333', borderTop: '3px solid #00d4ff', borderRadius: '50%', marginBottom: '20px', animation: 'spin 1s linear infinite' },
  loadingTitle: { letterSpacing: '5px', fontSize: '24px', marginBottom: '30px' },
  loadingText: { color: '#666', marginTop: '20px', fontSize: '14px', letterSpacing: '1px' },
  loadingBarContainer: { width: '300px', height: '4px', background: '#222', borderRadius: '2px', overflow:'hidden' },
  loadingBarFill: { height: '100%', width: '100%', background: '#00d4ff', transformOrigin: 'left', animation: 'load 2.5s ease-out forwards' },
  appContainer: { display:'flex', minHeight:'100vh', width:'100vw', backgroundColor:'#000', color:'white', fontFamily:'Inter, sans-serif', overflowX:'hidden' },
  sidebar: { width:'260px', minWidth:'260px', borderRight:'1px solid #222', padding:'20px', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh' },
  logoArea: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'40px', paddingLeft:'10px' },
  logoText: { fontSize:'20px', fontWeight:'bold', letterSpacing:'2px' },
  nav: { flex:1 },
  userProfile: { borderTop:'1px solid #222', paddingTop:'20px', marginTop:'auto' },
  profileHeader: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px' },
  xpContainer: { width: '100%' },
  progressBarBg: { width:'100%', height:'6px', background:'#333', borderRadius:'3px', overflow:'hidden', marginBottom:'8px' },
  progressBarFill: { height:'100%', background:'linear-gradient(90deg, #00d4ff, #0055ff)', transition:'width 0.5s ease' },
  xpLabels: { display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#666', fontWeight:'600' },
  avatar: { width:'40px', height:'40px', borderRadius:'50%', background:'#333', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold' },
  main: { flex:1, padding:'40px', display:'flex', flexDirection:'column', width:'100%' }, 
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'30px' },
  pageTitle: { fontSize:'32px', fontWeight:'bold', margin:0 },
  date: { color:'#666', fontSize:'14px', marginTop:'5px' },
  xpBadge: { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '10px 25px', borderRadius: '30px', fontSize:'15px', fontWeight:'bold', boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)', letterSpacing: '1px', display: 'inline-block' },
  grid: { display:'flex', gap:'20px', marginBottom:'30px', height:'350px', width:'100%' }, 
  cardLarge: { flex:3, background:'#0a0a0a', border:'1px solid #222', borderRadius:'16px', padding:'25px', minHeight:'300px' },
  cardTitle: { fontSize:'16px', color:'#888', marginBottom:'20px' },
  statsColumn: { flex:1, display:'flex', flexDirection:'column', gap:'15px' },
  taskGrid: { display:'flex', gap:'30px', width:'100%', flex:1 }, 
  taskColumn: { flex:1, display:'flex', flexDirection:'column' },
  columnHeader: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', borderBottom:'1px solid #222', paddingBottom:'10px' },
  inputWrapper: { display:'flex', gap:'10px', marginBottom:'20px' },
  inputWrapperSimple: { display:'flex', gap:'10px', marginTop:'10px', width:'400px' },
  input: { flex:1, padding:'15px', background:'#111', border:'1px solid #222', color:'white', borderRadius:'8px', outline:'none', fontSize:'16px' },
  addBtn: { width:'50px', border:'none', borderRadius:'8px', color:'white', fontSize:'24px', cursor:'pointer' },
  taskList: { display:'flex', flexDirection:'column', gap:'10px' },
  habitTableContainer: { background:'#0a0a0a', borderRadius:'16px', border:'1px solid #222', padding:'20px', overflowX:'auto' },
  habitTable: { width:'100%', borderCollapse:'collapse', minWidth:'800px' },
  focusContainer: { background: '#0a0a0a', padding:'60px', borderRadius:'24px', border:'1px solid #222', display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:'800px', boxShadow:'0 0 30px rgba(0,0,0,0.5)' },
  timerBtn: { width:'80px', height:'80px', borderRadius:'50%', border:'none', background:'#00d4ff', color:'black', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', boxShadow:'0 0 15px rgba(0, 212, 255, 0.4)', transition: 'all 0.3s' },
  timerBtnSecondary: { width:'60px', height:'60px', borderRadius:'50%', border:'1px solid #333', background:'transparent', color:'#666', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  modeSelector: { display:'flex', gap:'10px', background:'#111', padding:'5px', borderRadius:'12px' },
  modeBtn: { padding:'10px 20px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'bold', transition:'all 0.2s' }
}

export default App