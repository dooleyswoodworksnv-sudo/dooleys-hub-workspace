import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-accent-blue hover:bg-blue-400 text-slate-900",
    secondary: "bg-bg-secondary hover:bg-white/10 text-white border border-white/10",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
