import React, { useState } from 'react';

// ============================================================
// A totally normal React + Tailwind dashboard.
// Written as if ReactJIT doesn't exist.
// Zero Box, zero Text, zero imports from @reactjit/*.
// Pure <div>, <span>, <h1>, <button>, <input>, <table> soup.
// If this renders, the HTML compat layer works.
// ============================================================

function Sidebar({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  const links = [
    { id: 'dashboard', icon: '▦', label: 'Dashboard' },
    { id: 'projects', icon: '◫', label: 'Projects' },
    { id: 'team', icon: '◉', label: 'Team' },
    { id: 'analytics', icon: '◈', label: 'Analytics' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  return (
    <aside className="w-56 h-full bg-gray-900 py-4 gap-1">
      <div className="px-4 pb-4">
        <h2 className="text-white font-bold text-lg">{'Acme Inc'}</h2>
        <span className="text-gray-500 text-xs">{'Enterprise Dashboard'}</span>
      </div>
      <nav className="gap-1 px-2">
        {links.map(link => (
          <button
            key={link.id}
            className={link.id === active
              ? "flex-row gap-3 px-3 py-2 rounded-lg bg-blue-600 items-center"
              : "flex-row gap-3 px-3 py-2 rounded-lg items-center"
            }
            onClick={() => onNav(link.id)}
          >
            <span className="text-lg">{link.icon}</span>
            <span className={link.id === active ? "text-white text-sm font-bold" : "text-gray-400 text-sm"}>
              {link.label}
            </span>
          </button>
        ))}
      </nav>
      <div className="grow" />
      <div className="px-4 pt-4 border-t border-gray-700 gap-1">
        <div className="flex-row gap-3 items-center">
          <div className="w-8 h-8 bg-purple-500 rounded-full items-center justify-center">
            <span className="text-white text-xs font-bold">{'SM'}</span>
          </div>
          <div className="gap-0">
            <span className="text-white text-sm">{'Sarah M.'}</span>
            <span className="text-gray-500 text-xs">{'Admin'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ title, value, change, up }: { title: string; value: string; change: string; up: boolean }) {
  return (
    <div className="grow bg-gray-800 rounded-xl p-4 gap-2">
      <span className="text-gray-400 text-xs">{title}</span>
      <h3 className="text-white">{value}</h3>
      <span className={up ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
        {`${up ? '↑' : '↓'} ${change}`}
      </span>
    </div>
  );
}

function DashboardPage() {
  const recentActivity = [
    { user: 'Alice', action: 'deployed v2.4.1 to production', time: '2m ago', color: 'bg-green-500' },
    { user: 'Bob', action: 'opened PR #847: Fix auth flow', time: '15m ago', color: 'bg-blue-500' },
    { user: 'Carol', action: 'commented on issue #231', time: '1h ago', color: 'bg-yellow-500' },
    { user: 'Dave', action: 'merged PR #845: Add dark mode', time: '2h ago', color: 'bg-purple-500' },
    { user: 'Eve', action: 'created branch feature/payments', time: '3h ago', color: 'bg-pink-500' },
  ];

  return (
    <div className="grow gap-4 p-6">
      {/* Stats row */}
      <div className="flex-row gap-4 w-full">
        <StatCard title="Total Revenue" value="$48,290" change="12.5% from last month" up={true} />
        <StatCard title="Active Users" value="2,847" change="8.2% from last week" up={true} />
        <StatCard title="Open Issues" value="23" change="3 more than yesterday" up={false} />
        <StatCard title="Deploy Success" value="99.2%" change="0.3% improvement" up={true} />
      </div>

      {/* Main content */}
      <div className="flex-row gap-4 grow">
        {/* Activity feed */}
        <div className="grow-2 bg-gray-800 rounded-xl p-4 gap-3">
          <div className="flex-row justify-between items-center">
            <h3 className="text-white">{'Recent Activity'}</h3>
            <span className="text-blue-400 text-xs">{'View all →'}</span>
          </div>
          <div className="gap-2">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex-row gap-3 items-center py-2 border-b border-gray-700">
                <div className={`w-8 h-8 ${item.color} rounded-full items-center justify-center`}>
                  <span className="text-white text-xs font-bold">{item.user[0]}</span>
                </div>
                <div className="grow gap-0">
                  <div className="flex-row gap-1">
                    <strong className="text-white text-sm">{item.user}</strong>
                    <span className="text-gray-400 text-sm">{item.action}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions sidebar */}
        <div className="w-64 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 gap-3">
            <h4 className="text-white">{'Quick Actions'}</h4>
            <button className="w-full py-2 bg-blue-600 rounded-lg items-center">
              <span className="text-white text-sm font-bold">{'New Deployment'}</span>
            </button>
            <button className="w-full py-2 bg-gray-700 rounded-lg items-center">
              <span className="text-white text-sm">{'Create Issue'}</span>
            </button>
            <button className="w-full py-2 bg-gray-700 rounded-lg items-center">
              <span className="text-white text-sm">{'Invite Member'}</span>
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 gap-2">
            <h4 className="text-white">{'System Health'}</h4>
            <div className="gap-2">
              <div className="flex-row justify-between">
                <span className="text-gray-400 text-xs">{'API'}</span>
                <span className="text-green-400 text-xs">{'● Operational'}</span>
              </div>
              <div className="flex-row justify-between">
                <span className="text-gray-400 text-xs">{'Database'}</span>
                <span className="text-green-400 text-xs">{'● Operational'}</span>
              </div>
              <div className="flex-row justify-between">
                <span className="text-gray-400 text-xs">{'CDN'}</span>
                <span className="text-yellow-400 text-xs">{'● Degraded'}</span>
              </div>
              <div className="flex-row justify-between">
                <span className="text-gray-400 text-xs">{'Workers'}</span>
                <span className="text-green-400 text-xs">{'● Operational'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const projects = [
    { name: 'Frontend App', status: 'Active', lang: 'TypeScript', stars: 142, updated: '2h ago' },
    { name: 'API Gateway', status: 'Active', lang: 'Go', stars: 89, updated: '5h ago' },
    { name: 'Mobile App', status: 'Maintenance', lang: 'React Native', stars: 67, updated: '1d ago' },
    { name: 'ML Pipeline', status: 'Active', lang: 'Python', stars: 203, updated: '3h ago' },
    { name: 'Design System', status: 'Active', lang: 'TypeScript', stars: 312, updated: '30m ago' },
    { name: 'Infrastructure', status: 'Active', lang: 'Terraform', stars: 45, updated: '6h ago' },
  ];

  return (
    <div className="grow gap-4 p-6">
      <div className="flex-row justify-between items-center">
        <h2 className="text-white">{'Projects'}</h2>
        <button className="px-4 py-2 bg-blue-600 rounded-lg">
          <span className="text-white text-sm font-bold">{'+ New Project'}</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl p-4">
        <table className="w-full gap-1">
          <thead>
            <tr className="flex-row py-2 border-b border-gray-700">
              <th className="grow" style={{ color: '#9CA3AF', fontSize: 11, textAlign: 'left' }}>{'Name'}</th>
              <th className="w-24" style={{ color: '#9CA3AF', fontSize: 11 }}>{'Status'}</th>
              <th className="w-28" style={{ color: '#9CA3AF', fontSize: 11 }}>{'Language'}</th>
              <th className="w-16" style={{ color: '#9CA3AF', fontSize: 11 }}>{'Stars'}</th>
              <th className="w-20" style={{ color: '#9CA3AF', fontSize: 11 }}>{'Updated'}</th>
            </tr>
          </thead>
          <tbody className="gap-0">
            {projects.map((p, i) => (
              <tr key={i} className="flex-row py-2 items-center border-b border-gray-700">
                <td className="grow">
                  <span className="text-white text-sm font-bold">{p.name}</span>
                </td>
                <td className="w-24 items-center">
                  <span className={p.status === 'Active' ? "text-green-400 text-xs" : "text-yellow-400 text-xs"}>
                    {p.status}
                  </span>
                </td>
                <td className="w-28 items-center">
                  <span className="text-gray-300 text-xs">{p.lang}</span>
                </td>
                <td className="w-16 items-center">
                  <span className="text-gray-400 text-xs">{`★ ${p.stars}`}</span>
                </td>
                <td className="w-20 items-center">
                  <span className="text-gray-500 text-xs">{p.updated}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamPage() {
  const members = [
    { name: 'Alice Chen', role: 'Lead Engineer', avatar: 'AC', color: 'bg-blue-500' as const, status: 'online' },
    { name: 'Bob Torres', role: 'Backend Dev', avatar: 'BT', color: 'bg-green-500' as const, status: 'online' },
    { name: 'Carol Kim', role: 'Designer', avatar: 'CK', color: 'bg-purple-500' as const, status: 'away' },
    { name: 'Dave Patel', role: 'DevOps', avatar: 'DP', color: 'bg-orange-500' as const, status: 'online' },
    { name: 'Eve Morgan', role: 'Frontend Dev', avatar: 'EM', color: 'bg-pink-500' as const, status: 'offline' },
    { name: 'Frank Li', role: 'Data Scientist', avatar: 'FL', color: 'bg-cyan-500' as const, status: 'online' },
  ];

  return (
    <div className="grow gap-4 p-6">
      <div className="flex-row justify-between items-center">
        <h2 className="text-white">{'Team'}</h2>
        <button className="px-4 py-2 bg-blue-600 rounded-lg">
          <span className="text-white text-sm font-bold">{'+ Invite'}</span>
        </button>
      </div>

      <div className="flex-row flex-wrap gap-4">
        {members.map((m, i) => (
          <div key={i} className="w-48 bg-gray-800 rounded-xl p-4 gap-3 items-center">
            <div className={`w-14 h-14 ${m.color} rounded-full items-center justify-center`}>
              <span className="text-white font-bold text-lg">{m.avatar}</span>
            </div>
            <h4 className="text-white">{m.name}</h4>
            <span className="text-gray-400 text-xs">{m.role}</span>
            <div className="flex-row gap-2 items-center">
              <div className={`w-2 h-2 rounded-full ${
                m.status === 'online' ? 'bg-green-400' :
                m.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
              }`} />
              <span className="text-gray-500 text-xs">{m.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPage() {
  // Fake bar chart with divs — peak normal React dev behavior
  const data = [
    { label: 'Mon', value: 65 },
    { label: 'Tue', value: 82 },
    { label: 'Wed', value: 73 },
    { label: 'Thu', value: 91 },
    { label: 'Fri', value: 56 },
    { label: 'Sat', value: 38 },
    { label: 'Sun', value: 42 },
  ];
  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="grow gap-4 p-6">
      <h2 className="text-white">{'Analytics'}</h2>

      <div className="bg-gray-800 rounded-xl p-6 gap-4">
        <div className="flex-row justify-between items-center">
          <h3 className="text-white">{'Weekly Traffic'}</h3>
          <span className="text-gray-400 text-xs">{'Last 7 days'}</span>
        </div>

        {/* Bar chart made of divs like a true React dev */}
        <div className="flex-row gap-4 items-end h-40">
          {data.map((d, i) => (
            <div key={i} className="grow items-center gap-2 justify-end h-full">
              <span className="text-white text-xs">{`${d.value}%`}</span>
              <div
                className="w-full bg-blue-500 rounded-t-lg"
                style={{ height: `${(d.value / max) * 100}%` }}
              />
              <span className="text-gray-400 text-xs">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-row gap-4">
        <div className="grow bg-gray-800 rounded-xl p-4 gap-2">
          <h4 className="text-white">{'Top Pages'}</h4>
          {[
            { page: '/dashboard', views: '12,483' },
            { page: '/projects', views: '8,294' },
            { page: '/settings', views: '4,182' },
            { page: '/analytics', views: '3,891' },
          ].map((p, i) => (
            <div key={i} className="flex-row justify-between py-1 border-b border-gray-700">
              <span className="text-gray-300 text-sm">{p.page}</span>
              <span className="text-white text-sm font-bold">{p.views}</span>
            </div>
          ))}
        </div>

        <div className="grow bg-gray-800 rounded-xl p-4 gap-2">
          <h4 className="text-white">{'Browsers'}</h4>
          {[
            { name: 'Chrome', share: '64%', bar: 64 },
            { name: 'Firefox', share: '18%', bar: 18 },
            { name: 'Safari', share: '12%', bar: 12 },
            { name: 'Edge', share: '6%', bar: 6 },
          ].map((b, i) => (
            <div key={i} className="gap-1">
              <div className="flex-row justify-between">
                <span className="text-gray-300 text-xs">{b.name}</span>
                <span className="text-white text-xs">{b.share}</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full">
                <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${b.bar}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="grow gap-4 p-6">
      <h2 className="text-white">{'Settings'}</h2>

      <div className="bg-gray-800 rounded-xl p-6 gap-4">
        <h3 className="text-white">{'Profile'}</h3>
        <div className="gap-3">
          <div className="gap-1">
            <label className="text-gray-400 text-xs">{'Display Name'}</label>
            <input placeholder="Sarah Mitchell" style={{ fontSize: 13 }} />
          </div>
          <div className="gap-1">
            <label className="text-gray-400 text-xs">{'Email'}</label>
            <input placeholder="sarah@acme.com" style={{ fontSize: 13 }} />
          </div>
          <div className="gap-1">
            <label className="text-gray-400 text-xs">{'Bio'}</label>
            <textarea placeholder="Tell us about yourself..." style={{ fontSize: 13 }} />
          </div>
        </div>
        <div className="flex-row gap-3 pt-2">
          <button className="px-4 py-2 bg-blue-600 rounded-lg">
            <span className="text-white text-sm font-bold">{'Save Changes'}</span>
          </button>
          <button className="px-4 py-2 bg-gray-700 rounded-lg">
            <span className="text-gray-300 text-sm">{'Cancel'}</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 gap-4">
        <h3 className="text-white">{'Notifications'}</h3>
        <div className="gap-3">
          {[
            { label: 'Email notifications', desc: 'Receive updates via email' },
            { label: 'Push notifications', desc: 'Browser push alerts' },
            { label: 'Weekly digest', desc: 'Summary of activity each week' },
          ].map((item, i) => (
            <div key={i} className="flex-row justify-between items-center py-2 border-b border-gray-700">
              <div className="gap-0">
                <span className="text-white text-sm">{item.label}</span>
                <span className="text-gray-500 text-xs">{item.desc}</span>
              </div>
              <div className="w-10 h-5 bg-blue-600 rounded-full items-end justify-center px-1">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 gap-3">
        <h3 style={{ color: '#EF4444' }}>{'Danger Zone'}</h3>
        <p className="text-gray-400 text-sm">
          {'Once you delete your account, there is no going back. Please be certain.'}
        </p>
        <button className="w-48 py-2 bg-red-600 rounded-lg items-center">
          <span className="text-white text-sm font-bold">{'Delete Account'}</span>
        </button>
      </div>
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────

export function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div className="w-full h-full flex-row bg-gray-950">
      <Sidebar active={page} onNav={setPage} />
      <div className="grow h-full">
        {/* Top bar */}
        <header className="h-12 w-full flex-row items-center justify-between px-6 border-b border-gray-800">
          <div className="flex-row gap-2 items-center">
            <span className="text-gray-400 text-sm">{'/'}</span>
            <span className="text-white text-sm">{page.charAt(0).toUpperCase() + page.slice(1)}</span>
          </div>
          <div className="flex-row gap-4 items-center">
            <span className="text-gray-400 text-sm">{'🔔'}</span>
            <span className="text-gray-400 text-sm">{'⚡'}</span>
          </div>
        </header>

        {/* Page content */}
        {page === 'dashboard' && <DashboardPage />}
        {page === 'projects' && <ProjectsPage />}
        {page === 'team' && <TeamPage />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}
