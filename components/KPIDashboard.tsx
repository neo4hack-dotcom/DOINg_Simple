import React from 'react';
import { Team, TaskStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface KPIDashboardProps {
  teams: Team[];
}

const KPIDashboard: React.FC<KPIDashboardProps> = ({ teams }) => {
  // Aggregate data for Global Stats
  let totalTasks = 0;
  let totalClosed = 0;
  let totalBlocked = 0;
  let totalOngoing = 0;

  teams.forEach(t => {
    t.projects.forEach(p => {
      p.tasks.forEach(task => {
        totalTasks++;
        if (task.status === TaskStatus.DONE) totalClosed++;
        if (task.status === TaskStatus.BLOCKED) totalBlocked++;
        if (task.status === TaskStatus.ONGOING) totalOngoing++;
      });
    });
  });

  const completionRate = totalTasks > 0 ? Math.round((totalClosed / totalTasks) * 100) : 0;

  // Chart Data: Tasks per Team by Status
  const teamStatusData = teams.map(t => {
    let closed = 0;
    let ongoing = 0;
    let blocked = 0;
    let todo = 0;

    t.projects.forEach(p => {
        p.tasks.forEach(task => {
            if (task.status === TaskStatus.DONE) closed++;
            if (task.status === TaskStatus.ONGOING) ongoing++;
            if (task.status === TaskStatus.BLOCKED) blocked++;
            if (task.status === TaskStatus.TODO) todo++;
        });
    });

    return {
        name: t.name,
        Done: closed,
        InProgress: ongoing,
        Blocked: blocked,
        ToDo: todo
    };
  });

  // Pie Chart Data
  const statusDistribution = [
    { name: 'Done', value: totalClosed, color: '#10B981' },
    { name: 'In Progress', value: totalOngoing, color: '#3B82F6' },
    { name: 'Blocked', value: totalBlocked, color: '#EF4444' },
    { name: 'To Do', value: totalTasks - totalClosed - totalOngoing - totalBlocked, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  const StatCard = ({ title, value, subtext, colorClass, barColor }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</h3>
        <div className="flex items-end mt-4">
            <span className={`text-4xl font-extrabold tracking-tight ${colorClass || 'text-slate-900 dark:text-white'}`}>{value}</span>
        </div>
        {barColor && (
             <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-4">
                <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${value}` }}></div>
            </div>
        )}
        <p className="text-xs text-slate-400 mt-2">{subtext}</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
            title="Completion Rate" 
            value={`${completionRate}%`} 
            barColor="bg-emerald-500" 
            subtext="Global across all teams"
            colorClass="text-slate-900 dark:text-white"
        />
        <StatCard 
            title="Total Tasks" 
            value={totalTasks} 
            subtext={`Distributed in ${teams.length} teams`}
        />
        <StatCard 
            title="Active Work" 
            value={totalOngoing} 
            colorClass="text-blue-600 dark:text-blue-400"
            subtext="Tasks currently in progress"
        />
        <StatCard 
            title="Bottlenecks" 
            value={totalBlocked} 
            colorClass="text-red-600 dark:text-red-400"
            subtext="Tasks marked as blocked"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Bar Chart */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 lg:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Team Workload Distribution</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamStatusData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip 
                            cursor={{ fill: 'rgba(241, 245, 249, 0.1)' }}
                            contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: 'none', 
                                borderRadius: '8px', 
                                color: '#fff',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '24px' }} iconType="circle" />
                        <Bar dataKey="Done" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="InProgress" stackId="a" fill="#3B82F6" />
                        <Bar dataKey="Blocked" stackId="a" fill="#EF4444" />
                        <Bar dataKey="ToDo" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 self-start w-full">Project Health</h3>
            <div className="h-64 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={statusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{totalTasks}</span>
                    <span className="text-xs text-slate-500 uppercase font-semibold">Tasks</span>
                </div>
            </div>
             <div className="w-full space-y-2 mt-4">
                 {statusDistribution.map(s => (
                     <div key={s.name} className="flex justify-between items-center text-sm">
                         <div className="flex items-center">
                             <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></div>
                             <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                         </div>
                         <span className="font-semibold text-slate-900 dark:text-white">{s.value}</span>
                     </div>
                 ))}
             </div>
        </div>
      </div>
    </div>
  );
};

export default KPIDashboard;