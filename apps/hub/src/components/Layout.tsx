import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, PenTool, KanbanSquare } from 'lucide-react';

interface LayoutProps {
  children: {
    dashboard: React.ReactNode;
    blueprints: React.ReactNode;
    designer: React.ReactNode;
    projects: React.ReactNode;
  };
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/blueprints', label: 'Blueprint Reader', icon: FileText },
    { path: '/designer', label: 'Designer', icon: PenTool },
    { path: '/projects', label: 'Project Manager', icon: KanbanSquare },
  ];

  // Determine which panel is active
  const activePanel = (() => {
    if (location.pathname.startsWith('/blueprints')) return 'blueprints';
    if (location.pathname.startsWith('/designer')) return 'designer';
    if (location.pathname.startsWith('/projects')) return 'projects';
    return 'dashboard';
  })();

  return (
    <div className="flex h-screen w-full bg-bg-primary text-white font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-bg-secondary border-r border-white/5 flex flex-col pt-6 flex-shrink-0">
        <div className="text-xl font-bold mb-8 px-6 text-white tracking-wide">Dooley's <span className="text-accent-blue">Hub</span></div>
        <div className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === (item.path === '/' ? 'dashboard' : item.path.slice(1));
            
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${isActive ? 'bg-accent-blue/10 text-accent-blue' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon size={20} className={isActive ? 'text-accent-blue' : ''} /> {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main Content Area — all panels mounted, only active one visible */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 overflow-auto ${activePanel === 'dashboard' ? '' : 'hidden'}`}>
          {children.dashboard}
        </div>
        <div className={`absolute inset-0 overflow-auto ${activePanel === 'blueprints' ? '' : 'hidden'}`}>
          {children.blueprints}
        </div>
        <div className={`absolute inset-0 overflow-auto ${activePanel === 'designer' ? '' : 'hidden'}`}>
          {children.designer}
        </div>
        <div className={`absolute inset-0 overflow-auto ${activePanel === 'projects' ? '' : 'hidden'}`}>
          {children.projects}
        </div>
      </div>
    </div>
  );
};
