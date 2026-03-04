import { LucideIcon, Tablet, Activity, TrendingUp, ArrowUpRight, Clock } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "gradient-green" | "gradient-blue";
  badge?: {
    text: string;
    color: "gray" | "green" | "amber";
  };
}

export function StatCard({ title, value, subtitle, icon: Icon, variant = "default", badge }: StatCardProps) {
  if (variant === "gradient-green") {
    return (
      <div className="bg-gradient-to-br from-secondary to-gray-900 p-6 rounded-[32px] text-white shadow-lg shadow-secondary/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
              <Icon className="w-5 h-5" />
            </div>
            {badge && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5">{badge.text}</p>
                <p className="text-lg font-bold text-green-400">{subtitle}</p>
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em] mb-1">{title}</p>
            <p className="text-3xl font-black leading-none">{value}</p>
            {!badge && <p className="text-[10px] text-white/40 font-medium mt-2">{subtitle}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "gradient-blue") {
    return (
      <div className="bg-gradient-to-br from-primary to-indigo-600 p-6 rounded-[32px] text-white shadow-lg shadow-primary/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
              <Icon className="w-5 h-5" />
            </div>
            {badge && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5">{badge.text}</p>
                <p className="text-lg font-bold text-white">{subtitle}</p>
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em] mb-1">{title}</p>
            <p className="text-3xl font-black leading-none">{value}</p>
            {!badge && <p className="text-[10px] text-white/40 font-medium mt-2">{subtitle}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-6 rounded-[32px] border border-gray-100 transition-all duration-300 ${
      variant === "warning" 
        ? "hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5"
        : "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="bg-gray-50 p-3 rounded-2xl text-gray-500">
          <Icon className="w-5 h-5" />
        </div>
        {badge && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
            badge.color === "green" ? "bg-gray-100" : 
            badge.color === "amber" ? "bg-amber-100" : "bg-gray-100"
          }`}>
            {badge.color === "green" && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              badge.color === "amber" ? "text-amber-700" : "text-gray-600"
            }`}>
              {badge.text}
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">{title}</p>
        <p className="text-3xl font-black text-secondary leading-none">{value}</p>
        <p className="text-[10px] text-gray-400 font-medium mt-2 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {subtitle}
        </p>
      </div>
    </div>
  );
}
