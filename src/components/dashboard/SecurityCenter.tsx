import { Shield, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export function SecurityCenter() {
  return (
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 space-y-8 h-full">
      <h3 className="text-xl font-bold text-secondary flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
          <Shield className="w-5 h-5" />
        </div>
        Security Center
      </h3>

      <div className="space-y-6">
        {[
          { 
            title: "KMS Integration", 
            desc: "Hardware security signing", 
            status: "Active", 
            icon: ShieldCheck, 
            active: true 
          },
          { 
            title: "2FA Protection", 
            desc: "Secondary authentication", 
            status: "Disabled", 
            icon: AlertCircle, 
            active: false 
          },
          { 
            title: "Audit Logging", 
            desc: "Immutable activity trail", 
            status: "Active", 
            icon: CheckCircle2, 
            active: true 
          },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-4">
            <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
              item.active ? "bg-white border-gray-100 text-gray-400" : "bg-white border-gray-100 text-gray-400"
            }`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-secondary text-sm">{item.title}</p>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  item.active ? "text-green-600" : "text-amber-600"
                }`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-gray-50 mt-auto">
        <div className="bg-secondary text-white p-6 rounded-2xl relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <h4 className="font-bold text-sm relative z-10">Security Audit</h4>
          <p className="text-xs text-white/60 mt-1 relative z-10">Last full audit: 2 days ago</p>
          <button className="mt-4 w-full bg-white text-secondary py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-secondary transition-colors relative z-10">
            Run Quick Scan
          </button>
        </div>
      </div>
    </div>
  );
}
