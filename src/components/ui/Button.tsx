import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'white' | 'outline-dark';
  fullWidth?: boolean;
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  fullWidth = false,
  ...props 
}: ButtonProps) {
  const baseStyles = "px-8 py-3 2xl:px-12 2xl:py-5 rounded-full font-bold text-sm 2xl:text-lg tracking-wider transition-colors uppercase cursor-pointer border-2";
  
  const variants = {
    primary: "border-primary bg-primary text-[#081819] hover:bg-transparent hover:text-primary!",
    white: "border-white bg-white text-[#081819] hover:bg-transparent hover:text-white!",
    "outline-dark": "border-[#081819] text-[#081819] hover:bg-[#081819] hover:text-white!"
  };

  return (
    <button 
      className={cn(
        baseStyles,
        variants[variant],
        fullWidth && "w-full",
        props.disabled && "cursor-not-allowed opacity-80 hover:bg-current hover:text-inherit",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}